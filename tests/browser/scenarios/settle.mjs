// The brief's whole story: unbalanced -> blocked -> fixed -> 6 suggested
// transfers -> pay them all -> everyone even.
import { addMembers, BRIEF_PAID, BRIEF_PEOPLE, payersFrom } from "../seed.mjs";

export const description = "summary and settle up, the brief's example end to end";

export async function setup(api) {
  return { ids: await addMembers(api, BRIEF_PEOPLE) };
}

export async function run({ token, api, ids, open, evaluate, waitFor, screenshot, text, check, assert }) {
  const g = `/g/${token}`;
  const payers = (extra = {}) => payersFrom(ids, { ...BRIEF_PAID, ...extra });
  const everyone = BRIEF_PEOPLE.map((n) => ids[n]);

  const expense = await api("/expenses", "POST", {
    description: "ທ່ຽວລວມ", amount: 1180000, spent_at: "2026-11-09",
    payers: payers(), participants: everyone });

  await check("summary: totals and the brief's balances", async () => {
    await open(g);
    const stats = await text(".stat-value");
    assert(stats[0] === "1,180,000 ₭" && stats[1] === "7" && stats[2] === "1", JSON.stringify(stats));
    const rows = await evaluate(`[...document.querySelectorAll('.balance-row')].map(r =>
      [r.querySelector('.cell-name').textContent, r.querySelector('.cell-balance .amount').textContent,
       r.querySelector('.balance-word').textContent])`);
    const luck = rows.find((r) => r[0] === "luck");
    const ter = rows.find((r) => r[0] === "ter");
    assert(luck[1] === "511,428 ₭" && luck[2] === "gets back", JSON.stringify(luck));
    assert(ter[1] === "168,571 ₭" && ter[2] === "owes", JSON.stringify(ter));
  });

  await check("summary: unbalanced banner links to the expense, no settle button", async () => {
    const banner = await evaluate("document.querySelector('.banner-warning')?.textContent ?? ''");
    assert(banner.includes("−10,000 ₭") && banner.includes("ທ່ຽວລວມ"), banner);
    const href = await evaluate("document.querySelector('.banner-list a').getAttribute('href')");
    assert(href === `${g}/expenses/${expense.id}`, href);
    assert(!(await evaluate(`!!document.querySelector('a[href="${g}/settle"].btn')`)), "settle CTA shown");
    await screenshot("6c-summary-unbalanced-360");
  });

  await check("settle: blocked with the same banner while unbalanced", async () => {
    await open(`${g}/settle`);
    assert(await evaluate("!!document.querySelector('.banner-warning')"), "no banner");
    assert((await text(".transfer-row")).length === 0, "suggestions shown while unbalanced");
  });

  await check("fix via the banner link: summary becomes balanced", async () => {
    await api(`/expenses/${expense.id}`, "PUT", {
      description: "ທ່ຽວລວມ", amount: 1180000, spent_at: "2026-11-09",
      payers: payers({ bick: 10000 }), participants: everyone });
    await open(g);
    assert(!(await evaluate("!!document.querySelector('.banner-warning')")), "banner still there");
    assert(await evaluate(`!!document.querySelector('a[href="${g}/settle"].btn')`), "no settle CTA");
    await screenshot("6c-summary-360");
    await open(g, 1280, 800);
    await screenshot("6c-summary-1280");
  });

  await check("settle: the 6 suggested transfers from the brief", async () => {
    await open(`${g}/settle`);
    const rows = await evaluate(`[...document.querySelectorAll('.transfer-row')].map(r =>
      r.querySelector('.transfer-people').textContent.replace(/\\s+/g, ' ').trim() + ' = ' +
      r.querySelector('.transfer-amount').textContent)`);
    assert(JSON.stringify(rows) === JSON.stringify([
      "ter pays luck = 168,571 ₭", "bick pays luck = 158,571 ₭", "Lar pays luck = 138,571 ₭",
      "saeng pays fy = 51,428 ₭", "saeng pays luck = 45,715 ₭", "saeng pays no = 26,428 ₭"]),
    JSON.stringify(rows));
    await screenshot("6c-settle-360");
    await open(`${g}/settle`, 1280, 900);
    await screenshot("6c-settle-1280");
    await open(`${g}/settle`);
  });

  await check("mark as paid: transfer moves into history", async () => {
    await evaluate("document.querySelector('.transfer-action').click()");
    await waitFor("document.querySelectorAll('.transfer-row').length === 5");
    const history = await text(".history-row");
    assert(history.length === 1 && history[0].includes("ter") && history[0].includes("168,571"), JSON.stringify(history));
  });

  await check("record a partial payment with the form", async () => {
    await evaluate(`(() => {
      document.querySelector('#pay-from').value = '${ids.bick}';
      document.querySelector('#pay-to').value = '${ids.luck}';
      document.querySelector('#pay-amount').value = '100,000';
      document.querySelector('#pay-note').value = 'BCEL One';
      document.querySelector('#pay-note').form.requestSubmit();
    })()`);
    await waitFor("document.querySelectorAll('.history-row').length === 2");
    // bick still owes 158,571 - 100,000 = 58,571, possibly split over several transfers.
    const bickOwes = await evaluate(`[...document.querySelectorAll('.transfer-row')]
      .filter(r => r.querySelector('.transfer-people strong').textContent === 'bick')
      .reduce((sum, r) => sum + Number(r.querySelector('.transfer-amount').textContent.replace(/[^0-9]/g, '')), 0)`);
    assert(bickOwes === 58571, String(bickOwes));
    assert((await text(".history-row"))[0].includes("BCEL One"), "note missing");
  });

  await check("the form rejects paying yourself, before calling the server", async () => {
    await evaluate(`(() => {
      document.querySelector('#pay-from').value = '${ids.fy}';
      document.querySelector('#pay-to').value = '${ids.fy}';
      document.querySelector('#pay-amount').value = '1000';
      document.querySelector('#pay-note').form.requestSubmit();
    })()`);
    const error = await evaluate("document.querySelector('.form-error').textContent");
    assert(error.includes("different"), error);
  });

  await check("delete a payment from history: it comes back as a suggestion", async () => {
    await evaluate("document.querySelector('.history-row .btn-icon-danger').click()");
    await waitFor("document.querySelectorAll('.history-row').length === 1");
    const bick = await evaluate("[...document.querySelectorAll('.transfer-row')].find(r => r.textContent.includes('bick'))?.textContent ?? ''");
    assert(bick.includes("158,571"), bick);
  });

  await check("pay every remaining suggestion: everyone even", async () => {
    for (let i = 0; i < 10 && await evaluate("document.querySelectorAll('.transfer-action').length > 0"); i++) {
      const before = await evaluate("document.querySelectorAll('.transfer-action').length");
      await evaluate("document.querySelector('.transfer-action').click()");
      await waitFor(`document.querySelectorAll('.transfer-action').length === ${before - 1}`);
    }
    assert(await evaluate("!!document.querySelector('.all-settled')"), "no all-settled message");
    await open(g);
    const words = await text(".balance-word");
    assert(words.every((w) => w === "even"), JSON.stringify(words));
    assert(await evaluate("!!document.querySelector('.all-settled')"), "summary not settled");
  });

  await check("Lao: payment dates use Lao month names (Chrome has no Lao date data)", async () => {
    await api("/settlements", "POST",
      { from_member_id: ids.fy, to_member_id: ids.no, amount: 1000, paid_at: "2026-11-09" });
    await evaluate("document.getElementById('lang-toggle').click()");
    await waitFor("document.documentElement.lang === 'lo'");
    await open(`${g}/settle`, 360, 780);
    const dates = await text(".history-main .small");
    assert(dates.some((d) => d.includes("9 ພ.ຈ. 2026")), JSON.stringify(dates));
    await screenshot("6c-settle-360-lo");
    await evaluate("document.getElementById('lang-toggle').click()");
    await waitFor("document.documentElement.lang === 'en'");
  });

  await check("no horizontal overflow at 360px", async () => {
    for (const path of [g, `${g}/settle`]) {
      await open(path, 360, 780);
      const overflow = await evaluate("document.documentElement.scrollWidth - window.innerWidth");
      assert(overflow <= 0, `${path} overflows by ${overflow}px`);
    }
  });
}
