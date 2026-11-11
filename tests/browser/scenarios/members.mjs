// Home and members screens.
import { addMembers } from "../seed.mjs";

export const description = "home, members, language switch";

export async function setup(api) {
  await addMembers(api, ["luck", "fy", '<img src=x onerror="document.title=1">', "old"],
    { archived: ["old"] });
  return {};
}

export async function run({ token, open, evaluate, waitFor, screenshot, text, type, submit, check, assert }) {
  const membersPath = `/g/${token}/members`;
  const names = () => text(".member-name");

  await check("members page lists people and marks the inactive one", async () => {
    await open(membersPath);
    const list = await names();
    assert(list.includes("luck") && list.includes("old"), JSON.stringify(list));
    const inactive = await text(".is-inactive .member-name");
    assert(inactive.includes("old"), JSON.stringify(inactive));
  });

  await check("HTML in a name is shown as text, not executed", async () => {
    const injected = await evaluate("document.querySelectorAll('.list img').length");
    assert(injected === 0, `found ${injected} <img> elements`);
  });

  await check("adding a member keeps focus in the input for the next name", async () => {
    await type("#member-add", "kham");
    await submit("#member-add");
    await waitFor("[...document.querySelectorAll('.member-name')].some(e => e.textContent === 'kham')");
    assert(await evaluate("document.activeElement?.id === 'member-add'"), "focus lost");
    assert(await evaluate("document.querySelector('#member-add').value === ''"), "input not cleared");
  });

  await check("duplicate name shows a translated error (case-insensitive)", async () => {
    await type("#member-add", "KHAM");
    await submit("#member-add");
    await waitFor("document.querySelector('.field-error')?.textContent.length > 0");
    const error = await evaluate("document.querySelector('.field-error').textContent");
    assert(error.includes("already has that name"), error);
  });

  await check("rename a member inline", async () => {
    await evaluate(`[...document.querySelectorAll('.list-row')]
      .find(r => r.textContent.includes('kham')).querySelector('button').click()`);
    await waitFor("document.querySelector('.list-row form input')");
    await evaluate(`(() => { const i = document.querySelector('.list-row form input');
      i.value = 'Kham'; i.form.requestSubmit(); })()`);
    await waitFor("[...document.querySelectorAll('.member-name')].some(e => e.textContent === 'Kham')");
  });

  await check("deactivate then reactivate", async () => {
    const row = `[...document.querySelectorAll('.list-row')].find(r => r.textContent.includes('Kham'))`;
    await evaluate(`${row}.querySelectorAll('button')[1].click()`);
    await waitFor(`${row}?.classList.contains('is-inactive')`);
    await evaluate(`${row}.querySelectorAll('button')[1].click()`);
    await waitFor(`!${row}?.classList.contains('is-inactive')`);
  });

  await check("delete a member (confirm auto-accepted)", async () => {
    await evaluate(`[...document.querySelectorAll('.list-row')]
      .find(r => r.textContent.includes('Kham')).querySelectorAll('button')[2].click()`);
    await waitFor("![...document.querySelectorAll('.member-name')].some(e => e.textContent === 'Kham')");
  });

  await check("switching to Lao translates the shell and is remembered", async () => {
    await evaluate("document.getElementById('lang-toggle').click()");
    await waitFor("document.documentElement.lang === 'lo'");
    await open(membersPath); // reload: must stay Lao
    const nav = await text(".nav-label");
    assert(nav[0] === "ສະຫຼຸບ" && nav[3] === "ສະມາຊິກ", JSON.stringify(nav));
    await screenshot("6a-members-360-lo");
    await open(membersPath, 1280, 800);
    await screenshot("6a-members-1280-lo");
    await evaluate("document.getElementById('lang-toggle').click()"); // back to English
    await waitFor("document.documentElement.lang === 'en'");
  });

  await check("unknown group shows a friendly not-found state", async () => {
    await open("/g/doesnotexist");
    const body = await evaluate("document.querySelector('.state-card').textContent");
    assert(body.includes("Group not found"), body);
    assert(await evaluate("document.getElementById('nav').hidden"), "nav should be hidden");
  });

  await check("creating a group from home lands on its members page", async () => {
    await open("/");
    await type("#group-name", "ກິນເຂົ້າແລງ");
    await submit(".card form");
    await waitFor("location.pathname.endsWith('/members') && document.querySelector('#member-add')");
    const title = await evaluate("document.getElementById('group-title').textContent");
    assert(title === "ກິນເຂົ້າແລງ", title);
    await open("/");
    const recent = await text(".list-link");
    assert(recent[0] === "ກິນເຂົ້າແລງ", JSON.stringify(recent));
    await screenshot("6a-home-360-recent");
  });

  await check("no horizontal overflow at 360px", async () => {
    for (const path of ["/", membersPath]) {
      await open(path, 360, 780);
      const overflow = await evaluate("document.documentElement.scrollWidth - window.innerWidth");
      assert(overflow <= 0, `${path} overflows by ${overflow}px`);
    }
  });
}
