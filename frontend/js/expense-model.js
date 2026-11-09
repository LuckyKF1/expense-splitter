// Pure logic behind the expense form (no DOM), tested with node --test.
// The form keeps raw typed strings; these functions interpret them.

import { parseKip, splitEqually } from "./format.js";

const MAX_AMOUNT = 100_000_000_000; // mirrors backend/expenses.py MAX_AMOUNT

const fail = (key, field, params = {}) => ({ error: { key, params, field } });

function parseAmount(text) {
  const value = parseKip(text);
  return value !== null && value >= 1 && value <= MAX_AMOUNT ? value : null;
}

/**
 * Turn raw form values into the API payload, or the first problem found.
 * Unbalanced payers are allowed on purpose: the brief wants mismatches
 * recorded and reported, never silently corrected or blocked.
 *
 * form = { description, amount, spentAt, participants: [id],
 *          payers: [{ memberId, name, amount: "typed text" }] }
 */
export function buildExpense(form) {
  const description = form.description.trim();
  if (!description) {
    return fail("reason.required", "description", { fieldKey: "field.description" });
  }
  const amount = parseAmount(form.amount);
  if (amount === null) return fail("form.invalidAmount", "amount");

  const payers = [];
  for (const payer of form.payers) {
    if (!payer.amount.trim()) continue;
    const value = parseKip(payer.amount);
    if (value === null || value > MAX_AMOUNT) {
      return fail("form.invalidPayerAmount", "payers", { name: payer.name });
    }
    if (value > 0) payers.push({ member_id: payer.memberId, amount: value });
  }
  if (payers.length === 0) return fail("form.needPayer", "payers");
  if (form.participants.length === 0) return fail("form.needParticipant", "participants");

  return {
    expense: {
      description, amount, spent_at: form.spentAt, payers,
      participants: [...form.participants],
    },
  };
}

/** Live "paid X of Y" line. Null while any typed number is not valid yet. */
export function paymentStatus(totalText, payerTexts) {
  const total = parseAmount(totalText);
  if (total === null) return null;
  let paid = 0;
  for (const text of payerTexts) {
    if (!text.trim()) continue;
    const value = parseKip(text);
    if (value === null) return null;
    paid += value;
  }
  return { total, paid, difference: paid - total };
}

/** Live per-person preview; the server stores the authoritative shares. */
export function sharePreview(totalText, participantIds) {
  const total = parseAmount(totalText);
  if (total === null || participantIds.length === 0) return null;
  return {
    each: Math.floor(total / participantIds.length),
    remainder: total % participantIds.length,
    shares: splitEqually(total, participantIds),
  };
}
