// Money and date helpers. Pure functions (no DOM), tested with node --test.
// All amounts are integers in whole Kip, exactly like the backend.

const LAO_DIGITS = "໐໑໒໓໔໕໖໗໘໙";

/** 1180000 -> "1,180,000" (no sign, no currency). */
export function groupDigits(amount) {
  return String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 1180000 -> "1,180,000 ₭"; negatives use a real minus sign (−). */
export function formatKip(amount, { signed = false } = {}) {
  const digits = groupDigits(amount);
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

/** "2026-11-09" -> "9 Nov 2026" (en) or the Lao equivalent. */
export function formatDate(iso, lang) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local midnight, no UTC shift
  return new Intl.DateTimeFormat(lang === "lo" ? "lo-LA" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date). */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
