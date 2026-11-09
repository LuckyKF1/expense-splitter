// "/g/:token/expenses" — all expenses, newest first.
// One <table>: a real table on desktop, restyled as cards on phones (CSS).

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { formatDate, formatKip } from "../format.js";
import { getLang, t } from "../i18n.js";

export async function renderExpenses(root, ctx) {
  const group = ctx.group;
  document.title = `${t("expenses.title")} · ${group.name}`;
  const expenses = await api.listExpenses(group.token);
  const names = new Map(group.members.map((m) => [m.id, m.name]));
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
    root.append(header, h("section", { class: "card state-card" },
      h("p", {}, t("expenses.needMembers")),
      h("a", { class: "btn btn-primary", href: `/g/${group.token}/members` },
        t("expenses.goToMembers"))));
    return;
  }

  root.append(header,
    expenses.length === 0
      ? h("section", { class: "card state-card" },
        h("p", { class: "muted" }, t("expenses.empty")),
        h("a", { class: "btn btn-primary", href: newPath }, icon("plus"), t("expenses.add")))
      : expenseTable(expenses, names, group, ctx),
    h("a", { class: "fab", href: newPath, "aria-label": t("expenses.add"), title: t("expenses.add") },
      icon("plus")));
}

function expenseTable(expenses, names, group, ctx) {
  return h("table", { class: "expense-table" },
    h("thead", {}, h("tr", {},
      h("th", { scope: "col" }, t("field.spent_at")),
      h("th", { scope: "col" }, t("field.description")),
      h("th", { scope: "col" }, t("field.payers")),
      h("th", { scope: "col" }, t("field.participants")),
      h("th", { scope: "col", class: "num" }, t("field.amount")))),
    h("tbody", {}, expenses.map((expense) => {
      const href = `/g/${group.token}/expenses/${expense.id}`;
      return h("tr", {
        class: ["expense-row", expense.unbalanced_by !== 0 && "is-unbalanced"],
        // Whole row is tappable; the link inside keeps keyboard access.
        onClick: (event) => { if (!event.target.closest("a")) ctx.navigate(href); },
      },
      h("td", { class: "cell-date" }, formatDate(expense.spent_at, getLang())),
      h("td", { class: "cell-desc" }, h("a", { href, class: "row-link" }, expense.description)),
      h("td", { class: "cell-payers" }, payerSummary(expense, names)),
      h("td", { class: "cell-split" },
        t("expenses.splitCount", { count: expense.shares.length })),
      h("td", { class: "cell-amount num" },
        h("span", { class: "amount" }, formatKip(expense.amount)),
        unbalancedBadge(expense)));
    })));
}

function payerSummary(expense, names) {
  const [first, ...rest] = expense.payers.map((p) => names.get(p.member_id) ?? "?");
  return rest.length ? t("expenses.others", { name: first, count: rest.length }) : first;
}

function unbalancedBadge(expense) {
  if (expense.unbalanced_by === 0) return null;
  const amount = formatKip(Math.abs(expense.unbalanced_by));
  return h("span", { class: "badge badge-warning" },
    t(expense.unbalanced_by < 0 ? "expenses.missing" : "expenses.over", { amount }));
}
