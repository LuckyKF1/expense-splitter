// "/g/:token" — totals, everyone's balance, and what blocks settling up.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { formatKip } from "../format.js";
import { t } from "../i18n.js";
import { needMembersCard, unbalancedBanner } from "./shared.js";

export async function renderSummary(root, ctx) {
  const group = ctx.group;
  document.title = `${t("summary.title")} · ${group.name}`;
  const summary = await api.getSummary(group.token);
  const newPath = `/g/${group.token}/expenses/new`;

  root.append(h("div", { class: "page-header" },
    h("h1", { class: "page-title" }, t("summary.title")),
    summary.member_count > 0 && h("a", { class: "btn btn-primary hide-phone", href: newPath },
      icon("plus"), t("expenses.add"))));

  if (summary.member_count === 0) return root.append(needMembersCard(group.token));

  if (!summary.is_balanced) {
    root.append(unbalancedBanner(group.token, summary.unbalanced_expenses, summary.balance_total));
  }
  // Inactive members only matter while they still have money involved.
  const people = summary.members.filter((m) => !m.archived || m.paid || m.share || m.balance);
  const transferred = summary.members.reduce((sum, m) => sum + m.settled_out, 0);

  root.append(
    h("section", { class: "stats" },
      stat(t("summary.totalSpent"), formatKip(summary.total_expenses)),
      stat(t("summary.memberCount"), String(summary.member_count)),
      stat(t("summary.expenseCount"), String(summary.expense_count)),
      stat(t("summary.transferred"), formatKip(transferred))),
    summary.expense_count === 0
      ? h("section", { class: "card state-card" },
        h("p", { class: "muted" }, t("summary.empty")),
        h("a", { class: "btn btn-primary", href: newPath }, icon("plus"), t("expenses.add")))
      : balancesCard(people, summary, group),
    h("a", { class: "fab", href: newPath, "aria-label": t("expenses.add"), title: t("expenses.add") },
      icon("plus")));
}

function stat(label, value) {
  return h("div", { class: "stat" },
    h("span", { class: "stat-label" }, label),
    h("span", { class: "stat-value" }, value));
}

function balancesCard(people, summary, group) {
  const settled = people.every((m) => m.balance === 0);
  return h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("summary.balancesTitle")),
    h("table", { class: "balance-table" },
      h("thead", {}, h("tr", {},
        h("th", { scope: "col" }, t("summary.colName")),
        h("th", { scope: "col", class: "num" }, t("summary.colPaid")),
        h("th", { scope: "col", class: "num" }, t("summary.colShare")),
        h("th", { scope: "col", class: "num" }, t("summary.colTransfers")),
        h("th", { scope: "col", class: "num" }, t("summary.colBalance")))),
      h("tbody", {}, people.map((m) => {
        const net = m.settled_out - m.settled_in;
        return h("tr", { class: "balance-row" },
          h("th", { scope: "row", class: "cell-name" }, m.name,
            m.archived && h("span", { class: "badge badge-muted" }, t("members.inactive"))),
          h("td", { class: "num cell-paid" }, formatKip(m.paid)),
          h("td", { class: "num cell-share" }, formatKip(m.share)),
          h("td", { class: "num cell-transfers" }, net ? formatKip(net, { signed: true }) : "–"),
          h("td", { class: "num cell-balance" }, balance(m.balance)),
          h("td", { class: "cell-detail" },
            t("summary.paidShare", { paid: formatKip(m.paid), share: formatKip(m.share) })));
      }))),
    settled
      ? h("p", { class: "all-settled" }, icon("check"), t("summary.allSettled"))
      : summary.is_balanced && h("a", { class: "btn btn-primary", href: `/g/${group.token}/settle` },
        icon("settle"), t("summary.settleCta")));
}

/** Coloured amount plus a word, so meaning never relies on colour alone. */
function balance(amount) {
  const kind = amount > 0 ? "positive" : amount < 0 ? "negative" : "even";
  const word = t(amount > 0 ? "summary.getsBack" : amount < 0 ? "summary.owes" : "summary.even");
  return h("span", { class: `balance balance-${kind}` },
    h("span", { class: "amount" }, formatKip(Math.abs(amount))),
    h("span", { class: "balance-word" }, word));
}
