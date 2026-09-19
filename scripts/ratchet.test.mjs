import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveBaselineBranch,
  compareMetrics,
  formatSummaryTable,
  formatPrComment,
  hasOverrideLabel,
  decide,
  findExistingComment,
  OVERRIDE_LABEL,
} from "./ratchet.mjs";

function metrics(overrides = {}) {
  return {
    coverage: { lines: 80, statements: 80, functions: 80, branches: 80 },
    tests_passed: 50,
    tests_skipped: 2,
    tests_failed: 0,
    lint_suppressions: 3,
    ...overrides,
  };
}

/* ------------------------------------------------------- baseline branch */

test("resolveBaselineBranch uses the PR base ref for pull requests", () => {
  const branch = resolveBaselineBranch({ eventName: "pull_request", prBaseRef: "develop" });
  assert.equal(branch, "develop");
});

test("resolveBaselineBranch targets the integration branch for a work branch push in the full model", () => {
  const branch = resolveBaselineBranch({
    eventName: "push",
    currentBranch: "feature-login-oauth",
    branchModel: "full",
    mainBranch: "main",
    integrationBranch: "develop",
    workBranchPattern: "feature-*",
  });
  assert.equal(branch, "develop");
});

test("resolveBaselineBranch targets main for a work branch push in the simple model", () => {
  const branch = resolveBaselineBranch({
    eventName: "push",
    currentBranch: "feature-login-oauth",
    branchModel: "simple",
    mainBranch: "main",
    integrationBranch: "develop",
    workBranchPattern: "feature-*",
  });
  assert.equal(branch, "main");
});

/* ------------------------------------------------------------ comparison */

test("coverage drop beyond tolerance blocks", () => {
  const result = compareMetrics(
    metrics({ coverage: { lines: 75, statements: 80, functions: 80, branches: 80 } }),
    metrics(),
  );
  assert.equal(result.wouldBlock, true);
  assert.match(result.blockingReasons[0], /coverage\.lines dropped/);
});

test("coverage improvement passes", () => {
  const result = compareMetrics(
    metrics({ coverage: { lines: 85, statements: 85, functions: 85, branches: 85 } }),
    metrics(),
  );
  assert.equal(result.wouldBlock, false);
});

test("coverage drop within a configured tolerance passes but is still reported", () => {
  const result = compareMetrics(
    metrics({ coverage: { lines: 79.7, statements: 80, functions: 80, branches: 80 } }),
    metrics(),
    { tolerance: 0.5 },
  );
  assert.equal(result.wouldBlock, false);
  const row = result.rows.find((r) => r.metric === "coverage.lines");
  assert.equal(row.regression, false);
  assert.equal(row.diff, -0.3);
});

test("losing tests blocks even when coverage stays identical", () => {
  const result = compareMetrics(metrics({ tests_passed: 45 }), metrics());
  assert.equal(result.wouldBlock, true);
  assert.match(result.blockingReasons.join(" "), /tests_passed dropped/);
});

test("more skipped tests blocks", () => {
  const result = compareMetrics(metrics({ tests_skipped: 5 }), metrics());
  assert.equal(result.wouldBlock, true);
  assert.match(result.blockingReasons.join(" "), /tests_skipped rose/);
});

test("adding tests without skipping any passes", () => {
  const result = compareMetrics(metrics({ tests_passed: 60 }), metrics());
  assert.equal(result.wouldBlock, false);
});

test("a new lint suppression blocks", () => {
  const result = compareMetrics(metrics({ lint_suppressions: 4 }), metrics());
  assert.equal(result.wouldBlock, true);
  assert.match(result.blockingReasons.join(" "), /lint_suppressions rose/);
});

test("removing suppressions passes and is reported as an improvement", () => {
  const result = compareMetrics(metrics({ lint_suppressions: 1 }), metrics());
  assert.equal(result.wouldBlock, false);
  const row = result.rows.find((r) => r.metric === "lint_suppressions");
  assert.equal(row.diff, -2);
});

test("a metric missing from the baseline is reported but cannot block by itself", () => {
  const baseline = metrics({
    coverage: { lines: 80, statements: 80, functions: 80, branches: null },
  });
  const result = compareMetrics(
    metrics({ coverage: { lines: 80, statements: 80, functions: 80, branches: 60 } }),
    baseline,
  );
  assert.equal(result.wouldBlock, false);
  const row = result.rows.find((r) => r.metric === "coverage.branches");
  assert.equal(row.baseline, null);
  assert.equal(row.regression, false);
});

test("no baseline reports current metrics without blocking", () => {
  const result = compareMetrics(metrics(), null);
  assert.equal(result.hasBaseline, false);
  assert.equal(result.wouldBlock, false);
  assert.ok(result.rows.length > 0);
});

test("a coverage floor blocks even when the baseline comparison improved", () => {
  const result = compareMetrics(
    metrics({ coverage: { lines: 70, statements: 70, functions: 70, branches: 70 } }),
    metrics({ coverage: { lines: 60, statements: 60, functions: 60, branches: 60 } }),
    {
      floor: 80,
    },
  );
  assert.equal(result.floorViolation.floor, 80);
  assert.equal(result.floorViolation.actual, 70);
  assert.equal(result.wouldBlock, true);
});

test("no floor declared only applies the baseline comparison", () => {
  const result = compareMetrics(metrics(), metrics());
  assert.equal(result.floorViolation, null);
});

/* --------------------------------------------------------------- override */

test("hasOverrideLabel finds the label among plain strings", () => {
  assert.equal(hasOverrideLabel(["bug", OVERRIDE_LABEL]), true);
  assert.equal(hasOverrideLabel(["bug"]), false);
});

test("hasOverrideLabel finds the label among GitHub label objects", () => {
  assert.equal(hasOverrideLabel([{ name: OVERRIDE_LABEL }]), true);
});

test("decide blocks only when there is a regression, no override, and not a dry run", () => {
  const blocking = { wouldBlock: true };
  const clean = { wouldBlock: false };
  assert.equal(decide(blocking), true);
  assert.equal(decide(blocking, { overridden: true }), false);
  assert.equal(decide(blocking, { dryRun: true }), false);
  assert.equal(decide(clean), false);
});

/* --------------------------------------------------------------- reports */

test("formatPrComment carries the identity marker so the run can find its own comment", () => {
  const body = formatPrComment(compareMetrics(metrics(), metrics()));
  assert.match(body, /<!-- ci-workflows:quality-ratchet -->/);
});

test("findExistingComment finds the run's own comment by marker among others", () => {
  const comments = [
    { id: 1, body: "unrelated human comment" },
    { id: 2, body: "### Quality ratchet\n\n<!-- ci-workflows:quality-ratchet -->" },
  ];
  const existing = findExistingComment(comments, "<!-- ci-workflows:quality-ratchet -->");
  assert.equal(existing.id, 2);
});

test("findExistingComment returns null on the first run of a pull request", () => {
  const existing = findExistingComment(
    [{ id: 1, body: "unrelated" }],
    "<!-- ci-workflows:quality-ratchet -->",
  );
  assert.equal(existing, null);
});

test("formatSummaryTable notes when there is no baseline yet", () => {
  const text = formatSummaryTable(compareMetrics(metrics(), null));
  assert.match(text, /No baseline available/);
});
