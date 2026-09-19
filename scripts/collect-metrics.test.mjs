import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectCoverage,
  collectTests,
  countSuppressions,
  parseJUnit,
  parseGoTestJSON,
} from "./collect-metrics.mjs";

const FIXTURES = join(import.meta.dirname, "..", "tests", "fixtures", "metrics");

test("collectCoverage reads istanbul coverage-summary.json", () => {
  const coverage = collectCoverage(join(FIXTURES, "istanbul"));
  assert.deepEqual(coverage, { lines: 82, statements: 81.81, functions: 90, branches: 75 });
});

test("collectCoverage reads lcov.info", () => {
  const coverage = collectCoverage(join(FIXTURES, "lcov"));
  assert.equal(coverage.lines, 87.5);
  assert.equal(coverage.functions, 86.67);
  assert.equal(coverage.branches, 83.33);
});

test("collectCoverage reads go tool cover -func output and leaves branches/functions absent", () => {
  const coverage = collectCoverage(join(FIXTURES, "go-func"));
  assert.equal(coverage.lines, 78.4);
  assert.equal(coverage.statements, 78.4);
  assert.equal(coverage.functions, null);
  assert.equal(coverage.branches, null);
});

test("collectCoverage reads coverage.py json", () => {
  const coverage = collectCoverage(join(FIXTURES, "coverage-py"));
  assert.equal(coverage.lines, 85);
  assert.equal(coverage.branches, 75);
  assert.equal(coverage.functions, null);
});

test("collectCoverage returns all-null when no report exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "metrics-empty-"));
  try {
    const coverage = collectCoverage(dir);
    assert.deepEqual(coverage, { lines: null, statements: null, functions: null, branches: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectCoverage falls through a malformed report instead of throwing", () => {
  const coverage = collectCoverage(join(FIXTURES, "malformed"));
  assert.deepEqual(coverage, { lines: null, statements: null, functions: null, branches: null });
});

test("parseJUnit counts testcase elements, not the suite totals attribute", () => {
  const xml = `<testsuite tests="99" failures="99" skipped="99">
    <testcase name="a" />
    <testcase name="b"><skipped/></testcase>
    <testcase name="c"><failure>boom</failure></testcase>
  </testsuite>`;
  assert.deepEqual(parseJUnit(xml), { tests_passed: 1, tests_skipped: 1, tests_failed: 1 });
});

test("collectTests reads a JUnit fixture with a passed, skipped, and failed case", () => {
  const result = collectTests(join(FIXTURES, "junit"), "python");
  assert.deepEqual(result, { tests_passed: 1, tests_skipped: 1, tests_failed: 1 });
});

test("collectTests returns nulls when no report exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "metrics-empty-"));
  try {
    const result = collectTests(dir, "python");
    assert.deepEqual(result, { tests_passed: null, tests_skipped: null, tests_failed: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectTests treats an unparsable JUnit report as zero cases, not a crash", () => {
  const result = collectTests(join(FIXTURES, "malformed"), "python");
  assert.deepEqual(result, { tests_passed: 0, tests_skipped: 0, tests_failed: 0 });
});

test("parseGoTestJSON counts only events carrying a Test field", () => {
  const text = `{"Action":"pass","Package":"x"}
{"Action":"pass","Package":"x","Test":"A"}
{"Action":"skip","Package":"x","Test":"B"}
{"Action":"fail","Package":"x","Test":"C"}`;
  assert.deepEqual(parseGoTestJSON(text), { tests_passed: 1, tests_skipped: 1, tests_failed: 1 });
});

test("collectTests reads go test -json output for the go language", () => {
  const result = collectTests(join(FIXTURES, "go-test-json"), "go");
  assert.deepEqual(result, { tests_passed: 1, tests_skipped: 1, tests_failed: 1 });
});

test("countSuppressions counts suppressions in source but excludes node_modules", () => {
  const count = countSuppressions(join(FIXTURES, "suppressions"));
  assert.equal(count, 2);
});

test("countSuppressions recognizes a shellcheck disable directive", () => {
  const count = countSuppressions(join(FIXTURES, "shellcheck"));
  assert.equal(count, 1);
});
