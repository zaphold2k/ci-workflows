/**
 * Resolves a branch's role in the two branch models this component
 * supports, and derives the identifiers that versioning and the ratchet
 * build on top of that role. Kept dependency-free and side-effect-free so
 * every rule here is a pure function of its inputs.
 */

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesWorkPattern(branch, pattern) {
  return globToRegExp(pattern).test(branch);
}

/**
 * @returns {"stable" | "integration" | "work" | null}
 */
export function resolveBranchRole(
  branch,
  { branchModel, mainBranch, integrationBranch, workBranchPattern },
) {
  if (branch === mainBranch) return "stable";
  if (branchModel === "full" && branch === integrationBranch) return "integration";
  if (matchesWorkPattern(branch, workBranchPattern)) return "work";
  return null;
}

/** The branch that a push from the given role integrates into. */
export function integrationTargetFor(role, { branchModel, mainBranch, integrationBranch }) {
  if (role === "work") return branchModel === "full" ? integrationBranch : mainBranch;
  return mainBranch;
}

/**
 * Produces the same identifier for a branch regardless of whether its
 * separator is `/` or `-` (e.g. `feature/login-oauth` and
 * `feature-login-oauth`), valid both as a SemVer prerelease identifier
 * segment and as a container image tag.
 */
export function sanitizeBranchIdentifier(branch, workBranchPattern) {
  const normalize = (value) =>
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  const normalizedBranch = normalize(branch);
  const prefix = normalize(workBranchPattern.split("*")[0] ?? "");

  if (prefix && normalizedBranch.startsWith(`${prefix}-`)) {
    return normalizedBranch.slice(prefix.length + 1);
  }
  return normalizedBranch;
}
