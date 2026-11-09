import { test } from "node:test";
import assert from "node:assert/strict";

import { MESSAGES, translate, errorMessage } from "../../frontend/js/i18n.js";

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("English and Lao define exactly the same keys", () => {
  const en = Object.keys(MESSAGES.en).sort();
  const lo = Object.keys(MESSAGES.lo).sort();
  assert.deepEqual(lo.filter((k) => !en.includes(k)), [], "only in Lao");
  assert.deepEqual(en.filter((k) => !lo.includes(k)), [], "missing in Lao");
});

test("translations use the same {placeholders}", () => {
  for (const key of Object.keys(MESSAGES.en)) {
    assert.deepEqual(placeholders(MESSAGES.lo[key]), placeholders(MESSAGES.en[key]), key);
  }
});

test("no translation is empty", () => {
  for (const lang of ["en", "lo"]) {
    for (const [key, text] of Object.entries(MESSAGES[lang])) {
      assert.ok(text.trim(), `${lang}.${key}`);
    }
  }
});

test("every backend error code and validation reason has a message", () => {
  const codes = ["GROUP_NOT_FOUND", "MEMBER_NOT_FOUND", "EXPENSE_NOT_FOUND",
    "SETTLEMENT_NOT_FOUND", "MEMBER_NAME_TAKEN", "MEMBER_IN_USE", "MEMBER_LIMIT_REACHED",
    "EXPENSE_LIMIT_REACHED", "SETTLEMENT_LIMIT_REACHED", "UNBALANCED_EXPENSES",
    "INVALID_JSON", "BODY_TOO_LARGE", "NOT_FOUND", "METHOD_NOT_ALLOWED",
    "INTERNAL_ERROR", "NETWORK_ERROR", "UNKNOWN_ERROR"];
  const reasons = ["required", "not_string", "too_long", "invalid_characters",
    "not_boolean", "no_changes", "not_integer", "out_of_range", "invalid_date",
    "not_list", "invalid_item", "duplicate_member", "unknown_member",
    "archived_member", "same_member"];
  const fields = ["name", "description", "amount", "spent_at", "payers",
    "participants", "paid_at", "note", "from_member_id", "to_member_id", "archived"];
  for (const code of codes) assert.ok(MESSAGES.en[`error.${code}`], code);
  for (const reason of reasons) assert.ok(MESSAGES.en[`reason.${reason}`], reason);
  for (const field of fields) assert.ok(MESSAGES.en[`field.${field}`], field);
});

test("translate fills placeholders and falls back to English, then the key", () => {
  assert.equal(translate("lo", "members.confirmDelete", { name: "ter" }),
    MESSAGES.lo["members.confirmDelete"].replace("{name}", "ter"));
  assert.equal(translate("xx", "action.save"), MESSAGES.en["action.save"]);
  assert.equal(translate("en", "no.such.key"), "no.such.key");
});

test("errorMessage explains validation errors using the field name", () => {
  const err = { code: "VALIDATION_ERROR", details: { field: "amount", reason: "required" } };
  const text = errorMessage("en", err);
  assert.ok(text.includes(MESSAGES.en["field.amount"]), text);
  assert.equal(errorMessage("en", { code: "GROUP_NOT_FOUND" }),
    MESSAGES.en["error.GROUP_NOT_FOUND"]);
  assert.equal(errorMessage("en", { code: "SOMETHING_NEW" }),
    MESSAGES.en["error.UNKNOWN_ERROR"]);
});
