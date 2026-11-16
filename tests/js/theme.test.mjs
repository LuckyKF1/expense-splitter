import { test } from "node:test";
import assert from "node:assert/strict";

import { getTheme, nextTheme, setTheme } from "../../frontend/js/theme.js";

function fakeBrowser() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  globalThis.document = { documentElement: { dataset: {} } };
  return { store, root: globalThis.document.documentElement };
}

test("the theme button cycles automatic -> light -> dark -> automatic", () => {
  assert.equal(nextTheme("auto"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "auto");
  assert.equal(nextTheme("nonsense"), "light");
});

test("without a saved choice the theme follows the device", () => {
  fakeBrowser();
  assert.equal(getTheme(), "auto");
});

test("choosing a theme saves it and marks <html> for the CSS", () => {
  const { store, root } = fakeBrowser();
  setTheme("dark");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(getTheme(), "dark");
  // Same key and JSON format the inline script in index.html reads.
  assert.equal(store.get("expense-splitter:theme"), '"dark"');
  setTheme("auto");
  assert.equal(root.dataset.theme, undefined);
  assert.equal(getTheme(), "auto");
});

test("a broken saved value falls back to automatic", () => {
  const { store } = fakeBrowser();
  store.set("expense-splitter:theme", '"purple"');
  assert.equal(getTheme(), "auto");
});
