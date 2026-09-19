/**
 * Compares this run's metrics against the last known-good run of the branch
 * being integrated into, and fails the run if the repository would get
 * worse: less coverage, fewer passing tests, more skipped tests, or more
 * lint suppressions. Absence of a baseline informs without blocking — an
 * invented fixed threshold would be an arbitrary number.
 *
 * Usage:
 *   node ratchet.mjs --metrics .ci/metrics.json --tolerance 0 --floor 80
 *
 * The comparison and formatting logic below is pure and unit-tested
 * directly; GitHub I/O (fetching the baseline artifact, writing the job
 * summary, upserting the PR comment) lives only in the CLI entrypoint so it
 * never needs a live GitHub API to be tested.
 */
import { readFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { integrationTargetFor, resolveBranchRole } from "./lib/branch-model.mjs";

const COVERAGE_METRICS = ["lines", "statements", "functions", "branches"];
const COMMENT_MARKER = "<!-- ci-workflows:quality-ratchet -->";
export const OVERRIDE_LABEL = "ci-ratchet-override";

/* ---------------------------------------------------------- resolution --- */

/**
 * @returns {string} the branch whose last successful run is the baseline
 */
export function resolveBaselineBranch({
  eventName,
  prBaseRef,
  currentBranch,
  branchModel,
  mainBranch,
  integrationBranch,
  workBranchPattern,
}) {
  if (eventName === "pull_request") return prBaseRef;
  const role = resolveBranchRole(currentBranch, {
    branchModel,
    mainBranch,
    integrationBranch,
    workBranchPattern,
  });
  return integrationTargetFor(role, { branchModel, mainBranch, integrationBranch });
}

/* ----------------------------------------------------------- comparison -- */

function diffOf(current, baseline) {
  if (current === null || current === undefined) return null;
  if (baseline === null || baseline === undefined) return null;
  return Math.round((current - baseline) * 100) / 100;
}

/**
 * @param {object} current metrics produced by collect-metrics.mjs
 * @param {object|null} baseline metrics from the target branch's last green run, or null
 * @param {{tolerance?: number, floor?: number|null}} options
 */
function addRow(rows, blockingReasons, { metric, current, baseline, isRegression, describe }) {
  if (current === null || current === undefined) return;
  const diff = diffOf(current, baseline ?? null);
  const regression = diff !== null && isRegression(diff);
  rows.push({ metric, baseline: baseline ?? null, current, diff, regression });
  if (regression) blockingReasons.push(describe(diff));
}

export function compareMetrics(current, baseline, { tolerance = 0, floor = null } = {}) {
  const rows = [];
  const blockingReasons = [];

  for (const metric of COVERAGE_METRICS) {
    addRow(rows, blockingReasons, {
      metric: `coverage.${metric}`,
      current: current.coverage?.[metric] ?? null,
      baseline: baseline?.coverage?.[metric] ?? null,
      isRegression: (diff) => diff < -tolerance,
      describe: (diff) =>
        `coverage.${metric} dropped from ${baseline.coverage[metric]}% to ${current.coverage[metric]}% (${diff} pts, tolerance ${tolerance})`,
    });
  }

  addRow(rows, blockingReasons, {
    metric: "tests_passed",
    current: current.tests_passed,
    baseline: baseline?.tests_passed ?? null,
    isRegression: (diff) => diff < 0,
    describe: (diff) =>
      `tests_passed dropped from ${baseline.tests_passed} to ${current.tests_passed} (${-diff} lost)`,
  });

  addRow(rows, blockingReasons, {
    metric: "tests_skipped",
    current: current.tests_skipped,
    baseline: baseline?.tests_skipped ?? null,
    isRegression: (diff) => diff > 0,
    describe: (diff) =>
      `tests_skipped rose from ${baseline.tests_skipped} to ${current.tests_skipped} (${diff} newly skipped)`,
  });

  addRow(rows, blockingReasons, {
    metric: "lint_suppressions",
    current: current.lint_suppressions,
    baseline: baseline?.lint_suppressions ?? null,
    isRegression: (diff) => diff > 0,
    describe: (diff) =>
      `lint_suppressions rose from ${baseline.lint_suppressions} to ${current.lint_suppressions} (+${diff})`,
  });

  let floorViolation = null;
  const primaryCoverage = current.coverage?.lines ?? null;
  if (floor !== null && primaryCoverage !== null && primaryCoverage < floor) {
    floorViolation = { floor, actual: primaryCoverage };
  }

  return {
    hasBaseline: baseline !== null,
    rows,
    blockingReasons,
    floorViolation,
    wouldBlock: blockingReasons.length > 0 || floorViolation !== null,
  };
}

/* ------------------------------------------------------------- reporting - */

export function formatSummaryTable(comparison) {
  const lines = [];
  if (!comparison.hasBaseline) {
    lines.push("_No baseline available for this branch yet — reporting current metrics only._", "");
  }
  lines.push(
    "| Metric | Baseline | Current | Diff | Regression |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const row of comparison.rows) {
    lines.push(
      `| ${row.metric} | ${row.baseline ?? "—"} | ${row.current ?? "—"} | ${row.diff ?? "—"} | ${row.regression ? "yes" : "no"} |`,
    );
  }
  if (comparison.floorViolation) {
    lines.push(
      "",
      `Coverage floor violated: required ${comparison.floorViolation.floor}%, got ${comparison.floorViolation.actual}%.`,
    );
  }
  return lines.join("\n");
}

export function formatPrComment(comparison, { overridden = false, dryRun = false } = {}) {
  const parts = [COMMENT_MARKER, "### Quality ratchet", "", formatSummaryTable(comparison)];
  if (comparison.wouldBlock && overridden) {
    parts.push("", `Regression accepted via the \`${OVERRIDE_LABEL}\` label.`);
  } else if (comparison.wouldBlock && dryRun) {
    parts.push("", "This would have blocked the run outside of dry-run mode.");
  } else if (comparison.wouldBlock) {
    parts.push("", "This blocks the pull request. See the reasons above.");
  }
  return parts.join("\n");
}

export function hasOverrideLabel(labels) {
  return (labels ?? []).some(
    (label) => (typeof label === "string" ? label : label.name) === OVERRIDE_LABEL,
  );
}

/**
 * Whether the run should actually fail, folding in override and dry-run.
 */
export function decide(comparison, { overridden = false, dryRun = false } = {}) {
  return comparison.wouldBlock && !overridden && !dryRun;
}

/* ------------------------------------------------------------------ CLI -- */

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options });
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Downloads the metrics artifact from the last successful run of `branch` on this workflow. */
function fetchBaseline({ repo, workflowFile, branch }) {
  try {
    const runsJson = sh("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      workflowFile,
      "--branch",
      branch,
      "--status",
      "success",
      "--limit",
      "1",
      "--json",
      "databaseId",
    ]);
    const runs = JSON.parse(runsJson);
    if (runs.length === 0) return null;

    const dir = ".ci/baseline";
    sh("gh", [
      "run",
      "download",
      String(runs[0].databaseId),
      "--repo",
      repo,
      "--name",
      "metrics",
      "--dir",
      dir,
    ]);
    return readJSON(`${dir}/metrics.json`);
  } catch (error) {
    console.warn(`Could not recover a baseline for ${branch}: ${error.message}`);
    return null;
  }
}

