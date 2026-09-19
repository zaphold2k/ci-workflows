import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBlock,
  explainVoice,
  prescribeVoice,
  START_MARKER,
  END_MARKER,
} from "./render-docs.mjs";

test("applyBlock inserts markers into a file that has none, keeping existing content", () => {
  const result = applyBlock("# My project\n\nSome intro text.\n", "BLOCK BODY");
  assert.equal(result.changed, true);
  assert.match(result.content, /# My project/);
  assert.match(result.content, /Some intro text\./);
  assert.match(result.content, new RegExp(`${START_MARKER}\nBLOCK BODY\n${END_MARKER}`));
});

test("applyBlock replaces only the content between existing markers", () => {
  const original = `# Title\n\nIntro.\n\n${START_MARKER}\nOLD BLOCK\n${END_MARKER}\n\nOutro.\n`;
  const result = applyBlock(original, "NEW BLOCK");
  assert.equal(result.changed, true);
  assert.match(result.content, /# Title/);
  assert.match(result.content, /Intro\./);
  assert.match(result.content, /Outro\./);
  assert.match(result.content, /NEW BLOCK/);
  assert.doesNotMatch(result.content, /OLD BLOCK/);
});

test("applyBlock is idempotent: regenerating identical content changes nothing", () => {
  const first = applyBlock("# Title\n", "SAME BODY");
  const second = applyBlock(first.content, "SAME BODY");
  assert.equal(second.changed, false);
  assert.equal(second.content, first.content);
});

test("applyBlock refuses to write when a marker is duplicated", () => {
  const broken = `${START_MARKER}\nA\n${END_MARKER}\n\n${START_MARKER}\nB\n${END_MARKER}\n`;
  const result = applyBlock(broken, "NEW");
  assert.ok(result.error);
  assert.match(result.error, /2 start marker/);
});

test("applyBlock refuses to write when only one marker is present", () => {
  const broken = `${START_MARKER}\nA\n`;
  const result = applyBlock(broken, "NEW");
  assert.ok(result.error);
  assert.match(result.error, /1 start marker/);
  assert.match(result.error, /0 end marker/);
});

test("applyBlock refuses to write when the markers are out of order", () => {
  const broken = `${END_MARKER}\n${START_MARKER}\n`;
  const result = applyBlock(broken, "NEW");
  assert.ok(result.error);
});

const cfg = {
  language: "node",
  branchModel: "full",
  mainBranch: "main",
  integrationBranch: "develop",
  workBranchPattern: "feature-*",
  image: "ghcr.io/org/app",
};

test("explainVoice and prescribeVoice describe the same branch model and transitions", () => {
  const explain = explainVoice(cfg);
  const prescribe = prescribeVoice(cfg);
  for (const text of [explain, prescribe]) {
    assert.match(text, /develop/);
    assert.match(text, /feature-\*/);
    assert.match(text, /rc/);
  }
});

test("prescribeVoice states the override label is a human decision", () => {
  const text = prescribeVoice(cfg);
  assert.match(text, /human/i);
  assert.match(text, /ci-ratchet-override/);
});

test("explainVoice and prescribeVoice adapt to the simple model with no integration branch", () => {
  const simpleCfg = { ...cfg, branchModel: "simple" };
  const explain = explainVoice(simpleCfg);
  const prescribe = prescribeVoice(simpleCfg);
  assert.doesNotMatch(explain, /rc/);
  assert.doesNotMatch(prescribe, /rc/);
});
