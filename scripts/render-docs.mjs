/**
 * Generates the marker-delimited "how this repository's pipeline works"
 * block installed in README.md (explaining voice) and in agent docs like
 * AGENTS.md/CLAUDE.md (prescribing voice), from the repository's actual
 * pipeline configuration. Regeneration is idempotent and never touches
 * anything outside the markers; a file with malformed markers is left
 * untouched rather than guessed at.
 *
 * Usage:
 *   node render-docs.mjs --language node --branch-model full \
 *     --main-branch main --integration-branch develop \
 *     --work-branch-pattern 'feature-*' --image ghcr.io/org/app \
 *     --readme README.md --agent-docs AGENTS.md,CLAUDE.md [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const START_MARKER = "<!-- ci-workflows:block:start -->";
export const END_MARKER = "<!-- ci-workflows:block:end -->";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces, inserts, or refuses to touch the marker-delimited block in
 * `content`, depending on what markers are already there.
 *
 * @returns {{content: string, changed: boolean} | {error: string}}
 */
export function applyBlock(
  content,
  blockBody,
  { startMarker = START_MARKER, endMarker = END_MARKER } = {},
) {
  const starts = [...content.matchAll(new RegExp(escapeRegExp(startMarker), "g"))];
  const ends = [...content.matchAll(new RegExp(escapeRegExp(endMarker), "g"))];
  const block = `${startMarker}\n${blockBody}\n${endMarker}`;

  if (starts.length === 0 && ends.length === 0) {
    const separator =
      content.length === 0 || content.endsWith("\n\n")
        ? ""
        : content.endsWith("\n")
          ? "\n"
          : "\n\n";
    return { content: `${content}${separator}${block}\n`, changed: true };
  }

  if (starts.length === 1 && ends.length === 1 && starts[0].index < ends[0].index) {
    const before = content.slice(0, starts[0].index);
    const after = content.slice(ends[0].index + endMarker.length);
    const newContent = `${before}${block}${after}`;
    return { content: newContent, changed: newContent !== content };
  }

  return {
    error: `Expected exactly one ${JSON.stringify(startMarker)} and one ${JSON.stringify(endMarker)}, start before end. Found ${starts.length} start marker(s) and ${ends.length} end marker(s).`,
  };
}

function workExample(pattern) {
  return pattern.replace("*", "login-oauth");
}

function describe(cfg) {
  const { branchModel, mainBranch, integrationBranch, workBranchPattern, language, image } = cfg;
  const isFull = branchModel === "full";
  return {
    ...cfg,
    isFull,
    workExample: workExample(workBranchPattern),
    workTarget: isFull ? integrationBranch : mainBranch,
    integrationTarget: mainBranch,
    stableSource: isFull
      ? `the latest candidate on \`${integrationBranch}\``
      : `\`${mainBranch}\` itself`,
    publishesImage: image !== "__none__",
    imageLine:
      image === "__none__"
        ? "no container image (no Dockerfile configured)"
        : image
          ? `\`${image}\``
          : "the image derived from this repository's name",
    languageLine: language,
  };
}

export function explainVoice(cfg) {
  const d = describe(cfg);
  const lines = [
    `### Pipeline flow (${d.branchModel} branch model)`,
    "",
    d.publishesImage
      ? `This repository is a **${d.languageLine}** project, publishing ${d.imageLine}.`
      : `This repository is a **${d.languageLine}** project. It does not publish a container image.`,
    "",
    d.isFull
      ? `Branches: \`${d.mainBranch}\` (stable), \`${d.integrationBranch}\` (integration), and branches matching \`${d.workBranchPattern}\` (work).`
      : `Branches: \`${d.mainBranch}\` (stable) and branches matching \`${d.workBranchPattern}\` (work).`,
    "",
    "**Starting a change:** branch from " +
      (d.isFull ? `\`${d.integrationBranch}\`` : `\`${d.mainBranch}\``) +
      `, naming it like \`${d.workExample}\`. Open your pull request against \`${d.workTarget}\`.`,
    "",
    "**What runs on a pull request:** lint, typecheck, tests, build, and the quality ratchet, compared against the last successful run of the target branch. Coverage drops, lost tests, new skips, and new lint suppressions block the merge.",
    "",
    "**What each push produces:**",
    d.publishesImage
      ? `- A push to a branch matching \`${d.workBranchPattern}\` creates a prerelease tag and image tagged with that branch's own moving tag.`
      : `- A push to a branch matching \`${d.workBranchPattern}\` creates a prerelease tag.`,
    ...(d.isFull
      ? [
          d.publishesImage
            ? `- A push to \`${d.integrationBranch}\` creates a release-candidate (\`rc\`) tag and image.`
            : `- A push to \`${d.integrationBranch}\` creates a release-candidate (\`rc\`) tag.`,
        ]
      : []),
    `- Accepting the release-please proposal on \`${d.mainBranch}\` cuts the stable version` +
      (d.isFull && d.publishesImage ? `, promoting ${d.stableSource} instead of rebuilding.` : "."),
    "- A branch outside this model runs the checks and produces no tag" +
      (d.publishesImage ? " or image." : "."),
    "",
    "**If a check blocks you:** see the reasons in the pull request comment or job summary. Coverage, test-count, and suppression regressions need fixing the regression, not silencing the check; a maintainer can apply the `ci-ratchet-override` label to accept a deliberate exception.",
  ];
  return lines.join("\n");
}

