import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesWorkPattern,
  resolveBranchRole,
  integrationTargetFor,
  sanitizeBranchIdentifier,
} from "./branch-model.mjs";

const simple = {
  branchModel: "simple",
  mainBranch: "main",
  integrationBranch: "develop",
  workBranchPattern: "feature-*",
};
const full = { ...simple, branchModel: "full" };

test("matchesWorkPattern supports a trailing glob", () => {
  assert.equal(matchesWorkPattern("feature-login-oauth", "feature-*"), true);
  assert.equal(matchesWorkPattern("bugfix-crash", "feature-*"), false);
});

test("resolveBranchRole identifies the stable branch", () => {
  assert.equal(resolveBranchRole("main", simple), "stable");
});

test("resolveBranchRole identifies the integration branch only in the full model", () => {
  assert.equal(resolveBranchRole("develop", full), "integration");
  assert.equal(resolveBranchRole("develop", simple), null);
});

test("resolveBranchRole identifies a work branch", () => {
  assert.equal(resolveBranchRole("feature-login-oauth", simple), "work");
});

test("resolveBranchRole returns null for a branch outside the model", () => {
  assert.equal(resolveBranchRole("experiment-spike", simple), null);
});

test("integrationTargetFor a work branch is develop in the full model and main in the simple model", () => {
  assert.equal(integrationTargetFor("work", full), "develop");
  assert.equal(integrationTargetFor("work", simple), "main");
});

test("integrationTargetFor the integration branch is always main", () => {
  assert.equal(integrationTargetFor("integration", full), "main");
});

test("sanitizeBranchIdentifier treats / and - separators as equivalent", () => {
  const withSlash = sanitizeBranchIdentifier("feature/login-oauth", "feature-*");
  const withDash = sanitizeBranchIdentifier("feature-login-oauth", "feature-*");
  assert.equal(withSlash, "login-oauth");
  assert.equal(withSlash, withDash);
});

test("sanitizeBranchIdentifier strips invalid characters and collapses separators", () => {
  assert.equal(sanitizeBranchIdentifier("feature-login_oauth!!v2", "feature-*"), "login-oauth-v2");
});
