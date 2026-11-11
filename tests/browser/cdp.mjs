// Minimal Chrome DevTools Protocol client using Node's built-in WebSocket
// (Node 22+), so browser tests need no npm packages.

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Path of an installed Chrome/Chromium, or null. CHROME overrides. */
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [name], { encoding: "utf8" }).trim();
    } catch { /* not this one */ }
  }
  return null;
}

/**
 * Start a headless Chrome with a throwaway profile and connect to its page.
 * Returns { send(method, params), on(method, handler), off(method), close() }.
 */
export async function launchChrome(binary) {
  const profile = mkdtempSync(join(tmpdir(), "expense-splitter-chrome-"));
  // Port 0: Chrome picks a free port and writes it to DevToolsActivePort in
  // its own profile, so we never attach to some other Chrome by mistake.
  const chrome = spawn(binary, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" });

  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(100);
    try {
      const port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
        .find((t) => t.type === "page");
    } catch { /* not up yet */ }
  }
  if (!target) {
    chrome.kill();
    rmSync(profile, { recursive: true, force: true });
    throw new Error("Chrome did not start");
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      for (const handler of listeners.get(msg.method) ?? []) handler(msg.params);
    }
  });

  return {
    send(method, params = {}) {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, (msg) =>
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    },
    on(method, handler) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(handler);
    },
    offAll() {
      listeners.clear();
    },
    async close() {
      ws.close();
      chrome.kill();
      await new Promise((resolve) => (chrome.exitCode !== null ? resolve() : chrome.once("exit", resolve)));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
