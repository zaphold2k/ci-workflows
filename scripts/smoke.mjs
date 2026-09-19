/**
 * Starts a built image, waits for its declared endpoint to respond, and
 * fails loudly with the container's logs if it never does — the only
 * verification a repository gets before its image is published.
 *
 * Usage:
 *   node smoke.mjs --image local/verify:sha --port 8080 \
 *     --endpoint http://localhost:8080/health --timeout 60
 */
import { execFileSync, spawnSync } from "node:child_process";

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

/** @returns {string[]} `docker run` argv for the smoke-test container. */
export function buildRunArgs({ image, port, env }) {
  const args = ["run", "-d", "--rm", "-p", `${port}:${port}`];
  for (const [key, value] of Object.entries(env ?? {})) {
    args.push("-e", `${key}=${value}`);
  }
  args.push(image);
  return args;
}

async function waitForEndpoint(endpoint, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const image = args.image;
  const port = args.port ?? "8080";
  const endpoint = args.endpoint;
  const timeout = Number(args.timeout ?? "60");
  const env = JSON.parse(process.env.SMOKE_TEST_ENV ?? "{}");

  const containerId = execFileSync("docker", buildRunArgs({ image, port, env }), {
    encoding: "utf8",
  }).trim();

  try {
    const ok = await waitForEndpoint(endpoint, timeout);
    if (!ok) {
      console.error(`${endpoint} did not respond within ${timeout}s. Container logs:`);
      spawnSync("docker", ["logs", containerId], { stdio: "inherit" });
      process.exitCode = 1;
      return;
    }
    console.log(`${endpoint} responded within the ${timeout}s limit.`);
  } finally {
    spawnSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
