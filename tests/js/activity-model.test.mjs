import { test } from "node:test";
import assert from "node:assert/strict";

import { activityChanges } from "../../frontend/js/activity-model.js";

const expense = (overrides = {}) => ({
  id: 7, description: "Dinner", amount: 300000, spent_at: "2026-11-18",
  payers: [{ member_id: 1, amount: 300000 }],
  shares: [{ member_id: 1, amount: 150000 }, { member_id: 2, amount: 150000 }],
  paid_total: 300000, unbalanced_by: 0, created_at: "x", updated_at: "x", ...overrides,
});

test("an update lists only the fields that changed, in a fixed order", () => {
  const changes = activityChanges({
    action: "updated", entity_type: "expense",
    before: expense(),
    after: expense({ amount: 320000, payers: [{ member_id: 1, amount: 320000 }], updated_at: "y" }),
  });
  assert.deepEqual(changes.map((c) => [c.field, c.kind, c.before, c.after]), [
    ["amount", "money", 300000, 320000],
    ["payers", "lines", [{ member_id: 1, amount: 300000 }], [{ member_id: 1, amount: 320000 }]],
  ]);
});

test("share amounts that only follow a new total are not reported as a change of people", () => {
  const changes = activityChanges({
    action: "updated", entity_type: "expense",
    before: expense(),
    after: expense({ amount: 400000, payers: [{ member_id: 1, amount: 400000 }],
      shares: [{ member_id: 1, amount: 200000 }, { member_id: 2, amount: 200000 }] }),
  });
  assert.deepEqual(changes.map((c) => c.field), ["amount", "payers"]);
});

test("created and deleted entries list the values that were set", () => {
  const created = activityChanges({ action: "created", entity_type: "member", after: { id: 3, name: "Noy", archived: false } });
  assert.deepEqual(created.map((c) => [c.field, c.after]), [["name", "Noy"]]);
  const deleted = activityChanges({
    action: "deleted", entity_type: "settlement",
    before: { id: 1, from_name: "Noy", to_name: "Luck", amount: 5000, paid_at: "2026-11-18", note: "" },
  });
  assert.deepEqual(deleted.map((c) => [c.field, c.before]),
    [["from_name", "Noy"], ["to_name", "Luck"], ["amount", 5000], ["paid_at", "2026-11-18"]]);
});

test("archiving a member and changing the Admin are readable changes", () => {
  assert.deepEqual(activityChanges({
    action: "updated", entity_type: "member",
    before: { id: 3, name: "Noy", archived: false }, after: { id: 3, name: "Noy", archived: true },
  }).map((c) => [c.field, c.kind, c.before, c.after]), [["archived", "bool", false, true]]);
  assert.deepEqual(activityChanges({
    action: "updated", entity_type: "group",
    before: { admin_member_id: null, admin_name: null }, after: { admin_member_id: 3, admin_name: "Noy" },
  }).map((c) => [c.field, c.before, c.after]), [["admin_name", null, "Noy"]]);
});

test("unknown entity types and missing snapshots give no changes", () => {
  assert.deepEqual(activityChanges({ action: "updated", entity_type: "planet", before: {}, after: {} }), []);
  assert.deepEqual(activityChanges({ action: "deleted", entity_type: "expense" }), []);
});
