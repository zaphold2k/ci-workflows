/**
 * Derives the set of image tags to publish for a run. Pure and
 * side-effect-free: it only decides what a registry push would tag, given
 * which of the four publishing shapes this run is.
 *
 * The commit-hash tag is included in every shape, so any published image is
 * traceable back to the exact commit it was built from.
 */
import { parseVersionTag } from "./semver.mjs";

/**
 * A stable release tag (vX.Y.Z, no prerelease), created by release-please
 * once its release PR is merged.
 */
export function stableTags(tagName, shortSha) {
  const version = parseVersionTag(tagName);
  if (!version || version.prerelease) return [];
  const tags = [
    `${version.major}.${version.minor}.${version.patch}`,
    `${version.major}.${version.minor}`,
    "latest",
  ];
  if (version.major > 0) tags.push(`${version.major}`);
  tags.push(shortSha);
  return tags;
}

/**
 * A work-branch prerelease (`alpha`) or integration-branch candidate (`rc`)
 * push: publishes only its own exact version, never latest or major/minor,
 * plus — for a work branch — a moving tag with the branch's identifier so
 * "give me the latest build of this branch" has a stable name.
 */
export function prereleaseTags(version, shortSha, { movingTag } = {}) {
  const tags = [version, shortSha];
  if (movingTag) tags.push(movingTag);
  return tags;
}

/**
 * A plain push to a branch that doesn't itself carry a version — the main
 * branch between releases, in the simple model, or any branch outside the
 * declared model that still gets verified. Callers must decide separately
 * whether to publish at all; a roleless branch never reaches this function.
 */
export function branchTags(branchName, shortSha) {
  return [branchName, shortSha];
}
