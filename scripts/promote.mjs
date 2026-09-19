/**
 * Promotes an already-published, already-verified image to the stable
 * release tags by composing a new manifest list on top of the same blobs —
 * a registry operation, not a rebuild, so it never re-pays emulated arm64
 * compilation and guarantees the stable image is exactly what was tested.
 *
 * Usage:
 *   node promote.mjs --image ghcr.io/org/app --source-tag 1.4.0-rc.2 \
 *     --target-tags 1.4.0,1.4,1,latest --dry-run false
 */
import { execFileSync } from "node:child_process";

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

/** @returns {string[]} the argv for `docker buildx imagetools create`, source last. */
export function buildImagetoolsCreateArgs({ image, sourceDigest, targetTags }) {
  const args = ["buildx", "imagetools", "create"];
  for (const tag of targetTags) args.push("--tag", `${image}:${tag}`);
  args.push(`${image}@${sourceDigest}`);
  return args;
}

function resolveDigest(image, sourceTag) {
  const ref = `${image}:${sourceTag}`;
  try {
    const digest = execFileSync(
      "docker",
      ["buildx", "imagetools", "inspect", ref, "--format", "{{.Manifest.Digest}}"],
      {
        encoding: "utf8",
      },
    ).trim();
    if (!digest.startsWith("sha256:")) throw new Error(`unexpected inspect output: ${digest}`);
    return digest;
  } catch (error) {
    throw new Error(`Could not resolve a digest for ${ref}: ${error.message}`, { cause: error });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const image = args.image;
  const sourceTag = args["source-tag"];
  const targetTags = (args["target-tags"] ?? "").split(",").filter(Boolean);
  const dryRun = args["dry-run"] === "true";

  const sourceDigest = resolveDigest(image, sourceTag);
  console.log(`Promoting ${image}:${sourceTag} (${sourceDigest}) to: ${targetTags.join(", ")}`);

  if (dryRun) {
    console.log("[dry-run] not creating the manifest list.");
    return;
  }

  const createArgs = buildImagetoolsCreateArgs({ image, sourceDigest, targetTags });
  execFileSync("docker", createArgs, { stdio: "inherit" });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
