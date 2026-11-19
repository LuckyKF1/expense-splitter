// Browser tests: drive the real app in headless Chrome.
//
//   node tests/browser/run.mjs                 every scenario in scenarios/
//   node tests/browser/run.mjs settle members  only these
//   SHOTS=/some/dir node tests/browser/run.mjs also save screenshots there
//   node tests/browser/run.mjs tests/browser/perf.mjs   timing report (not a test)
//
// Starts its own server on a free port with a throwaway database, so the
// real data/expenses.db is never touched. Needs python3 and Chrome/Chromium
// (set CHROME=/path/to/chrome if it is not on PATH); no npm packages.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { findChrome, launchChrome, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const scenarioDir = join(here, "scenarios");
const shots = process.env.SHOTS ? resolve(process.env.SHOTS) : null;

function scenarioFiles(args) {
  if (args.length === 0) {
    return readdirSync(scenarioDir).filter((f) => f.endsWith(".mjs")).sort()
      .map((f) => join(scenarioDir, f));
  }
  return args.map((arg) => (arg.endsWith(".mjs") ? resolve(arg) : join(scenarioDir, `${arg}.mjs`)));
}

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), "expense-splitter-db-"));
  const port = await freePort();
  const server = spawn("python3", ["-m", "backend.server", "--port", String(port),
    "--db", join(dir, "browser-test.db")], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  server.stderr.on("data", (chunk) => { stderr += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) break;
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        return {
          base,
          async stop() {
            server.kill();
            await new Promise((r) => (server.exitCode !== null ? r() : server.once("exit", r)));
            rmSync(dir, { recursive: true, force: true });
          },
        };
      }
    } catch { /* not up yet */ }
    await sleep(100);
  }
  server.kill();
  throw new Error(`server did not start:\n${stderr}`);
}

/** Plain JSON calls to the API from Node, for seeding data. */
function apiClient(base) {
  async function call(path, method = "GET", body) {
    const res = await fetch(base + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    return data;
  }
  return {
    call,
    async createGroup(name) {
      const group = await call("/api/groups", "POST", { name });
      return { token: group.token, api: (path, method, body) => call(`/api/groups/${group.token}${path}`, method, body) };
    },
  };
}

/** Helpers every scenario receives (on top of `token`, `api` and its setup data). */
function pageHelpers(browser, base, results) {
  const { send } = browser;

  // formatKip uses a non-breaking space; compare against plain spaces in tests.
  const normalize = (value) => {
    if (typeof value === "string") return value.replace(/ /g, " ");
    if (Array.isArray(value)) return value.map(normalize);
    return value;
  };
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? expression);
    return normalize(result.result.value);
  }
  async function waitFor(expression, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await sleep(50);
    }
    throw new Error(`timeout waiting for: ${expression}`);
  }
  async function open(path, width = 360, height = 780, { timeout } = {}) {
    await send("Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await send("Page.navigate", { url: base + path });
    await waitFor("document.readyState === 'complete' && !document.querySelector('.loading')", timeout);
  }
  async function screenshot(name) {
    if (!shots) return;
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(shots, `${name}.png`), Buffer.from(data, "base64"));
  }
  const text = (selector) =>
    evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map(e => e.textContent.trim())`);
  /** Set a field's value the way typing would (fires input and blur). */
  const type = (selector, value) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur'));
  })()`);
  /** Submit the form that `selector` is (or is inside). */
  const submit = (selector) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    (el.form ?? el).requestSubmit();
  })()`);
  async function check(name, fn) {
    try {
      await fn();
      results.passed++;
      console.log(`  ✔ ${name}`);
    } catch (err) {
      results.failed++;
      console.log(`  ✖ ${name}: ${err.message}`);
    }
  }
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  /** Simulate a slow phone connection; latency in ms (0 = normal). */
  const throttle = (latency) => send("Network.emulateNetworkConditions",
    { offline: false, latency, downloadThroughput: -1, uploadThroughput: -1 });

  return { evaluate, waitFor, open, screenshot, text, type, submit, check, assert, throttle,
    sleep, send, on: browser.on };
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("Chrome/Chromium not found. Set CHROME=/path/to/chrome.");
    process.exit(2);
  }
  if (shots) mkdirSync(shots, { recursive: true });

  const files = scenarioFiles(process.argv.slice(2));
  const server = await startServer();
  const browser = await launchChrome(chromePath);
  const client = apiClient(server.base);
  const results = { passed: 0, failed: 0 };

  try {
    await browser.send("Page.enable");
    await browser.send("Runtime.enable");
    await browser.send("Network.enable");
    // Tests answer "yes" to every confirm() dialog.
    await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.confirm = () => true;" });
    const page = pageHelpers(browser, server.base, results);

    for (const file of files) {
      const scenario = await import(pathToFileURL(file).href);
      console.log(`\n${basename(file, ".mjs")}${scenario.description ? ` — ${scenario.description}` : ""}`);
      // A clean start: English, no remembered groups, normal speed.
      await page.open("/");
      await page.evaluate("localStorage.clear()");
      await page.throttle(0);
      const { token, api } = await client.createGroup(basename(file, ".mjs"));
      const seeded = scenario.setup ? await scenario.setup(api) : {};
      try {
        await scenario.run({ ...page, base: server.base, token, api, ...seeded });
      } catch (err) {
        results.failed++;
        console.log(`  ✖ scenario crashed: ${err.stack}`);
      }
      browser.offAll();
    }
  } finally {
    await browser.close();
    await server.stop();
  }

  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

await main();
