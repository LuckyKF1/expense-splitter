// "/g/:token/expenses/new" and "/g/:token/expenses/:id" — add or edit.
// Raw typed text lives in the inputs; expense-model.js interprets it.
//
// "Who paid?" has two modes. Single (the usual case): tap one name and
// that person paid the whole amount. Multi: type each person's amount,
// for bills several people chipped in on.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { buildExpense, paymentStatus, sharePreview } from "../expense-model.js";
import { formatKip, groupDigits, parseKip, todayIso } from "../format.js";
import { describeError, t } from "../i18n.js";
import { field, moneyInput } from "./shared.js";

export async function renderExpenseForm(root, ctx) {
  const group = ctx.group;
  const expenseId = ctx.params[0] ? Number(ctx.params[0]) : null;
  const existing = expenseId ? await api.getExpense(group.token, expenseId) : null;
  const listPath = `/g/${group.token}/expenses`;
  const title = t(existing ? "form.editTitle" : "form.newTitle");
  document.title = `${title} · ${group.name}`;

  // Active members, plus inactive ones already on this expense (so it stays editable).
  const onExpense = new Set([...(existing?.payers ?? []), ...(existing?.shares ?? [])]
    .map((line) => line.member_id));
  const members = group.members.filter((m) => !m.archived || onExpense.has(m.id));
  const paidBy = new Map((existing?.payers ?? []).map((p) => [p.member_id, p.amount]));
  const sharedBy = new Set(existing
    ? existing.shares.map((s) => s.member_id)
    : members.map((m) => m.id));

  // ---- Fields -----------------------------------------------------------------
  const description = h("input", {
    id: "expense-description", class: "input", maxlength: 200, autocomplete: "off",
    value: existing?.description ?? "", placeholder: t("form.descriptionPlaceholder"),
  });
  const amount = moneyInput("expense-amount", existing?.amount);
  amount.classList.add("input-large");
  const spentAt = h("input", {
    id: "expense-date", class: "input", type: "date", required: true,
    value: existing?.spent_at ?? todayIso(),
  });

  let multiPayer = (existing?.payers.length ?? 0) > 1;
  const singleOnly = existing?.payers.length === 1 ? existing.payers[0].member_id : null;
  const payerRadios = new Map(members.map((m) => [m.id, h("input", {
    type: "radio", name: "single-payer", class: "chip-input", value: m.id,
    checked: m.id === singleOnly,
  })]));

  const payerInputs = new Map(members.map((m) =>
    [m.id, moneyInput(`payer-${m.id}`, paidBy.get(m.id), `${t("field.payers")}: ${m.name}`)]));
  const paymentLine = h("p", { class: "form-status", "aria-live": "polite" });

  const checkboxes = new Map(members.map((m) => [m.id, h("input", {
    type: "checkbox", class: "chip-input", value: m.id, checked: sharedBy.has(m.id),
  })]));
  const shareLabels = new Map(members.map((m) => [m.id, h("span", { class: "chip-share" })]));
  const previewLine = h("p", { class: "form-status", "aria-live": "polite" });
  const formError = h("p", { class: "form-error", role: "alert" });

  // ---- Live feedback --------------------------------------------------------------
  function selectedIds() {
    return members.filter((m) => checkboxes.get(m.id).checked).map((m) => m.id);
  }

  function updatePayment() {
    const status = paymentStatus(amount.value, [...payerInputs.values()].map((i) => i.value));
    paymentLine.className = "form-status";
    if (!status || status.paid === 0) {
      paymentLine.textContent = "";
    } else if (status.difference === 0) {
      paymentLine.textContent = t("form.paidOk");
      paymentLine.classList.add("is-ok");
    } else {
      paymentLine.textContent = t(status.difference < 0 ? "form.paidMissing" : "form.paidOver", {
        paid: formatKip(status.paid), total: formatKip(status.total),
        difference: formatKip(Math.abs(status.difference)),
      });
      paymentLine.classList.add("is-warning");
    }
  }

  function updatePreview() {
    const preview = sharePreview(amount.value, selectedIds());
    for (const [id, label] of shareLabels) {
      label.textContent = preview?.shares.has(id) ? formatKip(preview.shares.get(id)) : "";
    }
    previewLine.textContent = !preview ? "" : [
      t("form.shareEach", { amount: formatKip(preview.each) }),
      preview.remainder ? t("form.shareRemainder", { count: preview.remainder }) : "",
    ].join(" ").trim();
  }

  function updateAll() {
    updatePayment();
    updatePreview();
  }

  amount.addEventListener("input", updateAll);
  for (const input of payerInputs.values()) input.addEventListener("input", updatePayment);
  for (const box of checkboxes.values()) box.addEventListener("change", updatePreview);

  function chosenPayer() {
    return members.find((m) => payerRadios.get(m.id).checked) ?? null;
  }

  /** What buildExpense sees, in either mode. */
  function payerLines() {
    if (multiPayer) {
      return members.map((m) => ({ memberId: m.id, name: m.name, amount: payerInputs.get(m.id).value }));
    }
    const payer = chosenPayer();
    return payer ? [{ memberId: payer.id, name: payer.name, amount: amount.value }] : [];
  }

  function setMultiPayer(on) {
    if (on && !multiPayer) {
      // Carry the single choice over: that person paid the full amount so far.
      const payer = chosenPayer();
      const total = parseKip(amount.value);
      for (const [id, input] of payerInputs) {
        input.value = payer && id === payer.id && total ? groupDigits(total) : "";
      }
    } else if (!on && multiPayer) {
      const paying = members.filter((m) => payerInputs.get(m.id).value.trim());
      for (const [id, radio] of payerRadios) radio.checked = paying.length === 1 && paying[0].id === id;
    }
    multiPayer = on;
    singleBlock.hidden = on;
    multiBlock.hidden = !on;
    modeToggle.textContent = t(on ? "form.singlePayer" : "form.multiPayers");
    updatePayment();
  }

  function payAll(memberId) {
    const total = parseKip(amount.value);
    for (const [id, input] of payerInputs) {
      input.value = id === memberId && total ? groupDigits(total) : "";
    }
    if (!total) amount.focus();
    updatePayment();
  }

  function selectAll(checked) {
    for (const box of checkboxes.values()) box.checked = checked;
    updatePreview();
  }

  // ---- Submit / delete ----------------------------------------------------------------
  async function onSubmit(event) {
    event.preventDefault();
    formError.textContent = "";
    const result = buildExpense({
      description: description.value,
      amount: amount.value,
      spentAt: spentAt.value,
      payers: payerLines(),
      participants: selectedIds(),
    });
    if (result.error) return showError(result.error);

    const { expense } = result;
    const paid = expense.payers.reduce((sum, p) => sum + p.amount, 0);
    if (paid !== expense.amount && !confirm(t("form.confirmUnbalanced",
      { difference: formatKip(paid - expense.amount, { signed: true }) }))) return;

    submit.disabled = true;
    try {
      if (existing) await api.updateExpense(group.token, existing.id, expense);
      else await api.createExpense(group.token, expense);
      ctx.toast(t("status.saved"));
      ctx.navigate(listPath);
    } catch (err) {
      submit.disabled = false;
      formError.textContent = describeError(err);
    }
  }

  function showError({ key, params, field }) {
    const fieldName = params.fieldKey ? t(params.fieldKey) : undefined;
    const message = key === "form.needPayer" && !multiPayer ? "form.choosePayer" : key;
    formError.textContent = t(message, { ...params, field: fieldName });
    const firstPayer = multiPayer ? [...payerInputs.values()][0] : [...payerRadios.values()][0];
    const target = { description, amount, payers: firstPayer }[field];
    target?.focus();
  }

  async function onDelete() {
    if (!confirm(t("form.confirmDelete", { name: existing.description }))) return;
    await ctx.run(async () => {
      await api.deleteExpense(group.token, existing.id);
      ctx.toast(t("status.deleted"));
      ctx.navigate(listPath);
    });
  }

  // ---- Layout -------------------------------------------------------------------------
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, t("action.save"));

  const singleBlock = h("div", { class: "chips", role: "radiogroup", "aria-label": t("form.whoPaid") },
    members.map((m) =>
      h("label", { class: "chip" }, payerRadios.get(m.id),
        h("span", { class: "chip-body" },
          h("span", { class: "chip-check" }, icon("check")),
          h("span", { class: "chip-name" }, m.name)))));

  const multiBlock = h("div", { class: "stack-sm" },
    h("p", { class: "muted small" }, t("form.payersHint")),
    h("ul", { class: "list payer-list" }, members.map((m) =>
      h("li", { class: "payer-row" },
        h("label", { class: "payer-name", for: `payer-${m.id}` }, m.name),
        payerInputs.get(m.id),
        h("button", {
          class: "btn btn-small", type: "button", onClick: () => payAll(m.id),
          "aria-label": t("form.paidAllLabel", { name: m.name }),
        }, t("form.paidAll"))))),
    paymentLine);

  const modeToggle = h("button", {
    class: "btn btn-small btn-link", type: "button", onClick: () => setMultiPayer(!multiPayer),
  });

  root.append(
    h("div", { class: "page-header" },
      h("a", { class: "btn-icon", href: listPath, "aria-label": t("action.back"), title: t("action.back") },
        icon("back")),
      h("h1", { class: "page-title grow" }, title)),
    h("form", { class: "card form-card", onSubmit, novalidate: true },
      // Most important first: how much, for what, who paid.
      field("expense-amount", t("field.amount"), amount, t("form.amountHint")),
      field("expense-description", t("field.description"), description),

      h("fieldset", { class: "fieldset" },
        h("legend", { class: "label" }, t("form.whoPaid")),
        singleBlock,
        multiBlock,
        h("div", {}, modeToggle)),

      h("fieldset", { class: "fieldset" },
        h("legend", { class: "label" }, t("field.participants")),
        h("div", { class: "button-pair" },
          h("button", { class: "btn btn-small", type: "button", onClick: () => selectAll(true) },
            t("form.selectAll")),
          h("button", { class: "btn btn-small", type: "button", onClick: () => selectAll(false) },
            t("form.selectNone"))),
        h("div", { class: "chips" }, members.map((m) =>
          h("label", { class: "chip" }, checkboxes.get(m.id),
            h("span", { class: "chip-body" },
              h("span", { class: "chip-check" }, icon("check")),
              h("span", { class: "chip-name" }, m.name),
              shareLabels.get(m.id))))),
        previewLine),

      h("div", { class: "date-field" }, field("expense-date", t("field.spent_at"), spentAt)),

      formError,
      h("div", { class: "form-actions" },
        submit,
        h("a", { class: "btn", href: listPath }, t("action.cancel")),
        existing && h("button", { class: "btn btn-danger push-end", type: "button", onClick: onDelete },
          icon("trash"), t("action.delete")))),
  );
  setMultiPayer(multiPayer);
  updateAll();
  // The router attaches `root` after this function returns; focus then.
  if (!existing) setTimeout(() => amount.focus(), 0);
}
