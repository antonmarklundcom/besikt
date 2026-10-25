import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoginThrottle } from "./login-throttle";

const NOW = 1_700_000_000_000;

test("blocks an account after max failures", () => {
  const t = createLoginThrottle(3, 1000);
  for (let i = 0; i < 2; i++) t.recordFailure("a@x.com", NOW);
  assert.equal(t.isBlocked("a@x.com", NOW), false);
  t.recordFailure("a@x.com", NOW);
  assert.equal(t.isBlocked("a@x.com", NOW), true);
});

test("accounts are independent", () => {
  const t = createLoginThrottle(2, 1000);
  t.recordFailure("a@x.com", NOW);
  t.recordFailure("a@x.com", NOW);
  assert.equal(t.isBlocked("a@x.com", NOW), true);
  assert.equal(t.isBlocked("b@x.com", NOW), false);
});

test("a success reset clears the counter", () => {
  const t = createLoginThrottle(2, 1000);
  t.recordFailure("a@x.com", NOW);
  t.reset("a@x.com");
  t.recordFailure("a@x.com", NOW);
  assert.equal(t.isBlocked("a@x.com", NOW), false);
});

test("the block expires after the window", () => {
  const t = createLoginThrottle(1, 1000);
  t.recordFailure("a@x.com", NOW);
  assert.equal(t.isBlocked("a@x.com", NOW + 999), true);
  assert.equal(t.isBlocked("a@x.com", NOW + 1000), false);
});
