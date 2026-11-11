import { test } from "node:test";
import assert from "node:assert/strict";

import { whileBusy } from "../../frontend/js/dom.js";

// Over a slow tunnel a second tap can arrive before the first save returns;
// without a guard that records the same payment twice.

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("whileBusy disables the button until the action finishes", async () => {
  const button = { disabled: false };
  const pending = deferred();
  const running = whileBusy(button, () => pending.promise);
  assert.equal(button.disabled, true);
  pending.resolve("saved");
  assert.equal(await running, "saved");
  assert.equal(button.disabled, false);
});

test("whileBusy ignores a second tap while the first is still saving", async () => {
  const button = { disabled: false };
  const pending = deferred();
  let calls = 0;
  const action = () => { calls += 1; return pending.promise; };
  const first = whileBusy(button, action);
  const second = whileBusy(button, action);
  pending.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("whileBusy re-enables the button and passes on the error when saving fails", async () => {
  const button = { disabled: false };
  await assert.rejects(
    whileBusy(button, async () => { throw new Error("offline"); }),
    /offline/,
  );
  assert.equal(button.disabled, false);
});