function upsertPrComment({ repo, prNumber, body }) {
  try {
    const commentsJson = sh("gh", [
      "api",
      `repos/${repo}/issues/${prNumber}/comments`,
      "--paginate",
    ]);
    const comments = JSON.parse(commentsJson);
    const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

    if (existing) {
      sh("gh", [
        "api",
        "--method",
        "PATCH",
        `repos/${repo}/issues/comments/${existing.id}`,
        "-f",
        `body=${body}`,
      ]);
    } else {
      sh("gh", [
        "api",
        "--method",
        "POST",
        `repos/${repo}/issues/${prNumber}/comments`,
        "-f",
        `body=${body}`,
      ]);
    }
  } catch (error) {
    console.warn(`Could not write the PR comment (continuing without it): ${error.message}`);
  }
}

function writeSummary(text) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) appendFileSync(path, `${text}\n`);
  else console.log(text);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = "true";
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const current = readJSON(args.metrics ?? ".ci/metrics.json");
  const tolerance = Number(args.tolerance ?? "0");
  const floor = args.floor ? Number(args.floor) : null;
  const dryRun = args["dry-run"] === "true";
  const repo = args.repo ?? process.env.GITHUB_REPOSITORY;
  const workflowFile =
    args.workflow ?? process.env.GITHUB_WORKFLOW_REF?.split("@")[0]?.split("/").pop();
  const eventName = args.event ?? process.env.GITHUB_EVENT_NAME;
  const prNumber = args["pr-number"] ?? "";
  const labels = args.labels ? args.labels.split(",").filter(Boolean) : [];

  const baselineBranch = resolveBaselineBranch({
    eventName,
    prBaseRef: args["base-ref"] ?? process.env.GITHUB_BASE_REF,
    currentBranch: args.branch ?? process.env.GITHUB_REF_NAME,
    branchModel: args["branch-model"] ?? "simple",
    mainBranch: args["main-branch"] ?? "main",
    integrationBranch: args["integration-branch"] ?? "develop",
    workBranchPattern: args["work-branch-pattern"] ?? "feature-*",
  });

  const baseline = fetchBaseline({ repo, workflowFile, branch: baselineBranch });
  const comparison = compareMetrics(current, baseline, { tolerance, floor });
  const overridden = comparison.wouldBlock && hasOverrideLabel(labels);

  writeSummary(
    `## Quality ratchet (baseline: ${baselineBranch})\n\n${formatSummaryTable(comparison)}`,
  );

  if (eventName === "pull_request" && prNumber) {
    upsertPrComment({ repo, prNumber, body: formatPrComment(comparison, { overridden, dryRun }) });
  }

  const shouldBlock = decide(comparison, { overridden, dryRun });
  if (shouldBlock) {
    console.error("Quality ratchet blocked this run:");
    for (const reason of comparison.blockingReasons) console.error(`  - ${reason}`);
    if (comparison.floorViolation) {
      console.error(
        `  - coverage floor: required ${comparison.floorViolation.floor}%, got ${comparison.floorViolation.actual}%`,
      );
    }
    process.exitCode = 1;
  } else if (comparison.wouldBlock) {
    console.log(
      dryRun
        ? "Quality ratchet would have blocked this run (dry-run mode)."
        : "Quality ratchet regression accepted via override label.",
    );
  } else {
    console.log("Quality ratchet passed.");
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
