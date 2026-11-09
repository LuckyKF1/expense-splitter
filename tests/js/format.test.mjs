// Run: node --test "tests/js/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatKip, parseKip, splitEqually, todayIso } from "../../frontend/js/format.js";

const NBSP = "\u00a0";

test("formatKip keeps the Kip sign on the same line", () => {
  assert.ok(formatKip(5).includes(NBSP));
});

test("formatKip groups thousands and adds the Kip sign", () => {
  assert.equal(formatKip(1180000), `1,180,000${NBSP}₭`);
  assert.equal(formatKip(0), `0${NBSP}₭`);
  assert.equal(formatKip(999), `999${NBSP}₭`);
  assert.equal(formatKip(100000000000), `100,000,000,000${NBSP}₭`);
});

test("formatKip shows negatives with a real minus sign", () => {
  assert.equal(formatKip(-168571), `−168,571${NBSP}₭`);
});

test("formatKip can show an explicit plus for balances", () => {
  assert.equal(formatKip(511428, { signed: true }), `+511,428${NBSP}₭`);
  assert.equal(formatKip(0, { signed: true }), `0${NBSP}₭`);
});

test("parseKip accepts digits with separators and spaces", () => {
  assert.equal(parseKip("1180000"), 1180000);
  assert.equal(parseKip("1,180,000"), 1180000);
  assert.equal(parseKip(" 1 180 000 "), 1180000);
  assert.equal(parseKip("1.180.000"), null); // ambiguous: decimal or grouping?
});

test("parseKip accepts Lao digits", () => {
  assert.equal(parseKip("໑໑໘໐໐໐໐"), 1180000);
  assert.equal(parseKip("໑,໐໐໐"), 1000);
});

test("parseKip rejects anything that is not whole Kip", () => {
  for (const bad of ["", "   ", "abc", "12.5", "-5000", "1e6", "0x10", "1,,000", ","]) {
    assert.equal(parseKip(bad), null, JSON.stringify(bad));
  }
});

test("parseKip rejects numbers JavaScript cannot represent exactly", () => {
  assert.equal(parseKip("9007199254740993"), null);
});

test("splitEqually mirrors the backend rule (preview only)", () => {
  assert.deepEqual(splitEqually(1180000, [7, 3, 1, 2, 4, 5, 6]), new Map([
    [1, 168572], [2, 168572], [3, 168572],
    [4, 168571], [5, 168571], [6, 168571], [7, 168571],
  ]));
  assert.deepEqual(splitEqually(100, []), new Map());
});

test("todayIso uses the local date, not UTC", () => {
  // 00:30 on Nov 10 in Laos (UTC+7) is still Nov 9 in UTC.
  const lateNight = new Date(2026, 10, 10, 0, 30);
  assert.equal(todayIso(lateNight), "2026-11-10");
});
