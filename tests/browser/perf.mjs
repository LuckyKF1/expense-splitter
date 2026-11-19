// Not a test: prints time, requests and sequential request rounds per screen
// under an emulated phone round-trip time (RTT=300 by default):
//   RTT=300 node tests/browser/run.mjs tests/browser/perf.mjs
// Each sequential round costs one RTT over a tunnel, so fewer rounds = faster.
import { addMembers, BRIEF_PAID, BRIEF_PEOPLE, payersFrom } from "./seed.mjs";

export const description = "timing report under emulated latency";

export async function setup(api) {
  const ids = await addMembers(api, BRIEF_PEOPLE);
  for (let i = 1; i <= 20; i++) {
    await api("/expenses", "POST", { description: `Expense ${i}`, amount: 1170000, spent_at: "2026-11-09",
      payers: payersFrom(ids, BRIEF_PAID), participants: BRIEF_PEOPLE.map((n) => ids[n]) });
  }
  return {};
}

export async function run({ token, base, evaluate, waitFor, send, on, sleep }) {
  const RTT = Number(process.env.RTT ?? 300);
  const requests = [];
  on("Network.requestWillBeSent", (p) => requests.push({ id: p.requestId, url: p.request.url, start: p.timestamp }));
  on("Network.loadingFinished", (p) => { const r = requests.find((x) => x.id === p.requestId); if (r) { r.end = p.timestamp; r.bytes = p.encodedDataLength; } });
  await send("Network.clearBrowserCache");
  await send("Network.emulateNetworkConditions",
    { offline: false, latency: RTT, downloadThroughput: 1.5e6 / 8 * 1024 / 1000 * 1000, uploadThroughput: 750e3 / 8 });

  async function measure(label, action, doneExpr) {
    requests.length = 0;
    const t0 = Date.now();
    await action();
    await waitFor(doneExpr, 30000);
    await sleep(100);
    const ms = Date.now() - t0;
    const t = Math.min(...requests.map((r) => r.start));
    // "depth" = how many request rounds happened one after another.
    const rounds = [];
    for (const r of [...requests].sort((a, b) => a.start - b.start)) {
      const round = rounds.find((g) => Math.abs(g.start - r.start) < RTT / 2000);
      round ? round.items.push(r) : rounds.push({ start: r.start, items: [r] });
    }
    const kb = Math.round(requests.reduce((s, r) => s + (r.bytes ?? 0), 0) / 1024);
    console.log(`\n${label}: ${ms} ms, ${requests.length} requests, ${rounds.length} sequential rounds, ${kb} KB`);
    for (const g of rounds) {
      console.log(`  +${Math.round((g.start - t) * 1000)}ms  ` + g.items.map((r) => r.url.replace(/^https?:\/\/[^/]+/, "").replace(/[A-Za-z0-9_-]{22}/, "<tok>")).join("  "));
    }
  }

  await measure("1) first visit: open group link (cold cache)",
    () => send("Page.navigate", { url: `${base}/g/${token}` }),
    "!!document.querySelector('.stat')");
  await measure("2) reload same page (warm cache)",
    () => send("Page.reload", {}),
    "!!document.querySelector('.stat')");
  await measure("3) tap 'Expenses' in the nav",
    () => evaluate("document.querySelectorAll('.nav-link')[1].click()"),
    "!!document.querySelector('.expense-row')");
  await measure("4) open the add-expense form",
    () => evaluate(`history.pushState({}, '', '/g/${token}/expenses/new'); dispatchEvent(new PopStateEvent('popstate'))`),
    "!!document.querySelector('#expense-amount')");
  await measure("5) save an expense (one payer)",
    () => evaluate(`(() => {
      const set = (s, v) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); };
      set('#expense-amount', '50000'); set('#expense-description', 'perf test');
      document.querySelector('input[name=single-payer]').click();
      document.querySelector('.form-card').requestSubmit(); })()`),
    "location.pathname.endsWith('/expenses') && !!document.querySelector('.expense-row')");
}
