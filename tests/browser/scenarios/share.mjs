// The share button on a localhost address must warn, not hand out a dead link.
export const description = "share link";

export async function run({ token, open, evaluate, waitFor, check, assert }) {
  await check("sharing from 127.0.0.1/localhost warns instead of handing out a dead link", async () => {
    await open(`/g/${token}/members`);
    await evaluate("document.getElementById('share-button').click()");
    await waitFor("document.getElementById('toast').classList.contains('is-visible')");
    const msg = await evaluate("document.getElementById('toast').textContent");
    assert(msg.includes("only works on this computer"), msg);
  });
}
