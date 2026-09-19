/**
 * Computes the version and image tags a push produces, and — for a work or
 * integration branch — creates and pushes the prerelease tag that goes with
 * it. Stable versions are never created here: those come from accepting the
 * release-please proposal, which is a separate, human-reviewed step.
 *
 * Usage:
 *   node version.mjs --event push --ref-name feature-login-oauth --ref-type branch \
 *     --branch-model full --main-branch main --integration-branch develop \
 *     --work-branch-pattern 'feature-*' --sha <full-sha> [--dry-run true]
 *
 * Prints a single JSON line with `role`, `publish`, `version` (if any), and
 * `imageTags` (if any), so the calling workflow step can pick it apart with
 * `fromJSON()`.
 */
import { execFileSync } from "node:child_process";
import { resolveBranchRole, sanitizeBranchIdentifier } from "./lib/branch-model.mjs";
import { computeNextVersion, formatVersion, nextCounter, parseVersionTag } from "./lib/semver.mjs";
import { stableTags, prereleaseTags, branchTags } from "./lib/image-tags.mjs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lastStableVersion() {
  let tag;
  try {
    tag = git(["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*", "HEAD"]);
  } catch {
    return { major: 0, minor: 0, patch: 0 };
  }
  return parseVersionTag(tag) ?? { major: 0, minor: 0, patch: 0 };
}

function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  let log;
  try {
    log = git(["log", range, "--pretty=format:%B%x00"]);
  } catch {
    return [];
  }
  return log
    .split("\x00")
    .map((m) => m.trim())
    .filter(Boolean);
}

function allTags() {
  try {
    return git(["tag", "--list", "v*"]).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function createAndPushTag(tagName, dryRun) {
  if (dryRun) return;
  git(["tag", "-a", tagName, "-m", tagName]);
  git(["push", "origin", tagName]);
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

export function resolvePublication({
  refType,
  refName,
  branchModel,
  mainBranch,
  integrationBranch,
  workBranchPattern,
  shortSha,
  lastVersion,
  commitMessages,
  existingTags,
}) {
  if (refType === "tag") {
    const version = parseVersionTag(refName);
    if (!version || version.prerelease)
      return { role: "stable", publish: false, reason: "not a stable version tag" };
    return {
      role: "stable",
      publish: true,
      kind: "stable",
      version: formatVersion(version),
      imageTags: stableTags(refName, shortSha),
    };
  }

  const role = resolveBranchRole(refName, {
    branchModel,
    mainBranch,
    integrationBranch,
    workBranchPattern,
  });
  if (role === null)
    return { role: null, publish: false, reason: "branch has no role in the declared model" };

  if (role === "stable") {
    return { role, publish: true, kind: "branch", imageTags: branchTags(mainBranch, shortSha) };
  }

  const next = computeNextVersion(lastVersion, commitMessages);
  const base = formatVersion(next);
  const identifier =
    role === "work" ? `alpha.${sanitizeBranchIdentifier(refName, workBranchPattern)}` : "rc";
  const counter = nextCounter(existingTags, { base, identifier });
  const version = `${base}-${identifier}.${counter}`;
  const tagName = `v${version}`;
  const movingTag =
    role === "work" ? sanitizeBranchIdentifier(refName, workBranchPattern) : undefined;

  return {
    role,
    publish: true,
    kind: role === "work" ? "prerelease" : "candidate",
    version,
    tagName,
    imageTags: prereleaseTags(version, shortSha, { movingTag }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const refType = args["ref-type"] ?? "branch";
  const refName = args["ref-name"];
  const branchModel = args["branch-model"] ?? "simple";
  const mainBranch = args["main-branch"] ?? "main";
  const integrationBranch = args["integration-branch"] ?? "develop";
  const workBranchPattern = args["work-branch-pattern"] ?? "feature-*";
  const shortSha = args.sha ? args.sha.slice(0, 7) : git(["rev-parse", "--short", "HEAD"]);
  const dryRun = args["dry-run"] === "true";

  const lastVersion = lastStableVersion();
  const lastTag = allTags()
    .filter((tag) => parseVersionTag(tag) && !parseVersionTag(tag).prerelease)
    .sort()
    .at(-1);

  const result = resolvePublication({
    refType,
    refName,
    branchModel,
    mainBranch,
    integrationBranch,
    workBranchPattern,
    shortSha,
    lastVersion,
    commitMessages: commitsSince(lastTag),
    existingTags: allTags(),
  });

  if (result.tagName) {
    console.error(`${dryRun ? "[dry-run] would create" : "Creating"} tag ${result.tagName}`);
    createAndPushTag(result.tagName, dryRun);
  }

  console.log(JSON.stringify(result));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
