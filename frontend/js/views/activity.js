import { h } from "../dom.js";
import { api } from "../api.js";
import { t } from "../i18n.js";

export const loadActivity = (token) => api.getActivity(token);

export async function renderActivity(root, ctx) {
  const group = ctx.group;
  document.title = `${t("activity.title")} · ${group.name}`;
  root.append(
    h("h1", { class: "page-title" }, t("activity.title")),
    ctx.data.length === 0
      ? h("section", { class: "card state-card" }, h("p", { class: "empty" }, t("activity.empty")))
      : h("ol", { class: "list card activity-list" },
        ctx.data.map((event) => activityRow(event))));
}

function activityRow(event) {
  const snapshot = event.after ?? event.before ?? {};
  const people = [snapshot.from_name, snapshot.to_name].filter(Boolean).join(" → ");
  const adminTarget = event.entity_type === "group" && "admin_member_id" in snapshot
    ? `${t("activity.admin")}: ${snapshot.admin_name ?? t("activity.noAdmin")}`
    : null;
  const target = (snapshot.description ?? snapshot.name ?? adminTarget ?? people)
    || `${t(`activity.entity.${event.entity_type}`)} #${event.entity_id ?? ""}`;
  const changes = h("details", { class: "activity-details" },
    h("summary", {}, t("activity.details")),
    h("pre", { class: "activity-json" }, JSON.stringify({
      before: event.before,
      after: event.after,
    }, null, 2)));

  return h("li", { class: "list-row activity-row" },
    h("div", { class: "list-main" },
      h("strong", {}, t(`activity.action.${event.action}`), " · ", target),
      h("span", { class: "muted small" },
        t("activity.by", { name: event.actor_name ?? t("activity.unknown") }),
        " · ", event.created_at)),
    changes);
}