export function prescribeVoice(cfg) {
  const d = describe(cfg);
  const lines = [
    `### Pipeline rules (${d.branchModel} branch model) — read before pushing`,
    "",
    `Language: ${d.languageLine}. Image: ${d.imageLine}. This block is generated from the pipeline configuration; do not hand-edit it.`,
    "",
    "This repository's branch model is declared, not inferred. If it already declared one, use it without re-evaluating. If it doesn't yet declare one, choose based on observable characteristics of the repository and say why. If what you observe suggests a different model than the one declared, the declared model still wins — raise the discrepancy, don't change the declaration yourself.",
    "",
    "**Before starting a task:**",
    `- Branch from \`${d.isFull ? d.integrationBranch : d.mainBranch}\`.`,
    `- Name your branch matching \`${d.workBranchPattern}\` (e.g. \`${d.workExample}\`) — a name outside this pattern runs the checks and produces no version or image.`,
    `- Open the pull request against \`${d.workTarget}\`.`,
    "",
    "**What a push produces:**",
    `- Push to a \`${d.workBranchPattern}\` branch → prerelease tag + image, plus a moving tag with the branch name.`,
    ...(d.isFull ? [`- Push to \`${d.integrationBranch}\` → \`rc\` candidate tag + image.`] : []),
    `- Accepted release-please PR on \`${d.mainBranch}\` → stable version` +
      (d.isFull ? ` (promotes ${d.stableSource}; does not rebuild).` : "."),
    "- Any other branch → checks only, nothing published.",
    "",
    "**Cutting a package, by request type:**",
    '- "A build to test this" → push your work branch; its prerelease tag/image is the answer. Precondition: checks pass. Verify with the tag and image printed in the job summary.',
    d.isFull
      ? '- "Get this into the shared build" → merge into the integration branch; its rc tag/image is the answer. Precondition: PR checks pass.'
      : null,
    '- "Cut a stable release" → accept the pending release-please pull request. Precondition: it exists and its checks are green. Verify the new tag and image tags in the run summary.',
    "- If the request doesn't say which of these it means, assume the prerelease of the current work branch, and ask before doing anything else if that assumption isn't safe (e.g. the request implies something user-facing).",
    "",
    "**The quality gate is a limit, not an obstacle.** On a block:",
    "- Coverage regression → add the missing tests. Do not lower `coverage_tolerance` or `coverage_floor`.",
    "- Fewer passing tests → restore the missing coverage, or explain why the loss is deliberate and let a human decide on an override. Do not delete or skip a failing test to pass this check.",
    "- New lint/type suppression → fix the underlying issue instead. Do not add the suppression to get through the gate.",
    "- In every case: `ci-ratchet-override` is a label a human applies to the pull request. You may explain why an exception might be warranted; you may not apply it yourself.",
    "",
    "**This block should let you answer, without asking:** which branch to start from and how to name it, which branch to open the pull request against, what a push to each branch role produces, how to cut each package type and how to verify it landed, and what specifically not to do when the quality gate blocks you.",
  ].filter((line) => line !== null);
  return lines.join("\n");
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

function writeOrCheck(path, blockBody, checkOnly) {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const result = applyBlock(existing, blockBody, {});
  if (result.error) {
    console.error(`${path}: ${result.error}`);
    return false;
  }
  if (!result.changed) {
    console.log(`${path}: up to date`);
    return true;
  }
  if (checkOnly) {
    console.error(`${path}: out of date — run without --check to regenerate`);
    return false;
  }
  writeFileSync(path, result.content);
  console.log(`${path}: updated`);
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = {
    language: args.language,
    branchModel: args["branch-model"] ?? "simple",
    mainBranch: args["main-branch"] ?? "main",
    integrationBranch: args["integration-branch"] ?? "develop",
    workBranchPattern: args["work-branch-pattern"] ?? "feature-*",
    image: args.image ?? "",
  };
  const checkOnly = args.check === "true";

  const readmePath = args.readme;
  const agentDocs = (args["agent-docs"] ?? "").split(",").filter(Boolean);

  let ok = true;
  if (readmePath) ok = writeOrCheck(readmePath, explainVoice(cfg), checkOnly) && ok;
  for (const path of agentDocs) ok = writeOrCheck(path, prescribeVoice(cfg), checkOnly) && ok;

  if (!ok) process.exitCode = 1;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
