// Who may record payments on Settle up:
// - no Admin assigned: everyone (a new group must work without setup);
// - an Admin assigned: only the device that chose the Admin under "Who are you?".
import { addMembers, payersFrom } from "../seed.mjs";

export const description = "payment controls with and without an Admin";

export async function setup(api) {
  const ids = await addMembers(api, ["Luck", "Noy"]);
  await api("/expenses", "POST", { description: "Dinner", amount: 200000, spent_at: "2026-11-19",
    payers: payersFrom(ids, { Luck: 200000 }), participants: Object.values(ids) });
  return { ids };
}

export async function run({ token, api, ids, open, evaluate, text, check, assert }) {
  const settle = `/g/${token}/settle`;
  const controls = () => evaluate(
    "({ paid: !!document.querySelector('.transfer-action'), record: !!document.querySelector('.record-card') })");
  const me = (id) => evaluate(`localStorage.setItem('expense-splitter:me',
    JSON.stringify({ [${JSON.stringify(token)}]: ${id} }))`);

  await check("no Admin: anyone can record payments, without being told to pick one", async () => {
    await open(settle);
    const c = await controls();
    assert(c.paid && c.record, JSON.stringify(c));
    assert((await text(".admin-hint")).length === 0, JSON.stringify(await text(".admin-hint")));
  });

  await check("Admin assigned: other devices see who manages payments, without controls", async () => {
    await api("/admin", "PATCH", { member_id: ids.Luck });
    await me(ids.Noy);
    await open(settle);
    const c = await controls();
    assert(!c.paid && !c.record, JSON.stringify(c));
    const hint = await text(".admin-hint");
    assert(hint[0]?.includes("Luck"), JSON.stringify(hint));
  });

  await check("Admin assigned: the Admin's device has the controls", async () => {
    await me(ids.Luck);
    await open(settle);
    const c = await controls();
    assert(c.paid && c.record, JSON.stringify(c));
  });
}
