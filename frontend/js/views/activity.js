// "/g/:token/activity" — every recorded change to the group, newest first,
// written for people: local time, field names, "before → after".

import { activityChanges } from "../activity-model.js";
import { api } from "../api.js";
import { h } from "../dom.js";
import { formatDate, formatDateTime, formatKip } from "../format.js";
import { getLang, t } from "../i18n.js";

export const loadActivity = (token) => api.getActivity(token);

export async function renderActivity(root, ctx) {
  const group = ctx.group;
  document.title = `${t("activity.title")} · ${group.name}`;
  const names = new Map(group.members.map((m) => [m.id, m.name]));
  root.append(
    h("h1", { class: "page-title" }, t("activity.title")),
    ctx.data.length === 0
      ? h("section", { class: "card state-card" }, h("p", { class: "empty" }, t("activity.empty")))
      : h("ol", { class: "list card activity-list" },
        ctx.data.map((event) => activityRow(event, names))));
}

function activityRow(event, names) {
  const snapshot = event.after ?? event.before ?? {};
  const people = [snapshot.from_name, snapshot.to_name].filter(Boolean).join(" → ");
  const adminTarget = event.entity_type === "group" && "admin_member_id" in snapshot
    ? `${t("activity.admin")}: ${snapshot.admin_name ?? t("activity.noAdmin")}`
    : null;
  const target = (snapshot.description ?? snapshot.name ?? adminTarget ?? people)
    || `${t(`activity.entity.${event.entity_type}`)} #${event.entity_id ?? ""}`;

  const changes = activityChanges(event);
  const list = changes.length > 0 && h("ul", { class: "change-list" }, changes.map((change) =>
    h("li", {},
      h("span", { class: "change-field" }, `${fieldLabel(change.field)}: `),
      event.action === "updated"
        ? [show(change, change.before, names), " → ", show(change, change.after, names)]
        : show(change, event.action === "created" ? change.after : change.before, names))));

  return h("li", { class: "list-row activity-row" },
    h("div", { class: "list-main" },
      h("strong", {}, t(`activity.action.${event.action}`), " · ", target),
      h("span", { class: "muted small" },
        t("activity.by", { name: event.actor_name ?? t("activity.unknown") }),
        " · ", formatDateTime(event.created_at, getLang()))),
    // Edits show what changed right away; for additions and deletions the
    // values are one tap away, so the list stays short.
    list && (event.action === "updated"
      ? list
      : h("details", { class: "activity-details" }, h("summary", {}, t("activity.details")), list)));
}

const LABELS = {
  admin_name: "activity.admin", shares: "field.participants", archived: "field.archived",
  from_name: "field.from_member_id", to_name: "field.to_member_id",
};
const fieldLabel = (field) => t(LABELS[field] ?? `field.${field}`);

function show({ kind }, value, names) {
  if (value === null || value === undefined || value === "") return "—";
  const name = (id) => names.get(id) ?? `#${id}`;
  switch (kind) {
    case "money": return formatKip(value);
    case "date": return formatDate(value, getLang());
    case "bool": return t(value ? "members.inactive" : "activity.active");
    case "lines": return value.map((line) => `${name(line.member_id)} ${formatKip(line.amount)}`).join(", ") || "—";
    case "people": return value.map((line) => name(line.member_id)).join(", ") || "—";
    default: return String(value);
  }
}
