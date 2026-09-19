import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVersionTag,
  formatVersion,
  computeNextVersion,
  nextCounter,
  parseConventionalCommit,
} from "./semver.mjs";

test("parseVersionTag parses a stable tag", () => {
  assert.deepEqual(parseVersionTag("v1.4.2"), { major: 1, minor: 4, patch: 2, prerelease: null });
});

test("parseVersionTag parses a prerelease tag", () => {
  assert.deepEqual(parseVersionTag("v0.2.0-alpha.login-oauth.1"), {
    major: 0,
    minor: 2,
    patch: 0,
    prerelease: "alpha.login-oauth.1",
  });
});

test("parseVersionTag rejects a tag that isn't a version", () => {
  assert.equal(parseVersionTag("chore-cleanup"), null);
  assert.equal(parseVersionTag("v1.2"), null);
});

test("formatVersion renders MAJOR.MINOR.PATCH", () => {
  assert.equal(formatVersion({ major: 1, minor: 4, patch: 2 }), "1.4.2");
});

test("parseConventionalCommit reads the type and a bang-marked breaking change", () => {
  assert.deepEqual(parseConventionalCommit("feat(api)!: drop v1 endpoints"), {
    type: "feat",
    breaking: true,
  });
});

test("parseConventionalCommit reads a footer-marked breaking change", () => {
  const message = "fix: adjust retry\n\nBREAKING CHANGE: retry count is now required";
  assert.deepEqual(parseConventionalCommit(message), { type: "fix", breaking: true });
});

test("parseConventionalCommit handles a plain commit", () => {
  assert.deepEqual(parseConventionalCommit("chore: bump deps"), { type: "chore", breaking: false });
});

test("computeNextVersion bumps patch for fix-only commits", () => {
  const next = computeNextVersion({ major: 1, minor: 2, patch: 0 }, [
    "fix: null check",
    "chore: cleanup",
  ]);
  assert.deepEqual(next, { major: 1, minor: 2, patch: 1 });
});

test("computeNextVersion bumps minor for a feature", () => {
  const next = computeNextVersion({ major: 1, minor: 2, patch: 0 }, [
    "feat: add export",
    "fix: typo",
  ]);
  assert.deepEqual(next, { major: 1, minor: 3, patch: 0 });
});

test("computeNextVersion bumps major for a breaking change past 1.0", () => {
  const next = computeNextVersion({ major: 1, minor: 2, patch: 0 }, ["feat!: remove legacy mode"]);
  assert.deepEqual(next, { major: 2, minor: 0, patch: 0 });
});

test("computeNextVersion bumps minor, not major, for a breaking change in the zero series", () => {
  const next = computeNextVersion({ major: 0, minor: 3, patch: 1 }, ["feat!: rework config"]);
  assert.deepEqual(next, { major: 0, minor: 4, patch: 0 });
});

test("computeNextVersion leaves the version unchanged when no commit is versionable", () => {
  const next = computeNextVersion({ major: 1, minor: 0, patch: 0 }, [
    "docs: fix typo",
    "chore: rename file",
  ]);
  assert.deepEqual(next, { major: 1, minor: 0, patch: 0 });
});

test("nextCounter starts at 1 when no matching tag exists", () => {
  assert.equal(nextCounter([], { base: "0.2.0", identifier: "alpha.login-oauth" }), 1);
});

test("nextCounter increments from the highest existing counter for that branch", () => {
  const tags = [
    "v0.2.0-alpha.login-oauth.1",
    "v0.2.0-alpha.login-oauth.2",
    "v0.2.0-alpha.cache-redis.1",
  ];
  assert.equal(nextCounter(tags, { base: "0.2.0", identifier: "alpha.login-oauth" }), 3);
});

test("nextCounter keeps parallel branch series independent", () => {
  const tags = ["v0.2.0-alpha.login-oauth.5", "v0.2.0-alpha.cache-redis.1"];
  assert.equal(nextCounter(tags, { base: "0.2.0", identifier: "alpha.cache-redis" }), 2);
});
