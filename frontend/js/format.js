// Money and date helpers. Pure functions (no DOM), tested with node --test.
// All amounts are integers in whole Kip, exactly like the backend.

const LAO_DIGITS = "໐໑໒໓໔໕໖໗໘໙";

/** 1180000 -> "1,180,000 ₭"; negatives use a real minus sign (−). */
export function formatKip(amount, { signed = false } = {}) {
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
  return `${sign}${digits} ₭`;
}

/**
 * Parse what a person typed into a whole-Kip integer, or null if invalid.
 * Accepts "1180000", "1,180,000", "1 180 000" and Lao digits (໑໑໘...).
 * Rejects decimals, signs and "1.180.000" (ambiguous between locales).
 */
export function parseKip(text) {
  const latin = String(text)
    .trim()
    .replace(/[໐-໙]/g, (d) => String(LAO_DIGITS.indexOf(d)));
  if (!/^\d{1,3}(?:[, ]\d{3})*$|^\d+$/.test(latin)) return null;
  const value = Number(latin.replace(/[, ]/g, ""));
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Same rule as backend/expenses.py split_equally, used only to PREVIEW
 * shares while typing. The server recomputes and stores the real ones.
 */
export function splitEqually(amount, memberIds) {
  const shares = new Map();
  if (memberIds.length === 0) return shares;
  const ordered = [...memberIds].sort((a, b) => a - b);
  const base = Math.floor(amount / ordered.length);
  const remainder = amount % ordered.length;
  ordered.forEach((id, index) => shares.set(id, base + (index < remainder ? 1 : 0)));
  return shares;
}

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date). */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
