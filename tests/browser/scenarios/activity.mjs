// Change history is written for people: local time, field names and
// "before → after", never raw JSON or UTC timestamps.
import { addMembers, payersFrom } from "../seed.mjs";

export const description = "readable change history";

export async function setup(api) {
  const ids = await addMembers(api, ["Luck", "Noy"]);
  const all = Object.values(ids);
  const expense = await api("/expenses", "POST", { description: "Dinner", amount: 300000, spent_at: "2026-11-18",
    payers: payersFrom(ids, { Luck: 300000 }), participants: all });
  await api(`/expenses/${expense.id}`, "PUT", { description: "Dinner", amount: 320000, spent_at: "2026-11-18",
    payers: payersFrom(ids, { Luck: 320000 }), participants: all });
  await api(`/members/${ids.Noy}`, "PATCH", { archived: true });
  return { ids };
}

export async function run({ token, open, evaluate, text, check, assert, screenshot }) {
  await open(`/g/${token}/activity`);

  await check("an edit shows what changed, before → after", async () => {
    const rows = await text(".activity-row");
    const edit = rows.find((r) => r.startsWith("Updated · Dinner"));
    assert(edit?.includes("Amount: 300,000 ₭ → 320,000 ₭"), JSON.stringify(rows));
    assert(edit.includes("Paid by: Luck 300,000 ₭ → Luck 320,000 ₭"), edit);
    assert(!edit.includes("Split between"), `shares only followed the total: ${edit}`);
  });

  await check("archiving reads as a status change", async () => {
    const rows = await text(".activity-row");
    assert(rows.some((r) => r.includes("Status: Active → Inactive")), JSON.stringify(rows));
  });

  await check("times are local and readable, and no raw JSON is shown", async () => {
    const meta = await text(".activity-row .list-main .muted");
    assert(meta.every((m) => /\d{1,2} \w{3} \d{4} \d{2}:\d{2}$/.test(m)), JSON.stringify(meta));
    const body = await evaluate("document.querySelector('.activity-list').textContent");
    assert(!/[{}]|T\d{2}:\d{2}:\d{2}Z/.test(body), body.slice(0, 200));
    await screenshot("activity-360");
  });

  await check("additions keep their values folded away", async () => {
    const created = await evaluate(`[...document.querySelectorAll('.activity-row')]
      .filter(r => r.textContent.startsWith('Created')).map(r => !!r.querySelector('details:not([open]) .change-list'))`);
    assert(created.length > 0 && created.every(Boolean), JSON.stringify(created));
  });
}
