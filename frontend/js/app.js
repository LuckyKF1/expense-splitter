// App shell: routing (History API), header, navigation, toasts.
// Views are functions (root, ctx) => Promise that fill `root`.
// They never touch the shell directly; they use ctx helpers instead.

import { api } from "./api.js";
import { h, icon } from "./dom.js";
import { describeError, getLang, setLang, t } from "./i18n.js";
import { rememberGroup } from "./storage.js";
import { renderHome } from "./views/home.js";
import { renderMembers } from "./views/members.js";

const TOKEN = "([A-Za-z0-9_-]{1,64})";

const NAV_ITEMS = [
  { key: "summary", suffix: "", icon: "summary" },
  { key: "expenses", suffix: "/expenses", icon: "expenses" },
  { key: "settle", suffix: "/settle", icon: "settle" },
  { key: "members", suffix: "/members", icon: "members" },
];

const ROUTES = [
  { pattern: new RegExp("^/$"), view: renderHome },
  { pattern: new RegExp(`^/g/${TOKEN}/?$`), view: renderComingSoon, nav: "summary" },
  { pattern: new RegExp(`^/g/${TOKEN}/expenses/?$`), view: renderComingSoon, nav: "expenses" },
  { pattern: new RegExp(`^/g/${TOKEN}/settle/?$`), view: renderComingSoon, nav: "settle" },
  { pattern: new RegExp(`^/g/${TOKEN}/members/?$`), view: renderMembers, nav: "members" },
];

const shell = {
  main: document.getElementById("view"),
  nav: document.getElementById("nav"),
  groupTitle: document.getElementById("group-title"),
  brand: document.getElementById("brand"),
  brandText: document.getElementById("brand-text"),
  shareButton: document.getElementById("share-button"),
  langButton: document.getElementById("lang-toggle"),
  toast: document.getElementById("toast"),
};

let renderCount = 0;
let currentGroup = null;

// ---- Rendering ----------------------------------------------------------------

/**
 * Draw the view for the current URL. `quiet` (used after edits) keeps the
 * old content on screen until the new one is ready, so nothing flickers.
 */
async function render({ focus, quiet = false } = {}) {
  const renderId = ++renderCount;
  const path = location.pathname;
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) return navigate("/", { replace: true });
  const token = path.match(route.pattern)[1] ?? null;

  const root = h("div", { class: "view-inner" });
  const ctx = makeContext(token);
  if (!quiet) shell.main.replaceChildren(h("p", { class: "loading" }, t("status.loading")));
  try {
    if (token) {
      ctx.group = await loadGroup(token);
    } else {
      currentGroup = null;
    }
    updateShell(route, ctx.group);
    await route.view(root, ctx);
  } catch (err) {
    updateShell(route, null);
    root.replaceChildren(errorState(err));
  }
  if (renderId !== renderCount) return; // a newer navigation won the race
  shell.main.replaceChildren(root);
  if (focus) root.querySelector(focus)?.focus();
}

async function loadGroup(token) {
  const group = await api.getGroup(token);
  rememberGroup(group.token, group.name);
  currentGroup = group;
  return group;
}

function makeContext(token) {
  return {
    token,
    group: null,
    navigate,
    toast,
    share: shareGroupLink,
    /** Re-fetch everything and redraw the current view in place. */
    refresh: (options) => render({ ...options, quiet: true }),
    /** Run an action, showing any API error as a toast. */
    async run(action) {
      try {
        await action();
      } catch (err) {
        toast(describeError(err), { error: true });
      }
    },
  };
}

function updateShell(route, group) {
  document.documentElement.lang = getLang();
  shell.brandText.textContent = t("app.name");
  shell.brand.setAttribute("aria-label", t("app.name")); // text may be hidden on phones
  shell.langButton.textContent = t("lang.switch");
  shell.langButton.setAttribute("aria-label", t("lang.switchLabel"));
  shell.groupTitle.textContent = group?.name ?? "";
  shell.shareButton.hidden = !group;
  shell.shareButton.setAttribute("aria-label", t("action.share"));
  shell.shareButton.title = t("action.share");

  document.body.classList.toggle("in-group", Boolean(group));
  shell.nav.hidden = !group;
  shell.nav.setAttribute("aria-label", t("nav.main"));
  if (!group) return shell.nav.replaceChildren();
  shell.nav.replaceChildren(...NAV_ITEMS.map((item) =>
    h("a", {
      class: "nav-link", href: `/g/${group.token}${item.suffix}`,
      "aria-current": route.nav === item.key ? "page" : null,
    }, icon(item.icon), h("span", { class: "nav-label" }, t(`nav.${item.key}`)))));
}

function errorState(err) {
  const notFound = err.code === "GROUP_NOT_FOUND";
  return h("section", { class: "card state-card" },
    notFound && h("h1", { class: "card-title" }, t("group.notFoundTitle")),
    h("p", {}, describeError(err)),
    notFound
      ? h("a", { class: "btn btn-primary", href: "/" }, t("action.back"))
      : h("button", { class: "btn btn-primary", type: "button", onClick: () => render() },
        t("action.retry")));
}

async function renderComingSoon(root) {
  root.append(h("section", { class: "card state-card" },
    h("p", { class: "muted" }, t("status.comingSoon"))));
}

// ---- Navigation ----------------------------------------------------------------

function navigate(path, { replace = false } = {}) {
  if (path !== location.pathname) {
    history[replace ? "replaceState" : "pushState"]({}, "", path);
  }
  window.scrollTo(0, 0);
  return render();
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='/']");
  if (!link || link.target || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
});

window.addEventListener("popstate", () => render());

// ---- Shell actions --------------------------------------------------------------

shell.langButton.addEventListener("click", () => {
  setLang(getLang() === "en" ? "lo" : "en");
  render();
});

shell.shareButton.addEventListener("click", () => shareGroupLink());

/** Native share sheet on phones, clipboard elsewhere, raw URL as last resort. */
async function shareGroupLink() {
  if (!currentGroup) return;
  // Built from the current origin, so it is right behind any tunnel URL.
  const url = `${location.origin}/g/${currentGroup.token}`;
  if (navigator.share) {
    try {
      return await navigator.share({ title: currentGroup.name, url });
    } catch (err) {
      if (err.name === "AbortError") return; // person closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t("status.linkCopied"));
  } catch {
    toast(t("status.copyFailed", { url }), { duration: 10000 });
  }
}

let toastTimer;
function toast(message, { error = false, duration = 3000 } = {}) {
  shell.toast.textContent = message;
  shell.toast.classList.toggle("toast-error", error);
  shell.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => shell.toast.classList.remove("is-visible"), duration);
}

setLang(getLang());
render();
