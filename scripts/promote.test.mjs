import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImagetoolsCreateArgs } from "./promote.mjs";

test("buildImagetoolsCreateArgs tags every target against the source digest", () => {
  const args = buildImagetoolsCreateArgs({
    image: "ghcr.io/org/app",
    sourceDigest: "sha256:abc123",
    targetTags: ["1.4.0", "1.4", "1", "latest"],
  });
  assert.deepEqual(args, [
    "buildx",
    "imagetools",
    "create",
    "--tag",
    "ghcr.io/org/app:1.4.0",
    "--tag",
    "ghcr.io/org/app:1.4",
    "--tag",
    "ghcr.io/org/app:1",
    "--tag",
    "ghcr.io/org/app:latest",
    "ghcr.io/org/app@sha256:abc123",
  ]);
});
