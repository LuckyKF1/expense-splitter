// "/g/:token/expenses" — all expenses, newest first, grouped by day.
// Each row is one link to the expense's edit screen.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { groupByDay } from "../expense-model.js";
import { formatDay, formatKip } from "../format.js";
import { getLang, t } from "../i18n.js";
import { avatar, needMembersCard } from "./shared.js";

export const loadExpenses = (token) => api.listExpenses(token);

export async function renderExpenses(root, ctx) {
  const group = ctx.group;
  document.title = `${t("expenses.title")} · ${group.name}`;
  const expenses = ctx.data;
  const members = new Map(group.members.map((m) => [m.id, m]));
  const newPath = `/g/${group.token}/expenses/new`;
  const hasMembers = group.members.some((m) => !m.archived);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const header = h("div", { class: "page-header" },
    h("div", {},
      h("h1", { class: "page-title" }, t("expenses.title")),
      expenses.length > 0 && h("p", { class: "muted small" },
        t(expenses.length === 1 ? "expenses.countOne" : "expenses.count",
          { count: expenses.length, total: formatKip(total) }))),
    hasMembers && h("a", { class: "btn btn-primary hide-phone", href: newPath },
      icon("plus"), t("expenses.add")));

  if (!hasMembers) {
    root.append(header, needMembersCard(group.token));
    return;
  }

  root.append(header,
    expenses.length === 0
      ? h("section", { class: "card state-card" },
        h("p", { class: "muted" }, t("expenses.empty")),
        h("a", { class: "btn btn-primary", href: newPath }, icon("plus"), t("expenses.add")))
      : h("div", { class: "day-list" }, groupByDay(expenses).map((day) => daySection(day, members, group))),
    h("a", { class: "fab", href: newPath, "aria-label": t("expenses.add"), title: t("expenses.add") },
      icon("plus")));
}

function daySection(day, members, group) {
  return h("section", { class: "day" },
    h("h2", { class: "day-heading" },
      h("span", {}, formatDay(day.date, getLang())),
      h("span", { class: "day-total" }, formatKip(day.total))),
    h("ul", { class: "list card expense-list" }, day.expenses.map((expense) =>
      h("li", {}, expenseRow(expense, members, group)))));
}

function expenseRow(expense, members, group) {
  const payers = expense.payers.map((p) => members.get(p.member_id) ?? { id: p.member_id, name: "?" });
  return h("a", {
    class: ["expense-row", "row-link", expense.unbalanced_by !== 0 && "is-unbalanced"],
    href: `/g/${group.token}/expenses/${expense.id}`,
  },
  // Who paid, at a glance: one circle, or two overlapping for a shared bill.
  h("span", { class: ["payer-avatars", payers.length > 1 && "is-several"] },
    payers.slice(0, 2).map((m) => avatar(m))),
  h("span", { class: "expense-main" },
    h("span", { class: "expense-desc" }, expense.description),
    h("span", { class: "expense-meta" },
      h("span", { class: "cell-payers" }, payerSummary(payers)),
      " · ",
      h("span", { class: "cell-split" }, t("expenses.splitCount", { count: expense.shares.length })))),
  h("span", { class: "cell-amount" },
    h("span", { class: "amount" }, formatKip(expense.amount)),
    unbalancedBadge(expense)));
}

function payerSummary(payers) {
  const [first, ...rest] = payers.map((m) => m.name);
  return rest.length ? t("expenses.others", { name: first, count: rest.length }) : first;
}

function unbalancedBadge(expense) {
  if (expense.unbalanced_by === 0) return null;
  const amount = formatKip(Math.abs(expense.unbalanced_by));
  return h("span", { class: "badge badge-warning" },
    t(expense.unbalanced_by < 0 ? "expenses.missing" : "expenses.over", { amount }));
}
