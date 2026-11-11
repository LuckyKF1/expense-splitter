// The common case: one person paid. Amount -> description -> tap name -> Save.
import { addMembers } from "../seed.mjs";

export const description = "quick one-payer expense entry";

export async function setup(api) {
  await addMembers(api, ["luck", "fy", "no"]);
  return {};
}

export async function run({ token, open, evaluate, waitFor, screenshot, check, assert }) {
  const base = `/g/${token}/expenses`;
  const set = (selector, value) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const tapPayer = (name) => evaluate(`[...document.querySelectorAll('.fieldset')][0]
    .querySelectorAll('.chip').forEach(c => { if (c.textContent === ${JSON.stringify(name)}) c.click(); })`);

  await check("new expense: cursor starts in the amount field", async () => {
    await open(`${base}/new`);
    await waitFor("document.activeElement?.id === 'expense-amount'");
    assert(await evaluate("document.querySelectorAll('.payer-row').length > 0 && document.querySelector('.payer-list').closest('[hidden]') !== null"),
      "per-person amounts should start hidden");
    await screenshot("quick-form-360");
  });

  await check("forgetting the payer gives a clear hint", async () => {
    await set("#expense-amount", "458000");
    await set("#expense-description", "ອາຫານແລງ");
    await evaluate("document.querySelector('.form-card').requestSubmit()");
    const error = await evaluate("document.querySelector('.form-error').textContent");
    assert(error.includes("Tap the person"), error);
  });

  await check("tap one name and save: that person paid the whole amount", async () => {
    await tapPayer("fy");
    await evaluate("document.querySelector('.form-card').requestSubmit()");
    await waitFor(`location.pathname === ${JSON.stringify(base)}`);
    const e = (await evaluate(`fetch('/api/groups/${token}/expenses').then(r => r.json())`))
      .find((x) => x.description === "ອາຫານແລງ");
    assert(e.payers.length === 1 && e.payers[0].amount === 458000 && e.unbalanced_by === 0, JSON.stringify(e.payers));
  });

  await check("editing a one-payer expense opens in one-payer mode with the name selected", async () => {
    await evaluate("[...document.querySelectorAll('.expense-row')].find(r => r.textContent.includes('ອາຫານແລງ')).click()");
    await waitFor("document.querySelector('#expense-description')?.value === 'ອາຫານແລງ'");
    const checked = await evaluate("[...document.querySelectorAll('input[name=single-payer]')].filter(r => r.checked).map(r => r.closest('label').textContent)");
    assert(JSON.stringify(checked) === '["fy"]', JSON.stringify(checked));
  });

  await check("switching to several payers carries the amount over", async () => {
    await evaluate("document.querySelector('.btn-link').click()");
    const values = await evaluate("[...document.querySelectorAll('.payer-row .input')].map(i => i.value).filter(Boolean)");
    assert(JSON.stringify(values) === '["458,000"]', JSON.stringify(values));
    await screenshot("quick-form-multi-360");
  });

  await check("Save stays visible at the bottom of a phone screen", async () => {
    await open(`${base}/new`, 360, 640);
    const visible = await evaluate(`(() => { const r = document.querySelector('.form-actions .btn-primary').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight; })()`);
    assert(visible, "Save button is off screen");
  });
}
