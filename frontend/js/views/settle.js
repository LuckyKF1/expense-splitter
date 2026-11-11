// "/g/:token/settle" — suggested transfers, recording payments, history.

import { api } from "../api.js";
import { h, icon, whileBusy } from "../dom.js";
import { formatDate, formatKip, parseKip, todayIso } from "../format.js";
import { describeError, getLang, t } from "../i18n.js";
import { field, moneyInput, needMembersCard, unbalancedBanner } from "./shared.js";

export async function loadSettle(token) {
  const [suggestions, history] = await Promise.all([
    api.getSuggestions(token).catch((err) => {
      if (err.code === "UNBALANCED_EXPENSES") return { blocked: err.details };
      throw err;
    }),
    api.listSettlements(token),
  ]);
  return { suggestions, history };
}

export async function renderSettle(root, ctx) {
  const group = ctx.group;
  document.title = `${t("settle.title")} · ${group.name}`;
  root.append(h("h1", { class: "page-title" }, t("settle.title")));
  if (!group.members.some((m) => !m.archived)) return root.append(needMembersCard(group.token));
  const { suggestions, history } = ctx.data;

  root.append(h("div", { class: "grid grid-main-side" },
    h("div", { class: "stack-lg" },
      suggestions.blocked
        ? unbalancedBanner(group.token, suggestions.blocked.unbalanced_expenses,
          suggestions.blocked.balance_total)
        : suggestionsCard(suggestions.transfers, group, ctx),
      historyCard(history, group, ctx)),
    recordCard(group, ctx)));
}

function suggestionsCard(transfers, group, ctx) {
  const card = h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("settle.suggestionsTitle")));
  if (transfers.length === 0) {
    card.append(h("p", { class: "all-settled" }, icon("check"), t("summary.allSettled")));
    return card;
  }
  card.append(
    h("p", { class: "muted small" }, t("settle.suggestionsHint")),
    h("ul", { class: "list" }, transfers.map((transfer) =>
      h("li", { class: "transfer-row" },
        h("span", { class: "transfer-people" },
          h("strong", {}, transfer.from_name),
          h("span", { class: "transfer-arrow" }, " ", t("settle.pays"), " "),
          h("strong", {}, transfer.to_name)),
        h("span", { class: "amount transfer-amount" }, formatKip(transfer.amount)),
        h("button", {
          class: "btn btn-small transfer-action", type: "button",
          onClick: (event) => markPaid(transfer, group, ctx, event.currentTarget),
        }, icon("check"), t("settle.markPaid"))))));
  return card;
}

async function markPaid(transfer, group, ctx, button) {
  const question = t("settle.confirmPaid", {
    from: transfer.from_name, to: transfer.to_name, amount: formatKip(transfer.amount),
  });
  if (button.disabled || !confirm(question)) return;
  await ctx.run(() => whileBusy(button, async () => {
    await api.recordSettlement(group.token, {
      from_member_id: transfer.from_member_id, to_member_id: transfer.to_member_id,
      amount: transfer.amount, paid_at: todayIso(),
    });
    ctx.toast(t("settle.recorded"));
    await ctx.refresh();
  }));
}

function recordCard(group, ctx) {
  // Inactive members may still owe or be owed, so everyone is listed.
  const options = () => [h("option", { value: "" }, t("settle.choose")),
    ...group.members.map((m) => h("option", { value: m.id }, m.name))];
  const from = h("select", { id: "pay-from", class: "input" }, options());
  const to = h("select", { id: "pay-to", class: "input" }, options());
  const amount = moneyInput("pay-amount");
  const paidAt = h("input", { id: "pay-date", class: "input", type: "date", value: todayIso() });
  const note = h("input", {
    id: "pay-note", class: "input", maxlength: 200, autocomplete: "off",
    placeholder: t("settle.notePlaceholder"),
  });
  const error = h("p", { class: "form-error", role: "alert" });
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, t("settle.record"));

  async function onSubmit(event) {
    event.preventDefault();
    error.textContent = "";
    const value = parseKip(amount.value);
    if (!from.value || !to.value) {
      error.textContent = t("reason.required", { field: t(from.value ? "field.to_member_id" : "field.from_member_id") });
      return;
    }
    if (from.value === to.value) return void (error.textContent = t("reason.same_member"));
    if (!value) return void (error.textContent = t("form.invalidAmount"));
    try {
      await whileBusy(submit, async () => {
        await api.recordSettlement(group.token, {
          from_member_id: Number(from.value), to_member_id: Number(to.value),
          amount: value, paid_at: paidAt.value, note: note.value,
        });
        ctx.toast(t("settle.recorded"));
        await ctx.refresh();
      });
    } catch (err) {
      error.textContent = describeError(err);
    }
  }

  return h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("settle.recordTitle")),
    h("p", { class: "muted small" }, t("settle.recordHint")),
    h("form", { class: "stack", onSubmit, novalidate: true },
      h("div", { class: "grid grid-2 grid-tight" },
        field("pay-from", t("field.from_member_id"), from),
        field("pay-to", t("field.to_member_id"), to)),
      h("div", { class: "grid grid-2 grid-tight" },
        field("pay-amount", t("field.amount"), amount),
        field("pay-date", t("field.paid_at"), paidAt)),
      field("pay-note", t("field.note"), note),
      error,
      submit));
}

function historyCard(history, group, ctx) {
  const card = h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("settle.historyTitle")));
  if (history.length === 0) {
    card.append(h("p", { class: "empty" }, t("settle.historyEmpty")));
    return card;
  }
  card.append(h("ul", { class: "list" }, history.map((payment) =>
    h("li", { class: "list-row history-row" },
      h("span", { class: "list-main history-main" },
        h("span", {},
          h("strong", {}, payment.from_name), ` ${t("settle.pays")} `,
          h("strong", {}, payment.to_name)),
        h("span", { class: "muted small" },
          [formatDate(payment.paid_at, getLang()), payment.note].filter(Boolean).join(" · "))),
      h("span", { class: "amount" }, formatKip(payment.amount)),
      h("button", {
        class: "btn-icon btn-icon-danger", type: "button",
        "aria-label": t("settle.deleteLabel", { from: payment.from_name, to: payment.to_name }),
        title: t("action.delete"),
        onClick: async () => {
          if (!confirm(t("settle.confirmDelete"))) return;
          await ctx.run(async () => {
            await api.deleteSettlement(group.token, payment.id);
            ctx.toast(t("status.deleted"));
            await ctx.refresh();
          });
        },
      }, icon("trash"))))));
  return card;
}
