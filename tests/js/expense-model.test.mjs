import { test } from "node:test";
import assert from "node:assert/strict";

import { buildExpense, paymentStatus, sharePreview } from "../../frontend/js/expense-model.js";
import { formatDate } from "../../frontend/js/format.js";

const form = (overrides = {}) => ({
  description: "Dinner",
  amount: "300,000",
  spentAt: "2026-11-09",
  payers: [{ memberId: 1, name: "luck", amount: "300000" }, { memberId: 2, name: "fy", amount: "" }],
  participants: [1, 2, 3],
  ...overrides,
});

test("buildExpense produces the API payload", () => {
  assert.deepEqual(buildExpense(form()), {
    expense: {
      description: "Dinner", amount: 300000, spent_at: "2026-11-09",
      payers: [{ member_id: 1, amount: 300000 }], participants: [1, 2, 3],
    },
  });
});

test("buildExpense keeps multiple payers and ignores blank or zero amounts", () => {
  const { expense } = buildExpense(form({ payers: [
    { memberId: 1, name: "luck", amount: "200,000" },
    { memberId: 2, name: "fy", amount: "0" },
    { memberId: 3, name: "no", amount: "໑໐໐໐໐໐" }, // Lao digits
  ] }));
  assert.deepEqual(expense.payers, [{ member_id: 1, amount: 200000 }, { member_id: 3, amount: 100000 }]);
});

test("buildExpense reports the first problem with a translatable key", () => {
  assert.deepEqual(buildExpense(form({ description: "  " })).error,
    { key: "reason.required", params: { fieldKey: "field.description" }, field: "description" });
  assert.deepEqual(buildExpense(form({ amount: "12.5" })).error,
    { key: "form.invalidAmount", params: {}, field: "amount" });
  assert.deepEqual(buildExpense(form({ amount: "0" })).error,
    { key: "form.invalidAmount", params: {}, field: "amount" });
  assert.deepEqual(buildExpense(form({ payers: [{ memberId: 1, name: "luck", amount: "abc" }] })).error,
    { key: "form.invalidPayerAmount", params: { name: "luck" }, field: "payers" });
  assert.deepEqual(buildExpense(form({ payers: [{ memberId: 1, name: "luck", amount: "" }] })).error,
    { key: "form.needPayer", params: {}, field: "payers" });
  assert.deepEqual(buildExpense(form({ participants: [] })).error,
    { key: "form.needParticipant", params: {}, field: "participants" });
});

test("buildExpense allows an unbalanced expense (reported, not blocked)", () => {
  const { expense } = buildExpense(form({ payers: [{ memberId: 1, name: "luck", amount: "290000" }] }));
  assert.equal(expense.amount - expense.payers[0].amount, 10000);
});

test("paymentStatus compares typed payer amounts with the total", () => {
  assert.deepEqual(paymentStatus("1,180,000", ["680000", "220000", "195000", "30000", "45000", ""]),
    { total: 1180000, paid: 1170000, difference: -10000 });
  assert.deepEqual(paymentStatus("100", ["100"]), { total: 100, paid: 100, difference: 0 });
  assert.equal(paymentStatus("abc", ["100"]), null);       // total not valid yet
  assert.equal(paymentStatus("100", ["1x"]), null);        // a payer amount not valid yet
});

test("sharePreview explains the equal split and the leftover Kip", () => {
  assert.deepEqual(sharePreview("1,180,000", [1, 2, 3, 4, 5, 6, 7]),
    { each: 168571, remainder: 3, shares: new Map([[1, 168572], [2, 168572], [3, 168572],
      [4, 168571], [5, 168571], [6, 168571], [7, 168571]]) });
  assert.equal(sharePreview("1000", []), null);
  assert.equal(sharePreview("", [1]), null);
});

test("formatDate shows a readable local date", () => {
  assert.equal(formatDate("2026-11-09", "en"), "9 Nov 2026");
});

test("formatDate writes Lao months itself (many browsers lack Lao Intl data)", () => {
  // Simulate Chrome: no Lao locale data, so "lo" silently falls back to English.
  const RealDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (locale, options) {
    const usable = String(locale).startsWith("lo") ? "en-US" : locale;
    return new RealDateTimeFormat(usable, options);
  };
  try {
    assert.equal(formatDate("2026-11-09", "lo"), "9 ພ.ຈ. 2026");
    assert.equal(formatDate("2026-01-31", "lo"), "31 ມ.ກ. 2026");
    assert.equal(formatDate("2026-12-01", "lo"), "1 ທ.ວ. 2026");
  } finally {
    Intl.DateTimeFormat = RealDateTimeFormat;
  }
});
