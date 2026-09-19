import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRunArgs } from "./smoke.mjs";

test("buildRunArgs publishes the declared port and forwards env vars", () => {
  const args = buildRunArgs({ image: "local/verify:sha", port: "8080", env: { NODE_ENV: "test" } });
  assert.deepEqual(args, [
    "run",
    "-d",
    "--rm",
    "-p",
    "8080:8080",
    "-e",
    "NODE_ENV=test",
    "local/verify:sha",
  ]);
});

test("buildRunArgs works with no env vars declared", () => {
  const args = buildRunArgs({ image: "local/verify:sha", port: "3000" });
  assert.deepEqual(args, ["run", "-d", "--rm", "-p", "3000:3000", "local/verify:sha"]);
});
