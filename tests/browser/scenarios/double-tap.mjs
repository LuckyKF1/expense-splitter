// Over a slow connection a second tap arrives before the first save returns.
// Tapping several times must still record ONE payment.
import { addMembers } from "../seed.mjs";

export const description = "repeated taps on a slow connection save once";

export async function setup(api) {
  const ids = await addMembers(api, ["luck", "fy"]);
  await api("/expenses", "POST", { description: "Dinner", amount: 200000, spent_at: "2026-11-11",
    payers: [{ member_id: ids.luck, amount: 200000 }], participants: [ids.luck, ids.fy] });
  return { ids };
}

export async function run({ token, api, ids, open, evaluate, waitFor, throttle, check, assert }) {
  const payments = async () => (await api("/settlements")).length;
  // Wait until the button is usable again, i.e. the save (and redraw) finished.
  const settled = (selector) => waitFor(`(() => { const b = document.querySelector(${JSON.stringify(selector)});
    return !b || !b.disabled; })()`, 15000);

  await throttle(800);
  await open(`/g/${token}/settle`, 360, 780, { timeout: 15000 });

  await check("record form: three quick taps save one payment", async () => {
    const disabled = await evaluate(`(() => {
      document.getElementById('pay-from').value = '${ids.fy}';
      document.getElementById('pay-to').value = '${ids.luck}';
      document.getElementById('pay-amount').value = '5000';
      const button = document.getElementById('pay-note').form.querySelector('button[type=submit]');
      button.click(); button.click(); button.click();
      return button.disabled;
    })()`);
    assert(disabled, "button not disabled while saving");
    await waitFor("document.querySelectorAll('.history-row').length === 1", 15000);
    await settled("form button[type=submit]");
    assert(await payments() === 1, `got ${await payments()} payments`);
  });

  await check("mark as paid: three quick taps save one payment", async () => {
    await evaluate(`(() => { const button = document.querySelector('.transfer-action');
      button.click(); button.click(); button.click(); })()`);
    await waitFor("document.querySelectorAll('.history-row').length === 2", 15000);
    await settled(".transfer-action");
    assert(await payments() === 2, `got ${await payments()} payments`);
    const { members } = await api("/summary");
    assert(members.every((m) => m.balance === 0), JSON.stringify(members.map((m) => m.balance)));
  });

  await throttle(0);
}
