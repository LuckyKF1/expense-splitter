// Light / dark / automatic (follow the device). The choice is a per-device
// convenience in localStorage; <html data-theme> drives the CSS. The inline
// script in index.html applies a saved choice before the first paint, so
// it reads the same key and JSON format as storage.js writes.

import { storage } from "./storage.js";

export const THEMES = ["auto", "light", "dark"];

/** The saved choice, or "auto". */
export function getTheme() {
  const theme = storage.get("theme", "auto");
  return THEMES.includes(theme) ? theme : "auto";
}

/** What the theme button switches to next. */
export function nextTheme(theme) {
  const current = Math.max(0, THEMES.indexOf(theme)); // unknown counts as "auto"
  return THEMES[(current + 1) % THEMES.length];
}

export function setTheme(theme) {
  storage.set("theme", theme);
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
