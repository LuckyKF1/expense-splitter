import { test } from "node:test";
import assert from "node:assert/strict";

import { expensesCsv, settlementsCsv } from "../../frontend/js/export.js";

const backup = {
  group: { members: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] },
  expenses: [{
    id: 4, spent_at: "2026-11-18", description: '=HYPERLINK("https://example.com")',
    amount: 1000, paid_total: 900, unbalanced_by: -100,
    payers: [{ member_id: 1, amount: 900 }],
    shares: [{ member_id: 1, amount: 500 }, { member_id: 2, amount: 500 }],
  }],
  settlements: [{
    id: 3, from_name: "Bob", to_name: "Alice", amount: 100,
    paid_at: "2026-11-18", note: "bank", created_at: "2026-11-18T10:00:00Z",
  }],
};

test("expense CSV contains payer/share details and protects formula-like text", () => {
  const contents = expensesCsv(backup);
  assert.ok(contents.startsWith("\uFEFF"));
  assert.ok(contents.includes("'=HYPERLINK"));
  assert.ok(contents.includes('""name"":""Alice"",""amount"":900'));
  assert.ok(contents.includes('""name"":""Bob"",""amount"":500'));
  assert.ok(contents.includes('"-100"'));
});

test("settlement CSV includes transfer parties, amounts and notes", () => {
  const contents = settlementsCsv(backup);
  assert.ok(contents.includes('"Bob","Alice","100","2026-11-18","bank"'));
});
