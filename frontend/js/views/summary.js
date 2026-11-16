// "/g/:token" — your own balance first, then everyone's, then what blocks
// settling up.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { formatKip } from "../format.js";
import { t } from "../i18n.js";
import { setWhoAmI, whoAmI } from "../storage.js";
import { avatar, needMembersCard, unbalancedBanner } from "./shared.js";

export const loadSummary = (token) => api.getSummary(token);

export async function renderSummary(root, ctx) {
  const group = ctx.group;
  document.title = `${t("summary.title")} · ${group.name}`;
  const summary = ctx.data;
  const newPath = `/g/${group.token}/expenses/new`;

  root.append(h("div", { class: "page-header" },
    h("h1", { class: "page-title" }, t("summary.title")),
    summary.member_count > 0 && h("a", { class: "btn btn-primary hide-phone", href: newPath },
      icon("plus"), t("expenses.add"))));

  if (summary.member_count === 0) return root.append(needMembersCard(group.token));

  // Inactive members only matter while they still have money involved.
  // (The summary API names the id member_id; avatars and "who am I" use id.)
  const people = summary.members
    .map((m) => ({ ...m, id: m.member_id }))
    .filter((m) => !m.archived || m.paid || m.share || m.balance);
  const me = people.find((m) => m.id === whoAmI(group.token)) ?? null;
  const canSettle = summary.is_balanced && people.some((m) => m.balance !== 0);

  root.append(
    heroCard(summary, people, me, canSettle, ctx),
    metaLine(summary));
  if (!summary.is_balanced) {
    root.append(unbalancedBanner(group.token, summary.unbalanced_expenses, summary.balance_total));
  }
  root.append(
    summary.expense_count === 0
      ? h("section", { class: "card state-card" },
        h("p", { class: "muted" }, t("summary.empty")),
        h("a", { class: "btn btn-primary", href: newPath }, icon("plus"), t("expenses.add")))
      : balancesCard(people, me, canSettle, group),
    h("a", { class: "fab", href: newPath, "aria-label": t("expenses.add"), title: t("expenses.add") },
      icon("plus")));
}

/** The answer to "where do I stand?", or a prompt to say who you are. */
function heroCard(summary, people, me, canSettle, ctx) {
  const token = ctx.group.token;
  const choose = async (id) => {
    setWhoAmI(token, id);
    await ctx.refresh();
  };

  if (!me) {
    const active = people.filter((m) => !m.archived);
    return h("section", { class: "card hero-card" },
      h("p", { class: "hero-label" }, t("summary.groupTotal")),
      heroAmount(summary.total_expenses),
      h("div", { class: "hero-ask" },
        h("h2", { class: "hero-question" }, t("summary.whoAreYou")),
        h("p", { class: "hero-hint" }, t("summary.whoAreYouHint")),
        h("div", { class: "hero-people" }, active.map((m) =>
          h("button", { class: "person-chip", type: "button", onClick: () => choose(m.id) },
            avatar(m, { size: "sm" }), h("span", { class: "person-chip-name" }, m.name))))));
  }

  const kind = me.balance > 0 ? "positive" : me.balance < 0 ? "negative" : "even";
  const label = { positive: "summary.youGetBack", negative: "summary.youOwe", even: "summary.youAreEven" }[kind];
  return h("section", { class: ["card", "hero-card", `hero-${kind}`] },
    h("div", { class: "hero-me" },
      avatar(me, { size: "sm" }),
      h("span", { class: "hero-me-name" }, me.name)),
    h("p", { class: "hero-label" }, t(label)),
    me.balance !== 0 && heroAmount(Math.abs(me.balance)),
    h("div", { class: "hero-actions" },
      canSettle && me.balance !== 0 && h("a", { class: "btn btn-on-hero", href: `/g/${token}/settle` },
        icon("settle"), t("summary.settleNow")),
      h("button", { class: "btn-link hero-switch", type: "button", onClick: () => choose(null) },
        t("summary.notYou", { name: me.name }))));
}

/** The big number; smaller type for 10+ digits so it never breaks mid-number. */
function heroAmount(amount) {
  const text = formatKip(amount);
  return h("p", { class: ["hero-amount", text.length > 13 && "is-long"] }, text);
}

/** "4 expenses · 5 people · 200,000 ₭ paid back" */
function metaLine(summary) {
  const transferred = summary.members.reduce((sum, m) => sum + m.settled_out, 0);
  const counts = summary.expense_count === 1
    ? t("summary.metaOne", { people: summary.member_count })
    : t("summary.meta", { count: summary.expense_count, people: summary.member_count });
  return h("p", { class: "summary-meta" },
    counts,
    transferred > 0 && ` · ${t("summary.paidBack", { amount: formatKip(transferred) })}`);
}

function balancesCard(people, me, canSettle, group) {
  const settled = people.every((m) => m.balance === 0);
  const largest = Math.max(1, ...people.map((m) => Math.abs(m.balance)));
  return h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("summary.balancesTitle")),
    h("ul", { class: "list balance-list" }, people.map((m) => {
      const net = m.settled_out - m.settled_in;
      const kind = m.balance > 0 ? "positive" : m.balance < 0 ? "negative" : "even";
      return h("li", { class: ["balance-row", m === me && "is-me"] },
        avatar(m),
        h("div", { class: "balance-main" },
          h("div", { class: "balance-head" },
            h("span", { class: "cell-name" }, m.name),
            m === me && h("span", { class: "badge" }, t("summary.you")),
            m.archived && h("span", { class: "badge badge-muted" }, t("members.inactive"))),
          h("p", { class: "cell-detail" }, net
            ? t("summary.detailTransfers", {
              paid: formatKip(m.paid), share: formatKip(m.share), transfers: formatKip(net, { signed: true }),
            })
            : t("summary.detail", { paid: formatKip(m.paid), share: formatKip(m.share) }))),
        h("div", { class: "cell-balance" }, balance(m.balance)),
        // Length shows who is furthest from even; colour and the word
        // next to the amount say which way.
        balanceBar(kind, Math.abs(m.balance) / largest));
    })),
    settled
      ? h("p", { class: "all-settled" }, icon("check"), t("summary.allSettled"))
      : canSettle && !me && h("a", { class: "btn btn-primary", href: `/g/${group.token}/settle` },
        icon("settle"), t("summary.settleCta")));
}

function balanceBar(kind, fraction) {
  const fill = h("span", { class: `balance-bar-fill bar-${kind}` });
  // Set through the style property: CSP (style-src 'self') blocks style="" attributes.
  fill.style.width = `${Math.round(fraction * 100)}%`;
  return h("div", { class: "balance-bar", "aria-hidden": "true" }, fill);
}

/** Coloured amount plus a word, so meaning never relies on colour alone. */
function balance(amount) {
  const kind = amount > 0 ? "positive" : amount < 0 ? "negative" : "even";
  const word = t(amount > 0 ? "summary.getsBack" : amount < 0 ? "summary.owes" : "summary.even");
  return h("span", { class: `balance balance-${kind}` },
    h("span", { class: "amount" }, formatKip(Math.abs(amount))),
    h("span", { class: "balance-word" }, word));
}
