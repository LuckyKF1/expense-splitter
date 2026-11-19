// Tiny DOM builder. Text always goes in via text nodes, never innerHTML,
// so names like "<script>" typed by anyone with the link stay plain text.

/**
 * h("button", { class: "btn", onClick: fn, type: "button" }, "Save")
 * - props starting with "on" become event listeners
 * - `class` may be a string or an array (falsy entries skipped)
 * - `dataset` is an object of data-* values
 * - children: strings, numbers, nodes, arrays; null/false are skipped
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      el.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : value;
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key === "value") {
      el.value = value;
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// 24x24 stroke icons (drawn for this app; no icon font or CDN needed).
const ICON_PATHS = {
  summary: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  expenses: ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6", "M9 12h6"],
  settle: ["M7 7h11l-3-3", "M17 17H6l3 3"],
  members: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M2 21a7 7 0 0 1 14 0",
    "M17 3.5a4 4 0 0 1 0 7", "M22 21a7 7 0 0 0-4-6.3"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M4 20h4L19 9l-4-4L4 16z", "M13 7l4 4"],
  trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  archive: ["M3 4h18v4H3z", "M5 8v12h14V8", "M10 12h4"],
  restore: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  share: ["M12 3v13", "M7 8l5-5 5 5", "M5 13v8h14v-8"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  check: ["M5 12l5 5L20 7"],
  back: ["M15 6l-6 6 6 6"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  star: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  // Theme button: automatic (half-filled circle), light (sun), dark (moon).
  themeAuto: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M12 3v18", "M12 7h4", "M12 11h5.5", "M12 15h5", "M12 19h2"],
  themeLight: ["M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2",
    "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  themeDark: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
};

export function icon(name, { label } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  for (const d of ICON_PATHS[name] ?? []) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/**
 * Run a save with its button disabled, so a second tap while the first
 * request is still travelling (slow tunnel) can't save the same thing twice.
 * A call made while the button is already busy is ignored.
 */
export async function whileBusy(button, action) {
  if (button.disabled) return undefined;
  button.disabled = true;
  try {
    return await action();
  } finally {
    button.disabled = false;
  }
}
