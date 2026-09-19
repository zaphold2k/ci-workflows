/**
 * Normalizes test and coverage output from any supported language into a
 * single `.ci/metrics.json` file, which is what the ratchet compares between
 * a branch and its target branch's baseline.
 *
 * Normalization happens here, at collection time, rather than at comparison
 * time, so a baseline stays comparable even if the repository switches test
 * tools later (e.g. vitest to jest).
 *
 * Usage:
 *   node collect-metrics.mjs --language node --dir . --out .ci/metrics.json
 *
 * A metric a toolchain doesn't report is emitted as `null`, not `0`: the
 * ratchet ignores a `null` instead of treating it as a regression to zero.
 * Go, for instance, doesn't report branch coverage.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const EMPTY_COVERAGE = { lines: null, statements: null, functions: null, branches: null };

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/* --------------------------------------------------------------- tests --- */

/**
 * Counts `<testcase>` elements instead of the `<testsuite>` totals
 * attributes: reporters disagree on whether a skipped test counts toward
 * `tests=`, but an element count is the same across all of them.
 */
function parseJUnit(xml) {
  const cases = xml.match(/<testcase\b[\s\S]*?(?:\/>|<\/testcase>)/g) ?? [];
  let passed = 0;
  let skipped = 0;
  let failed = 0;
  for (const testcase of cases) {
    if (/<skipped\b/.test(testcase)) skipped++;
    else if (/<(failure|error)\b/.test(testcase)) failed++;
    else passed++;
  }
  return { tests_passed: passed, tests_skipped: skipped, tests_failed: failed };
}

function findJUnitReports(dir) {
  const candidates = [
    join(dir, ".ci/junit.xml"),
    join(dir, "junit.xml"),
    join(dir, "test-results/junit.xml"),
    join(dir, "reports/junit.xml"),
  ];
  return candidates.filter((path) => existsSync(path));
}

/**
 * `go test -json` emits one event per action; only events carrying a `Test`
 * field are individual tests, the rest are package-level events.
 */
function parseGoTestJSON(text) {
  let passed = 0;
  let skipped = 0;
  let failed = 0;
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!event.Test) continue;
    if (event.Action === "pass") passed++;
    else if (event.Action === "skip") skipped++;
    else if (event.Action === "fail") failed++;
  }
  return { tests_passed: passed, tests_skipped: skipped, tests_failed: failed };
}

function collectTests(root, language) {
  if (language === "go") {
    const raw = readIfExists(join(root, ".ci/gotest.json"));
    if (raw) return parseGoTestJSON(raw);
  }
  const reports = findJUnitReports(root);
  if (reports.length > 0) {
    const totals = { tests_passed: 0, tests_skipped: 0, tests_failed: 0 };
    for (const path of reports) {
      const parsed = parseJUnit(readFileSync(path, "utf8"));
      totals.tests_passed += parsed.tests_passed;
      totals.tests_skipped += parsed.tests_skipped;
      totals.tests_failed += parsed.tests_failed;
    }
    return totals;
  }
  return { tests_passed: null, tests_skipped: null, tests_failed: null };
}

/* ----------------------------------------------------------- coverage --- */

function round(value) {
  return value === null || Number.isNaN(value) ? null : Math.round(value * 100) / 100;
}

function pct(covered, total) {
  if (!total) return null;
  return round((covered / total) * 100);
}

/** istanbul `coverage-summary.json`, emitted by vitest and jest via the `json-summary` reporter. */
function fromIstanbul(path) {
  const total = JSON.parse(readFileSync(path, "utf8")).total;
  return {
    lines: round(total.lines?.pct ?? null),
    statements: round(total.statements?.pct ?? null),
    functions: round(total.functions?.pct ?? null),
    branches: round(total.branches?.pct ?? null),
  };
}

/** lcov.info: the most portable format, emitted by nearly every toolchain. */
function fromLcov(path) {
  const totals = { LF: 0, LH: 0, FNF: 0, FNH: 0, BRF: 0, BRH: 0 };
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const [key, value] = line.trim().split(":");
    if (key in totals) totals[key] += Number(value) || 0;
  }
  const lines = pct(totals.LH, totals.LF);
  return {
    lines,
    statements: lines,
    functions: pct(totals.FNH, totals.FNF),
    branches: pct(totals.BRH, totals.BRF),
  };
}

