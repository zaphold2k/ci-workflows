import { test } from "node:test";
import assert from "node:assert/strict";
import { greet, add } from "./app.mjs";

test("greet formats a greeting", () => {
  assert.equal(greet("world"), "Hello, world!");
});

test("add sums two numbers", () => {
  assert.equal(add(2, 3), 5);
});
