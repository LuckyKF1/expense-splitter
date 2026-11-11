// Building blocks shared by several views.

import { h, icon } from "../dom.js";
import { formatKip, groupDigits, parseKip } from "../format.js";
import { t } from "../i18n.js";

/** Label + input (+ optional hint), stacked. */
export function field(id, label, input, hint) {
  return h("div", { class: "stack-sm" },
    h("label", { class: "label", for: id }, label),
    input,
    hint && h("p", { class: "muted small" }, hint));
}

/** Text input for Kip: numeric keypad on phones, reformatted on blur. */
export function moneyInput(id, value, ariaLabel) {
  const input = h("input", {
    id, class: "input input-money", inputmode: "numeric", autocomplete: "off",
    value: value ? groupDigits(value) : "", "aria-label": ariaLabel, placeholder: "0",
  });
  input.addEventListener("blur", () => {
    const parsed = parseKip(input.value);
    if (parsed !== null && input.value.trim()) input.value = groupDigits(parsed);
  });
  return input;
}

/**
 * Warning listing expenses whose payers don't add up, each linking to its
 * edit screen. Settling up is blocked until this list is empty.
 */
export function unbalancedBanner(token, unbalancedExpenses, balanceTotal) {
  return h("section", { class: "banner banner-warning", role: "alert" },
    h("h2", { class: "banner-title" }, t("unbalanced.title")),
    h("p", {}, t("unbalanced.body", { amount: formatKip(balanceTotal, { signed: true }) })),
    h("ul", { class: "banner-list" }, unbalancedExpenses.map((e) =>
      h("li", {},
        h("a", { href: `/g/${token}/expenses/${e.id}` }, e.description),
        " ",
        h("span", { class: "badge badge-warning" },
          t(e.unbalanced_by < 0 ? "expenses.missing" : "expenses.over",
            { amount: formatKip(Math.abs(e.unbalanced_by)) })),
        h("span", { class: "banner-fix" }, icon("edit"))))));
}

/** "No members yet" state with a button to the members page. */
export function needMembersCard(token) {
  return h("section", { class: "card state-card" },
    h("p", {}, t("expenses.needMembers")),
    h("a", { class: "btn btn-primary", href: `/g/${token}/members` }, t("expenses.goToMembers")));
}
