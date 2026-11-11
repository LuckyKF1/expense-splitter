// "/g/:token/members" — people in the group, plus group settings.

import { api } from "../api.js";
import { h, icon } from "../dom.js";
import { describeError, t } from "../i18n.js";
import { forgetGroup } from "../storage.js";

export async function renderMembers(root, ctx) {
  const group = ctx.group;
  document.title = `${t("nav.members")} · ${group.name}`;
  root.append(
    h("div", { class: "grid grid-main-side" },
      membersCard(group, ctx),
      h("div", { class: "stack-lg" }, groupCard(group, ctx), dangerCard(group, ctx))));
}

// ---- Members --------------------------------------------------------------

function membersCard(group, ctx) {
  const active = group.members.filter((m) => !m.archived).length;
  return h("section", { class: "card" },
    h("div", { class: "card-header" },
      h("h2", { class: "card-title" }, t("members.title")),
      h("span", { class: "badge" }, t("members.count", { count: active }))),
    addMemberForm(group, ctx),
    group.members.length === 0
      ? h("p", { class: "empty" }, t("members.empty"))
      : h("ul", { class: "list" }, group.members.map((m) => memberRow(group, m, ctx))));
}

function addMemberForm(group, ctx) {
  const input = h("input", {
    id: "member-add", class: "input", maxlength: 50, autocomplete: "off",
    placeholder: t("members.addPlaceholder"), "aria-label": t("members.addPlaceholder"),
  });
  const error = h("p", { class: "field-error", role: "alert" });

  async function onSubmit(event) {
    event.preventDefault();
    if (!input.value.trim()) return input.focus();
    try {
      await api.addMember(group.token, input.value);
      // Stay in the input so several names can be added in a row.
      await ctx.refresh({ focus: "#member-add" });
    } catch (err) {
      error.textContent = describeError(err);
      input.focus();
    }
  }

  return h("form", { class: "stack-sm", onSubmit, novalidate: true },
    h("div", { class: "input-row" }, input,
      h("button", { class: "btn btn-primary", type: "submit" }, icon("plus"), t("action.add"))),
    error);
}

function memberRow(group, member, ctx) {
  const row = h("li", { class: ["list-row", member.archived && "is-inactive"] });
  showMember();
  return row;

  function showMember() {
    row.replaceChildren(
      h("span", { class: "list-main" },
        h("span", { class: "member-name" }, member.name),
        member.archived && h("span", { class: "badge badge-muted" }, t("members.inactive"))),
      h("span", { class: "row-actions" },
        iconButton("edit", t("members.rename", { name: member.name }), showRenameForm),
        member.archived
          ? iconButton("restore", `${t("action.restore")}: ${member.name}`,
            () => setArchived(false))
          : iconButton("archive", `${t("action.archive")}: ${member.name}`,
            () => setArchived(true)),
        iconButton("trash", `${t("action.delete")}: ${member.name}`, remove, "danger")));
  }

  function showRenameForm() {
    const input = h("input", {
      class: "input", value: member.name, maxlength: 50,
      "aria-label": t("members.rename", { name: member.name }),
    });
    const error = h("p", { class: "field-error", role: "alert" });
    row.replaceChildren(h("form", {
      class: "stack-sm grow", novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        try {
          await api.updateMember(group.token, member.id, { name: input.value });
          ctx.toast(t("status.saved"));
          await ctx.refresh();
        } catch (err) {
          error.textContent = describeError(err);
        }
      },
    },
    h("div", { class: "input-row" }, input,
      h("button", { class: "btn btn-primary", type: "submit" }, t("action.save")),
      h("button", { class: "btn", type: "button", onClick: showMember }, t("action.cancel"))),
    error));
    input.focus();
    input.select();
  }

  async function setArchived(archived) {
    await ctx.run(async () => {
      await api.updateMember(group.token, member.id, { archived });
      await ctx.refresh();
    });
  }

  async function remove() {
    if (!confirm(t("members.confirmDelete", { name: member.name }))) return;
    try {
      await api.deleteMember(group.token, member.id);
      ctx.toast(t("status.deleted"));
      await ctx.refresh();
    } catch (err) {
      if (err.code !== "MEMBER_IN_USE") return ctx.toast(describeError(err), { error: true });
      if (confirm(t("members.inUse", { name: member.name }))) await setArchived(true);
    }
  }
}

function iconButton(name, label, onClick, variant) {
  return h("button", {
    class: ["btn-icon", variant && `btn-icon-${variant}`], type: "button",
    title: label, "aria-label": label, onClick,
  }, icon(name));
}

// ---- Group settings ---------------------------------------------------------

function groupCard(group, ctx) {
  const input = h("input", {
    id: "group-rename", class: "input", value: group.name, maxlength: 100,
  });
  const error = h("p", { class: "field-error", role: "alert" });

  async function onSubmit(event) {
    event.preventDefault();
    error.textContent = "";
    try {
      await api.renameGroup(group.token, input.value);
      ctx.toast(t("status.saved"));
      await ctx.refresh();
    } catch (err) {
      error.textContent = describeError(err);
    }
  }

  return h("section", { class: "card" },
    h("h2", { class: "card-title" }, t("group.title")),
    h("form", { class: "stack-sm", onSubmit, novalidate: true },
      h("label", { class: "label", for: "group-rename" }, t("group.rename")),
      h("div", { class: "input-row" }, input,
        h("button", { class: "btn", type: "submit" }, t("action.save"))),
      error),
    h("div", { class: "stack-sm share-block" },
      h("button", { class: "btn btn-primary btn-block", type: "button", onClick: ctx.share },
        icon("share"), t("action.share")),
      h("p", { class: "muted small" }, t("group.shareHint"))));
}

function dangerCard(group, ctx) {
  async function onDelete() {
    if (!confirm(t("group.confirmDelete", { name: group.name }))) return;
    await ctx.run(async () => {
      await api.deleteGroup(group.token);
      forgetGroup(group.token);
      ctx.toast(t("status.deleted"));
      ctx.navigate("/");
    });
  }
  return h("section", { class: "card card-danger" },
    h("h2", { class: "card-title" }, t("group.dangerTitle")),
    h("p", { class: "muted small" }, t("group.dangerHint")),
    h("button", { class: "btn btn-danger", type: "button", onClick: onDelete },
      icon("trash"), t("group.dangerTitle")));
}
