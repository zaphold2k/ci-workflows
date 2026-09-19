/**
 * Minimal SemVer 2.0 helpers for the subset this component needs: parsing a
 * `vMAJOR.MINOR.PATCH[-prerelease]` git tag, computing the next base version
 * from Conventional Commits, and deriving a per-branch prerelease counter
 * from the tags that already exist. No external semver dependency, by the
 * "scripts run with zero dependencies" convention.
 */

const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?$/;

export function parseVersionTag(tag) {
  const match = TAG_PATTERN.exec(tag);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
  };
}

export function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

const BREAKING_HEADER = /^\w+(?:\([^)]*\))?!:/;
const BREAKING_FOOTER = /BREAKING[ -]CHANGE:/;
const TYPE_HEADER = /^(\w+)(?:\([^)]*\))?!?:/;

/**
 * @param {string} message full commit message (header + body)
 * @returns {{type: string|null, breaking: boolean}}
 */
export function parseConventionalCommit(message) {
  const header = message.split("\n")[0];
  const typeMatch = TYPE_HEADER.exec(header);
  const breaking = BREAKING_HEADER.test(header) || BREAKING_FOOTER.test(message);
  return { type: typeMatch ? typeMatch[1] : null, breaking };
}

/**
 * Computes the next base version from the last stable version and the
 * commit messages accumulated since it, following the same rules as
 * release-please: fix -> patch, feat -> minor, breaking -> major (or minor
 * while major is still zero). Commits of any other type don't move the
 * version.
 */
export function computeNextVersion(lastVersion, commitMessages) {
  const commits = commitMessages.map(parseConventionalCommit);
  const hasBreaking = commits.some((c) => c.breaking);
  const hasFeat = commits.some((c) => c.type === "feat");
  const hasFix = commits.some((c) => c.type === "fix");

  const { major, minor, patch } = lastVersion;

  if (hasBreaking) {
    return major > 0
      ? { major: major + 1, minor: 0, patch: 0 }
      : { major, minor: minor + 1, patch: 0 };
  }
  if (hasFeat) return { major, minor: minor + 1, patch: 0 };
  if (hasFix) return { major, minor, patch: patch + 1 };
  return { major, minor, patch };
}

/**
 * The next counter for a prerelease identifier, derived from the highest
 * counter already used by an existing tag for the same base version and
 * identifier — never a running total, so two branches never share a series.
 *
 * @param {string[]} existingTags all `v*` tags in the repository
 * @param {{base: string, identifier: string}} target e.g. base "0.2.0", identifier "alpha.login-oauth"
 */
export function nextCounter(existingTags, { base, identifier }) {
  const pattern = new RegExp(
    `^v${base.replace(/\./g, "\\.")}-${identifier.replace(/\./g, "\\.")}\\.(\\d+)$`,
  );
  let max = 0;
  for (const tag of existingTags) {
    const match = pattern.exec(tag);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}
