// Worst-case content on a 360px phone: 50-character names with no spaces,
// the largest allowed amount, and a 30-person group. Nothing may push the
// page wider than the screen (sideways scrolling on a phone).
import { addMembers } from "../seed.mjs";

export const description = "long names, huge amounts, big groups on a phone";

const LONG_LATIN = "Bounmy".repeat(8) + "xx";            // 50 chars, no spaces
const LONG_LAO = "ສົມພອນ".repeat(8) + "ສົມ";               // 51 code points -> trimmed below
const MAX_AMOUNT = 100_000_000_000;

export async function setup(api) {
  const others = Array.from({ length: 27 }, (_, i) => `friend${i + 1}`);
  const ids = await addMembers(api, [LONG_LATIN, LONG_LAO.slice(0, 50), "luck", ...others]);
  const everyone = Object.values(ids);
  await api("/expenses", "POST", {
    description: "ຄ່າເຊົ່າເຮືອນພັກ ".repeat(12).trim().slice(0, 200), amount: MAX_AMOUNT, spent_at: "2026-11-16",
    payers: [{ member_id: ids[LONG_LATIN], amount: MAX_AMOUNT }], participants: everyone });
  await api("/expenses", "POST", {
    description: "x".repeat(200), amount: MAX_AMOUNT - 1, spent_at: "2026-11-15",
    payers: [{ member_id: ids[LONG_LAO.slice(0, 50)], amount: MAX_AMOUNT - 2 }], participants: everyone });
  return { ids };
}

export async function run({ token, api, ids, open, evaluate, check, assert, screenshot }) {
  const g = `/g/${token}`;
  const pages = { summary: g, expenses: `${g}/expenses`, form: `${g}/expenses/new`,
    settle: `${g}/settle`, members: `${g}/members`, activity: `${g}/activity` };

  // Which elements stick out past the right edge (for a useful failure message).
  const overflow = () => evaluate(`(() => {
    const width = document.documentElement.clientWidth;
    const out = [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > width + 1 && el.getClientRects().length)
      .filter(el => !el.closest('[hidden]'));
    // Also anything poking out of its card (the page may still fit).
    const scrolls = (el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX);
    for (const el of document.querySelectorAll('.card *, .stat *')) {
      const box = el.parentElement.closest('.card, .stat, .table-scroll');
      if (!box || scrolls(box) || !el.getClientRects().length || el.closest('[hidden]')) continue;
      if (el.getBoundingClientRect().right > box.getBoundingClientRect().right + 1) out.push(el);
    }
    const outermost = out.filter(el => !out.includes(el.parentElement));
    const describe = (el) => el.tagName.toLowerCase() + '.' + [...el.classList].join('.');
    return { scroll: Math.max(document.documentElement.scrollWidth - width, outermost.length ? 1 : 0),
      culprits: outermost.slice(0, 4).map(describe) };
  })()`);

  for (const [name, path] of Object.entries(pages)) {
    for (const lang of ["en", "lo"]) {
      await check(`${name} (${lang}) fits a 360px screen`, async () => {
        await evaluate(`localStorage.setItem('expense-splitter:lang', JSON.stringify('${lang}'))`);
        await open(path, 360, 780);
        const { scroll, culprits } = await overflow();
        await screenshot(`edge-${name}-${lang}-360`);
        assert(scroll <= 0, `page is ${scroll}px too wide; sticking out: ${JSON.stringify(culprits)}`);
      });
    }
  }
  await evaluate("localStorage.removeItem('expense-splitter:lang')");

  for (const [width, height] of [[768, 1024], [1024, 768], [1280, 800]]) {
    await check(`every page fits at ${width}px`, async () => {
      for (const [name, path] of Object.entries(pages)) {
        await open(path, width, height);
        const { scroll, culprits } = await overflow();
        await screenshot(`edge-${name}-${width}`);
        assert(scroll <= 0, `${name} is ${scroll}px too wide; sticking out: ${JSON.stringify(culprits)}`);
      }
    });
  }

  await check("largest amount is shown exactly with separators", async () => {
    await open(pages.expenses, 360, 780);
    const text = await evaluate("document.body.textContent");
    assert(text.includes("100,000,000,000 ₭") && text.includes("99,999,999,999 ₭"), "amounts not shown exactly");
  });

  await check("unbalanced by 1 Kip on a 100-billion bill is still reported", async () => {
    const summary = await api("/summary");
    assert(summary.unbalanced_expenses.length === 1 && summary.balance_total === -1,
      JSON.stringify(summary.unbalanced_expenses));
  });

  await check("date pickers only offer 2000-2099", async () => {
    await open(pages.form, 360, 780);
    const range = await evaluate("[document.getElementById('expense-date').min, document.getElementById('expense-date').max]");
    assert(JSON.stringify(range) === '["2000-01-01","2099-12-31"]', JSON.stringify(range));
  });
}
