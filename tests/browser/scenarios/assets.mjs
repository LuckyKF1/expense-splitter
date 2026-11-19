// Versioned assets: every module comes from a ?v= URL (cached for good), and
// the inline import map is allowed by CSP, so the console stays clean.
export const description = "versioned assets and CSP";

export async function run({ token, open, evaluate, check, assert, send, on }) {
  const problems = [];
  on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") problems.push(p.args.map((a) => a.value).join(" ")); });
  on("Log.entryAdded", (p) => { if (p.entry.level === "error") problems.push(p.entry.text); });
  await send("Log.enable");
  await check("every module loads from its versioned URL (import map not blocked by CSP)", async () => {
    await open(`/g/${token}`);
    const urls = await evaluate("performance.getEntriesByType('resource').map(e => new URL(e.name).pathname + new URL(e.name).search).filter(u => u.startsWith('/js/') || u.startsWith('/css/'))");
    const unversioned = urls.filter((u) => !u.includes("?v="));
    assert(urls.length >= 15, `only ${urls.length} assets: ${JSON.stringify(urls)}`);
    assert(unversioned.length === 0, `unversioned: ${JSON.stringify(unversioned)}`);
  });
  await check("no console or CSP errors", async () => {
    assert(problems.length === 0, JSON.stringify(problems));
  });
}
