// "/" — create a group, or reopen one used on this device.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { describeError, t } from "../i18n.js";
import { forgetGroup, recentGroups, rememberGroup } from "../storage.js";

export async function renderHome(root, ctx) {
  document.title = t("app.name");
  root.append(
    h("section", { class: "hero" },
      h("h1", { class: "hero-title" }, t("app.name")),
      h("p", { class: "hero-tagline" }, t("app.tagline"))),
    h("div", { class: "grid grid-2" }, createGroupCard(ctx), recentGroupsCard(ctx)),
  );
}

function createGroupCard(ctx) {
  const input = h("input", {
    id: "group-name", name: "name", class: "input", required: true, maxlength: 100,
    autocomplete: "off", placeholder: t("home.groupNamePlaceholder"),
  });
  const error = h("p", { class: "field-error", role: "alert" });
  const button = h("button", { class: "btn btn-primary btn-block", type: "submit" },
    t("home.create"));

  async function onSubmit(event) {
    event.preventDefault();
    error.textContent = "";
    button.disabled = true;
    try {
      const group = await api.createGroup(input.value);
      rememberGroup(group.token, group.name);
      ctx.navigate(`/g/${group.token}/members`); // first step: add people
    } catch (err) {
      error.textContent = describeError(err);
      button.disabled = false;
      input.focus();
    }
  }

  return h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("home.createTitle")),
    h("form", { class: "stack", onSubmit, novalidate: true },
      h("label", { class: "label", for: "group-name" }, t("home.groupName")),
      input, error, button));
}

function recentGroupsCard(ctx) {
  const groups = recentGroups();
  const card = h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("home.recentTitle")),
    h("p", { class: "muted" }, t("home.recentHint")));

  if (groups.length === 0) {
    card.append(h("p", { class: "empty" }, t("home.noRecent")));
    return card;
  }
  card.append(h("ul", { class: "list" }, groups.map((group) =>
    h("li", { class: "list-row" },
      h("a", { class: "list-link", href: `/g/${group.token}` }, group.name),
      h("button", {
        class: "btn-icon", type: "button", title: t("home.forget"),
        "aria-label": `${t("home.forget")}: ${group.name}`,
        onClick: () => { forgetGroup(group.token); ctx.refresh(); },
      }, icon("close"))))));
  return card;
}
