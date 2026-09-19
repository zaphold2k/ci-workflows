import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePublication } from "./version.mjs";

const base = {
  branchModel: "full",
  mainBranch: "main",
  integrationBranch: "develop",
  workBranchPattern: "feature-*",
  shortSha: "abc1234",
  lastVersion: { major: 0, minor: 1, patch: 0 },
  commitMessages: ["feat: add login"],
  existingTags: [],
};

test("first push of a work branch creates its alpha.1 tag and prerelease image tags", () => {
  const result = resolvePublication({ ...base, refType: "branch", refName: "feature-login-oauth" });
  assert.equal(result.role, "work");
  assert.equal(result.strategy, "build");
  assert.equal(result.version, "0.2.0-alpha.login-oauth.1");
  assert.equal(result.tagName, "v0.2.0-alpha.login-oauth.1");
  assert.deepEqual(result.imageTags, ["0.2.0-alpha.login-oauth.1", "abc1234", "login-oauth"]);
});

test("a second push to the same branch increments only its own counter", () => {
  const result = resolvePublication({
    ...base,
    refType: "branch",
    refName: "feature-login-oauth",
    existingTags: ["v0.2.0-alpha.login-oauth.1"],
  });
  assert.equal(result.version, "0.2.0-alpha.login-oauth.2");
});

test("two work branches in parallel get independent counters", () => {
  const existingTags = ["v0.2.0-alpha.login-oauth.3"];
  const result = resolvePublication({
    ...base,
    refType: "branch",
    refName: "feature-cache-redis",
    existingTags,
  });
  assert.equal(result.version, "0.2.0-alpha.cache-redis.1");
});

test("the integration branch produces an rc tag with no moving tag", () => {
  const result = resolvePublication({ ...base, refType: "branch", refName: "develop" });
  assert.equal(result.role, "integration");
  assert.equal(result.version, "0.2.0-rc.1");
  assert.deepEqual(result.imageTags, ["0.2.0-rc.1", "abc1234"]);
});

test("a plain push to main publishes the branch name, not a version", () => {
  const result = resolvePublication({ ...base, refType: "branch", refName: "main" });
  assert.equal(result.role, "stable");
  assert.equal(result.version, undefined);
  assert.deepEqual(result.imageTags, ["main", "abc1234"]);
});

test("a branch outside the declared model does not publish", () => {
  const result = resolvePublication({ ...base, refType: "branch", refName: "experiment-spike" });
  assert.equal(result.role, null);
  assert.equal(result.publish, false);
});

test("a tag that isn't a stable version does not publish", () => {
  const result = resolvePublication({ ...base, refType: "tag", refName: "not-a-version" });
  assert.equal(result.publish, false);
});

test("the simple model builds the stable tag directly instead of promoting", () => {
  const result = resolvePublication({
    ...base,
    branchModel: "simple",
    refType: "tag",
    refName: "v1.4.2",
  });
  assert.equal(result.kind, "stable");
  assert.equal(result.strategy, "build");
  assert.deepEqual(result.imageTags, ["1.4.2", "1.4", "latest", "1", "abc1234"]);
});

test("the full model promotes the matching candidate's digest instead of rebuilding", () => {
  const result = resolvePublication({
    ...base,
    refType: "tag",
    refName: "v1.4.2",
    existingTags: ["v1.4.2-rc.1", "v1.4.2-rc.2"],
  });
  assert.equal(result.strategy, "promote");
  assert.equal(result.digestSourceTag, "1.4.2-rc.2");
  assert.equal(result.publish, true);
});

test("promoting in the full model fails closed when no candidate tag was ever built", () => {
  const result = resolvePublication({
    ...base,
    refType: "tag",
    refName: "v1.4.2",
    existingTags: [],
  });
  assert.equal(result.publish, false);
  assert.match(result.reason, /no candidate tag found/);
});
