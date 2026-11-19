// Money and date helpers. Pure functions (no DOM), tested with node --test.
// All amounts are integers in whole Kip, exactly like the backend.

const LAO_DIGITS = "໐໑໒໓໔໕໖໗໘໙";

/** 1180000 -> "1,180,000" (no sign, no currency). */
export function groupDigits(amount) {
  return String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 1180000 -> "1,180,000 ₭"; negatives use a real minus sign (−).
 * The space is non-breaking so "₭" never wraps onto its own line.
 */
export function formatKip(amount, { signed = false } = {}) {
  const digits = groupDigits(amount);
  const sign = amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
  return `${sign}${digits}\u00a0₭`;
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

// Standard Lao month abbreviations (CLDR). Written out here because many
// browsers, including Chrome, ship no Lao Intl data and fall back to English.
const LAO_MONTHS = ["ມ.ກ.", "ກ.ພ.", "ມ.ນ.", "ມ.ສ.", "ພ.ພ.", "ມິ.ຖ.",
  "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ."];

/** "2026-11-09" -> "9 Nov 2026" (en) or "9 ພ.ຈ. 2026" (lo). */
export function formatDate(iso, lang) {
  const [year, month, day] = iso.split("-").map(Number);
  if (lang === "lo") return `${day} ${LAO_MONTHS[month - 1]} ${year}`;
  const date = new Date(year, month - 1, day); // local midnight, no UTC shift
  return new Intl.DateTimeFormat("en-GB",
    { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const LAO_WEEKDAYS = ["ວັນອາທິດ", "ວັນຈັນ", "ວັນອັງຄານ", "ວັນພຸດ", "ວັນພະຫັດ", "ວັນສຸກ", "ວັນເສົາ"];
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day heading: "Sat 14 Nov 2026" (en) or "ວັນເສົາ 14 ພ.ຈ. 2026" (lo). */
export function formatDay(iso, lang) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return `${(lang === "lo" ? LAO_WEEKDAYS : EN_WEEKDAYS)[weekday]} ${formatDate(iso, lang)}`;
}

/** Server timestamp (UTC, "2026-11-18T08:20:27Z") as local date and time. */
export function formatDateTime(iso, lang) {
  const moment = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${formatDate(todayIso(moment), lang)} ${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/** Dates the server accepts (backend/validation.py MIN_DATE/MAX_DATE). */
export const DATE_RANGE = { min: "2000-01-01", max: "2099-12-31" };

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date). */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
