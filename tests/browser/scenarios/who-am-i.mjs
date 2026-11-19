// "Who are you?": tap your name once and the summary leads with your own
// balance. Remembered per group on this device; "Not X?" undoes it.
import { addMembers, payersFrom } from "../seed.mjs";

export const description = "who are you: your own balance first";

export async function setup(api) {
  const ids = await addMembers(api, ["Luck", "Noy", "Fy"]);
  await api("/expenses", "POST", { description: "Dinner", amount: 300000, spent_at: "2026-11-16",
    payers: payersFrom(ids, { Luck: 300000 }), participants: Object.values(ids) });
  return { ids };
}

export async function run({ token, ids, open, evaluate, waitFor, text, check, assert, screenshot }) {
  const g = `/g/${token}`;
  const tap = (name) => evaluate(`[...document.querySelectorAll('.person-chip-name')]
    .find(n => n.textContent === ${JSON.stringify(name)}).closest('button').click()`);

  await check("first visit asks who you are, offering every active member", async () => {
    await open(g);
    assert((await text(".hero-question"))[0] === "Who are you?", "no question");
    const names = await text(".person-chip-name");
    assert(JSON.stringify(names) === '["Luck","Noy","Fy"]', JSON.stringify(names));
    await screenshot("who-ask-360");
  });

  await check("dark theme: names on the white chips stay dark and readable", async () => {
    await evaluate("localStorage.setItem('expense-splitter:theme', JSON.stringify('dark'))");
    await open(g);
    const colour = await evaluate("getComputedStyle(document.querySelector('.person-chip-name')).color");
    await evaluate("localStorage.removeItem('expense-splitter:theme')");
    await open(g);
    assert(colour === "rgb(28, 29, 26)", colour);
  });

  await check("tapping your name shows what you owe, in red, with a settle button", async () => {
    await tap("Noy");
    await waitFor("!!document.querySelector('.hero-me')");
    assert((await text(".hero-label"))[0] === "You owe", JSON.stringify(await text(".hero-label")));
    assert((await text(".hero-amount"))[0] === "100,000 ₭", JSON.stringify(await text(".hero-amount")));
    assert(await evaluate("document.querySelector('.hero-card').classList.contains('hero-negative')"), "not red");
    assert(await evaluate(`!!document.querySelector('.hero-card a[href="${g}/settle"]')`), "no settle button");
    const me = await text(".balance-row.is-me .cell-name");
    assert(me[0] === "Noy", JSON.stringify(me));
    await screenshot("who-me-360");
  });

  await check("it is remembered after a reload", async () => {
    await open(g);
    assert((await text(".hero-me-name"))[0] === "Noy", "forgotten");
  });

  await check("'Not Noy?' forgets it and asks again", async () => {
    await evaluate("document.querySelector('.hero-switch').click()");
    await waitFor("!!document.querySelector('.hero-question')");
    await open(g);
    assert(!(await evaluate("!!document.querySelector('.hero-me')")), "still remembered");
  });

  await check("the person who paid sees what they get back", async () => {
    await tap("Luck");
    await waitFor("!!document.querySelector('.hero-me')");
    assert((await text(".hero-label"))[0] === "You get back", JSON.stringify(await text(".hero-label")));
    assert((await text(".hero-amount"))[0] === "200,000 ₭", JSON.stringify(await text(".hero-amount")));
  });

  await check("each group remembers its own person", async () => {
    const remembered = await evaluate("JSON.parse(localStorage.getItem('expense-splitter:me'))");
    assert(remembered[token] === ids.Luck && Object.keys(remembered).length === 1, JSON.stringify(remembered));
  });

  await check("Lao hero", async () => {
    await evaluate("document.getElementById('lang-toggle').click()");
    await waitFor("document.querySelector('.hero-label')?.textContent === 'ທ່ານໄດ້ຮັບຄືນ'");
    await screenshot("who-me-360-lo");
    await evaluate("document.getElementById('lang-toggle').click()");
    await waitFor("document.documentElement.lang === 'en'");
  });
}