/** `go tool cover -func` output: the last line is `total: ... NN.N%`. */
function fromGoFunc(path) {
  const match = readFileSync(path, "utf8").match(/^total:.*?([\d.]+)%\s*$/m);
  if (!match) return { ...EMPTY_COVERAGE };
  const value = round(Number(match[1]));
  // Go measures statements; branches and functions are not reported.
  return { lines: value, statements: value, functions: null, branches: null };
}

/** `coverage json` output (coverage.py, used by pytest-cov). */
function fromCoveragePy(path) {
  const totals = JSON.parse(readFileSync(path, "utf8")).totals ?? {};
  const branches =
    totals.num_branches > 0 ? pct(totals.covered_branches ?? 0, totals.num_branches) : null;
  const lines = round(totals.percent_covered ?? null);
  return { lines, statements: lines, functions: null, branches };
}

function collectCoverage(root) {
  const sources = [
    [join(root, "coverage/coverage-summary.json"), fromIstanbul],
    [join(root, ".ci/coverage-summary.json"), fromIstanbul],
    [join(root, "coverage.json"), fromCoveragePy],
    [join(root, ".ci/coverage.json"), fromCoveragePy],
    [join(root, ".ci/coverage-func.txt"), fromGoFunc],
    [join(root, "coverage/lcov.info"), fromLcov],
    [join(root, "lcov.info"), fromLcov],
    [join(root, ".ci/lcov.info"), fromLcov],
  ];
  for (const [path, parse] of sources) {
    if (!existsSync(path)) continue;
    try {
      return parse(path);
    } catch (error) {
      console.warn(`Could not read coverage from ${path}: ${error.message}`);
    }
  }
  return { ...EMPTY_COVERAGE };
}

/* -------------------------------------------------------- suppressions --- */

// A suppression turns off a check the rest of the pipeline enforces. A single
// one may be well justified; what the ratchet watches is whether the total
// grows without anyone deciding that it should.
const SUPPRESSION_PATTERNS = [
  /eslint-disable/g,
  /@ts-(ignore|expect-error|nocheck)/g,
  /\/\/\s*nolint/g,
  /#\s*nosec/g,
  /#\s*noqa/g,
  /#\s*type:\s*ignore/g,
  /#\s*pylint:\s*disable/g,
  /#\s*ruff:\s*noqa/g,
  /#\s*shellcheck\s+disable/g,
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".astro",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".ci",
  "target",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "bin",
  "obj",
]);

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".go",
  ".py",
  ".rb",
  ".rs",
  ".java",
  ".cs",
  ".php",
  ".svelte",
  ".vue",
  ".astro",
  ".sh",
  ".bash",
]);

function countSuppressions(dir) {
  let count = 0;
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
        let text;
        try {
          if (statSync(path).size > 2_000_000) continue;
          text = readFileSync(path, "utf8");
        } catch {
          continue;
        }
        for (const pattern of SUPPRESSION_PATTERNS) {
          count += (text.match(pattern) ?? []).length;
        }
      }
    }
  };
  walk(dir);
  return count;
}

/* ---------------------------------------------------------------- run --- */

export function buildMetrics({ root, language }) {
  return {
    schema: 1,
    language,
    commit: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF_NAME ?? null,
    generated_at: new Date().toISOString(),
    coverage: collectCoverage(root),
    ...collectTests(root, language),
    lint_suppressions: countSuppressions(root),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs(process.argv.slice(2));
  const language = args.language ?? "node";
  const root = args.dir ?? ".";
  const outPath = args.out ?? ".ci/metrics.json";

  const metrics = buildMetrics({ root, language });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`Metrics written to ${relative(".", outPath)}:`);
  console.log(JSON.stringify(metrics, null, 2));
}

export { collectCoverage, collectTests, countSuppressions, parseJUnit, parseGoTestJSON };
