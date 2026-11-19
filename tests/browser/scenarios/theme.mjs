// Theme button: automatic -> light -> dark, remembered, applied before the
// first paint, and the device setting is followed in "automatic".
export const description = "light / dark / automatic theme";

export async function run({ open, evaluate, waitFor, check, assert, send, screenshot }) {
  const bg = () => evaluate("getComputedStyle(document.body).backgroundColor");
  const LIGHT = "rgb(246, 244, 239)";
  const DARK = "rgb(18, 20, 18)";
  const device = (scheme) => send("Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: scheme }] });
  const tap = () => evaluate("document.getElementById('theme-toggle').click()");

  await check("automatic follows the device", async () => {
    await device("light");
    await open("/");
    assert(await bg() === LIGHT, await bg());
    await device("dark");
    assert(await bg() === DARK, await bg());
    const label = await evaluate("document.getElementById('theme-toggle').getAttribute('aria-label')");
    assert(label.startsWith("Theme: automatic"), label);
  });

  await check("tap: light, even on a dark device", async () => {
    await tap();
    assert(await evaluate("document.documentElement.dataset.theme") === "light", "no data-theme");
    assert(await bg() === LIGHT, await bg());
  });

  await check("tap again: dark, even on a light device", async () => {
    await device("light");
    await tap();
    assert(await bg() === DARK, await bg());
    await screenshot("theme-dark-home-360");
  });

  await check("the choice survives a reload and is applied before the app script runs", async () => {
    // Record the theme at the very first script on the page, before app.js.
    const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", {
      source: "document.addEventListener('readystatechange', () => { if (!window.__firstTheme) window.__firstTheme = document.documentElement.dataset.theme || 'none'; }, { once: true });",
    });
    await open("/");
    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
    assert(await evaluate("window.__firstTheme") === "dark", String(await evaluate("window.__firstTheme")));
    assert(await bg() === DARK, await bg());
  });

  await check("third tap: back to automatic", async () => {
    await tap();
    assert(await evaluate("document.documentElement.dataset.theme") === undefined, "data-theme left");
    assert(await bg() === LIGHT, await bg());
    await waitFor("document.getElementById('toast').textContent.includes('automatic')");
  });

  await send("Emulation.setEmulatedMedia", { features: [] });
}
