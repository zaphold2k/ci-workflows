import { test } from "node:test";
import assert from "node:assert/strict";
import { stableTags, prereleaseTags, branchTags } from "./image-tags.mjs";

test("a post-1.0 stable tag publishes full, minor, major, and latest", () => {
  assert.deepEqual(stableTags("v1.4.2", "abc1234"), ["1.4.2", "1.4", "latest", "1", "abc1234"]);
});

test("a zero-series stable tag does not publish a bare major tag", () => {
  const tags = stableTags("v0.1.2", "abc1234");
  assert.deepEqual(tags, ["0.1.2", "0.1", "latest", "abc1234"]);
  assert.ok(!tags.includes("0"));
});

test("a non-version tag publishes nothing", () => {
  assert.deepEqual(stableTags("chore-cleanup", "abc1234"), []);
});

test("a prerelease tag publishes only its exact version and the commit sha", () => {
  assert.deepEqual(prereleaseTags("0.1.2-alpha.login-oauth.1", "abc1234"), [
    "0.1.2-alpha.login-oauth.1",
    "abc1234",
  ]);
});

test("a prerelease tag never moves latest or major/minor tags", () => {
  const tags = prereleaseTags("0.1.2-alpha.login-oauth.1", "abc1234");
  assert.ok(!tags.includes("latest"));
  assert.ok(!tags.includes("0.1"));
});

test("a work-branch prerelease adds a moving tag with the branch identifier", () => {
  const tags = prereleaseTags("0.2.0-alpha.login-oauth.2", "def5678", { movingTag: "login-oauth" });
  assert.deepEqual(tags, ["0.2.0-alpha.login-oauth.2", "def5678", "login-oauth"]);
});

test("an integration-branch candidate has no moving tag", () => {
  const tags = prereleaseTags("0.2.0-rc.1", "def5678");
  assert.deepEqual(tags, ["0.2.0-rc.1", "def5678"]);
});

test("a plain branch push publishes the branch name and the commit sha", () => {
  assert.deepEqual(branchTags("main", "abc1234"), ["main", "abc1234"]);
});
