// Expense list and the full expense form, using the brief's example trip.
import { addMembers, BRIEF_PEOPLE } from "../seed.mjs";

export const description = "expense list and form (several payers, unbalanced, edit, delete)";

export async function setup(api) {
  await addMembers(api, [...BRIEF_PEOPLE, "old"], { archived: ["old"] });
  return {};
}

export async function run({ token, open, evaluate, waitFor, screenshot, text, check, assert }) {
  const base = `/g/${token}/expenses`;
  const set = (selector, value) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur'));
  })()`);
  const memberId = (name) => evaluate(`fetch('/api/groups/${token}').then(r => r.json())
    .then(g => g.members.find(m => m.name === ${JSON.stringify(name)}).id)`);
  const formError = () => evaluate("document.querySelector('.form-error').textContent");
  const status = () => evaluate("document.querySelectorAll('.form-status')[0].textContent");
  const preview = () => evaluate("document.querySelectorAll('.form-status')[1].textContent");
  const save = () => evaluate("document.querySelector('.form-card').requestSubmit()");

  await check("empty list shows an add button", async () => {
    await open(base);
    assert((await text(".state-card a")).length === 1, "no add button");
    await screenshot("6b-empty-360");
  });

  await check("form defaults: today's date, everyone active selected, no payers", async () => {
    await open(`${base}/new`);
    const checked = await evaluate("[...document.querySelectorAll('.chip-input')].filter(c => c.checked).length");
    const inactiveShown = await evaluate("[...document.querySelectorAll('.chip-name')].some(e => e.textContent === 'old')");
    assert(checked > 0 && !inactiveShown, `checked=${checked}, inactive shown=${inactiveShown}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(await evaluate("document.querySelector('#expense-date').value")), "date");
  });

  await check("client-side validation explains what is missing", async () => {
    await save();
    assert((await formError()).includes("Description"), await formError());
    await set("#expense-description", "Trip total");
    await set("#expense-amount", "12.5");
    await save();
    assert((await formError()).includes("whole Kip"), await formError());
    await set("#expense-amount", "1180000");
    await save();
    assert((await formError()).includes("paid"), await formError());
  });

  await check("amount is reformatted with separators on blur", async () => {
    const value = await evaluate("document.querySelector('#expense-amount').value");
    assert(value === "1,180,000", value);
  });

  await check("live share preview with the remainder note (7 people)", async () => {
    const ids = await evaluate("[...document.querySelectorAll('.chip-input')].map(c => c.value)");
    assert(ids.length >= 6, JSON.stringify(ids));
    const text = await preview();
    assert(text.includes("each"), text);
  });

  await check("payment status shows the 10,000 shortfall from the brief", async () => {
    await evaluate("document.querySelector('.btn-link').click()"); // "Several people paid"
    const payments = { luck: "680,000", fy: "220,000", no: "195,000", Lar: "30000", saeng: "໔໕໐໐໐" };
    for (const [name, amount] of Object.entries(payments)) {
      await set(`#payer-${await memberId(name)}`, amount);
    }
    const line = await status();
    assert(line.includes("1,170,000") && line.includes("10,000") && line.includes("missing"), line);
    await screenshot("6b-form-360");
  });

  await check("'Paid all' fills one payer and clears the rest", async () => {
    const bick = await memberId("bick");
    await evaluate(`document.querySelector('#payer-${bick}').closest('li').querySelector('button').click()`);
    const values = await evaluate("[...document.querySelectorAll('.payer-row .input')].map(i => i.value)");
    assert(values.filter(Boolean).length === 1 && values.includes("1,180,000"), JSON.stringify(values));
    assert((await status()).includes("match"), await status());
  });

  await check("saving an unbalanced expense asks first, then shows a warning in the list", async () => {
    const bick = await memberId("bick");
    await set(`#payer-${bick}`, "");
    for (const [name, amount] of Object.entries({ luck: "680000", fy: "220000", no: "195000", Lar: "30000", saeng: "45000" })) {
      await set(`#payer-${await memberId(name)}`, amount);
    }
    await save(); // confirm() is auto-accepted by the driver
    await waitFor(`location.pathname === ${JSON.stringify(base)} && document.querySelector('.expense-row')`);
    const badge = await text(".expense-row .badge-warning");
    assert(badge[0]?.includes("10,000") && badge[0]?.includes("missing"), JSON.stringify(badge));
    await screenshot("6b-list-360");
  });

  await check("edit: fix the shortfall, warning disappears", async () => {
    await evaluate("document.querySelector('.expense-row').click()");
    await waitFor("document.querySelector('.form-card') && document.querySelector('#expense-description').value === 'Trip total'");
    const bick = await memberId("bick");
    await set(`#payer-${bick}`, "10,000");
    assert((await status()).includes("match"), await status());
    await save();
    await waitFor(`location.pathname === ${JSON.stringify(base)} && document.querySelector('.expense-row')`);
    assert((await text(".expense-row .badge-warning")).length === 0, "warning still shown");
  });

  await check("server stored the shares (sum equals amount)", async () => {
    const expenses = await evaluate(`fetch('/api/groups/${token}/expenses').then(r => r.json())`);
    const e = expenses[0];
    const sum = e.shares.reduce((s, x) => s + x.amount, 0);
    assert(sum === 1180000 && e.unbalanced_by === 0, JSON.stringify({ sum, ub: e.unbalanced_by }));
  });

  await check("desktop shows a real table with headers", async () => {
    await open(base, 1280, 700);
    const headers = await text(".expense-table th");
    assert(headers.length === 5, JSON.stringify(headers));
    await screenshot("6b-list-1280");
    await open(`${base}/new`, 1280, 1000);
    await screenshot("6b-form-1280");
  });

  await check("delete from the edit screen", async () => {
    await evaluate(`fetch('/api/groups/${token}/expenses', { method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ description: 'Coffee', amount: 30000, spent_at: '2026-11-10',
        payers: [{ member_id: ${await memberId("fy")}, amount: 30000 }], participants: [${await memberId("fy")}] }) })`);
    await open(base);
    const before = (await text(".row-link")).length;
    await evaluate("[...document.querySelectorAll('.expense-row')].find(r => r.textContent.includes('Coffee')).click()");
    await waitFor("document.querySelector('.btn-danger')");
    await evaluate("document.querySelector('.form-actions .btn-danger').click()");
    await waitFor(`location.pathname === ${JSON.stringify(base)} && document.querySelectorAll('.row-link').length === ${before - 1}`);
  });

  await check("no horizontal overflow at 360px on list and form", async () => {
    for (const path of [base, `${base}/new`]) {
      await open(path, 360, 780);
      const overflow = await evaluate("document.documentElement.scrollWidth - window.innerWidth");
      assert(overflow <= 0, `${path} overflows by ${overflow}px`);
    }
  });
}
