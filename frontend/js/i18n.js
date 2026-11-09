// English / Lao text. The backend only sends stable codes; every word a
// person reads comes from here. tests/js/i18n.test.mjs checks both
// languages define the same keys and placeholders.

import { storage } from "./storage.js";

export const MESSAGES = {
  en: {
    "app.name": "Expense Splitter",
    "app.tagline": "Split trips, meals and activities fairly, in Kip.",
    "lang.switch": "ລາວ",
    "lang.switchLabel": "ປ່ຽນເປັນພາສາລາວ",

    "nav.summary": "Summary",
    "nav.expenses": "Expenses",
    "nav.settle": "Settle up",
    "nav.members": "Members",
    "nav.main": "Main",

    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.add": "Add",
    "action.archive": "Deactivate",
    "action.restore": "Reactivate",
    "action.share": "Share link",
    "action.retry": "Try again",
    "action.back": "Back",

    "status.loading": "Loading…",
    "status.saved": "Saved",
    "status.deleted": "Deleted",
    "status.linkCopied": "Link copied",
    "status.copyFailed": "Couldn't copy. The link is: {url}",
    "status.comingSoon": "This screen arrives in the next step.",

    "home.createTitle": "Create a group",
    "home.groupName": "Group name",
    "home.groupNamePlaceholder": "e.g. Vang Vieng trip",
    "home.create": "Create group",
    "home.recentTitle": "Your groups",
    "home.recentHint": "Groups opened on this device.",
    "home.noRecent": "No groups yet. Create one, or open a link a friend shared.",
    "home.forget": "Remove from this list",

    "members.title": "Members",
    "members.addPlaceholder": "Name",
    "members.empty": "Add everyone who shares the costs.",
    "members.inactive": "Inactive",
    "members.count": "{count} active",
    "members.confirmDelete": "Delete {name}?",
    "members.inUse": "{name} is part of expenses or payments, so they can't be deleted. Deactivate them instead? Their history stays.",
    "members.rename": "Rename {name}",

    "group.title": "Group",
    "group.rename": "Group name",
    "group.shareHint": "Anyone with this link can view and edit the group.",
    "group.dangerTitle": "Delete group",
    "group.dangerHint": "Deletes the group, all expenses and payments. This cannot be undone.",
    "group.confirmDelete": "Delete “{name}” and everything in it? This cannot be undone.",
    "group.notFoundTitle": "Group not found",

    "field.name": "Name",
    "field.description": "Description",
    "field.amount": "Amount",
    "field.spent_at": "Date",
    "field.payers": "Paid by",
    "field.participants": "Split between",
    "field.paid_at": "Payment date",
    "field.note": "Note",
    "field.from_member_id": "From",
    "field.to_member_id": "To",
    "field.archived": "Status",

    "reason.required": "{field} is required.",
    "reason.not_string": "{field} is invalid.",
    "reason.too_long": "{field} is too long.",
    "reason.invalid_characters": "{field} contains characters that aren't allowed.",
    "reason.not_boolean": "{field} is invalid.",
    "reason.no_changes": "Nothing to change.",
    "reason.not_integer": "{field} must be a whole number of Kip.",
    "reason.out_of_range": "{field} is outside the allowed range.",
    "reason.invalid_date": "Enter a valid date.",
    "reason.not_list": "{field} is invalid.",
    "reason.invalid_item": "{field} has an invalid entry.",
    "reason.duplicate_member": "Each person can appear only once in {field}.",
    "reason.unknown_member": "Someone in {field} is not in this group.",
    "reason.archived_member": "Inactive members can't be added to new expenses.",
    "reason.same_member": "Sender and receiver must be different people.",

    "error.GROUP_NOT_FOUND": "This group doesn't exist, or it was deleted.",
    "error.MEMBER_NOT_FOUND": "That member no longer exists.",
    "error.EXPENSE_NOT_FOUND": "That expense no longer exists.",
    "error.SETTLEMENT_NOT_FOUND": "That payment no longer exists.",
    "error.MEMBER_NAME_TAKEN": "Someone in this group already has that name.",
    "error.MEMBER_IN_USE": "This member is part of expenses or payments.",
    "error.MEMBER_LIMIT_REACHED": "This group has reached the member limit.",
    "error.EXPENSE_LIMIT_REACHED": "This group has reached the expense limit.",
    "error.SETTLEMENT_LIMIT_REACHED": "This group has reached the payment limit.",
    "error.UNBALANCED_EXPENSES": "Some expenses don't add up. Fix them before settling.",
    "error.INVALID_JSON": "The request was malformed.",
    "error.BODY_TOO_LARGE": "The request was too large.",
    "error.NOT_FOUND": "Not found.",
    "error.METHOD_NOT_ALLOWED": "That action isn't allowed.",
    "error.INTERNAL_ERROR": "Something went wrong on the server. Please try again.",
    "error.NETWORK_ERROR": "Can't reach the server. Check your connection.",
    "error.UNKNOWN_ERROR": "Something went wrong. Please try again.",
  },

  lo: {
    "app.name": "ແບ່ງຄ່າໃຊ້ຈ່າຍ",
    "app.tagline": "ແບ່ງຄ່າທ່ຽວ ຄ່າອາຫານ ແລະ ກິດຈະກຳ ຢ່າງຍຸດຕິທຳ ເປັນເງິນກີບ.",
    "lang.switch": "EN",
    "lang.switchLabel": "Switch to English",

    "nav.summary": "ສະຫຼຸບ",
    "nav.expenses": "ລາຍຈ່າຍ",
    "nav.settle": "ຊຳລະເງິນ",
    "nav.members": "ສະມາຊິກ",
    "nav.main": "ເມນູຫຼັກ",

    "action.save": "ບັນທຶກ",
    "action.cancel": "ຍົກເລີກ",
    "action.delete": "ລຶບ",
    "action.edit": "ແກ້ໄຂ",
    "action.add": "ເພີ່ມ",
    "action.archive": "ປິດການໃຊ້ງານ",
    "action.restore": "ເປີດການໃຊ້ງານ",
    "action.share": "ແບ່ງປັນລິ້ງ",
    "action.retry": "ລອງໃໝ່",
    "action.back": "ກັບຄືນ",

    "status.loading": "ກຳລັງໂຫຼດ…",
    "status.saved": "ບັນທຶກແລ້ວ",
    "status.deleted": "ລຶບແລ້ວ",
    "status.linkCopied": "ສຳເນົາລິ້ງແລ້ວ",
    "status.copyFailed": "ສຳເນົາບໍ່ໄດ້. ລິ້ງແມ່ນ: {url}",
    "status.comingSoon": "ໜ້ານີ້ຈະມາໃນຂັ້ນຕອນຕໍ່ໄປ.",

    "home.createTitle": "ສ້າງກຸ່ມ",
    "home.groupName": "ຊື່ກຸ່ມ",
    "home.groupNamePlaceholder": "ເຊັ່ນ: ທ່ຽວວັງວຽງ",
    "home.create": "ສ້າງກຸ່ມ",
    "home.recentTitle": "ກຸ່ມຂອງທ່ານ",
    "home.recentHint": "ກຸ່ມທີ່ເຄີຍເປີດໃນອຸປະກອນນີ້.",
    "home.noRecent": "ຍັງບໍ່ມີກຸ່ມ. ສ້າງກຸ່ມໃໝ່ ຫຼື ເປີດລິ້ງທີ່ໝູ່ສົ່ງມາ.",
    "home.forget": "ເອົາອອກຈາກລາຍການນີ້",

    "members.title": "ສະມາຊິກ",
    "members.addPlaceholder": "ຊື່",
    "members.empty": "ເພີ່ມທຸກຄົນທີ່ຮ່ວມຈ່າຍ.",
    "members.inactive": "ປິດໃຊ້ງານ",
    "members.count": "ໃຊ້ງານ {count} ຄົນ",
    "members.confirmDelete": "ລຶບ {name} ບໍ?",
    "members.inUse": "{name} ມີລາຍຈ່າຍ ຫຼື ການໂອນແລ້ວ ຈຶ່ງລຶບບໍ່ໄດ້. ປິດການໃຊ້ງານແທນບໍ? ປະຫວັດຍັງຢູ່ຄືເກົ່າ.",
    "members.rename": "ປ່ຽນຊື່ {name}",

    "group.title": "ກຸ່ມ",
    "group.rename": "ຊື່ກຸ່ມ",
    "group.shareHint": "ທຸກຄົນທີ່ມີລິ້ງນີ້ ເບິ່ງ ແລະ ແກ້ໄຂກຸ່ມໄດ້.",
    "group.dangerTitle": "ລຶບກຸ່ມ",
    "group.dangerHint": "ລຶບກຸ່ມ, ລາຍຈ່າຍ ແລະ ການໂອນທັງໝົດ. ກູ້ຄືນບໍ່ໄດ້.",
    "group.confirmDelete": "ລຶບ “{name}” ແລະ ທຸກຢ່າງໃນກຸ່ມບໍ? ກູ້ຄືນບໍ່ໄດ້.",
    "group.notFoundTitle": "ບໍ່ພົບກຸ່ມ",

    "field.name": "ຊື່",
    "field.description": "ລາຍລະອຽດ",
    "field.amount": "ຈຳນວນເງິນ",
    "field.spent_at": "ວັນທີ",
    "field.payers": "ຜູ້ຈ່າຍ",
    "field.participants": "ຫານກັບ",
    "field.paid_at": "ວັນທີໂອນ",
    "field.note": "ໝາຍເຫດ",
    "field.from_member_id": "ຜູ້ໂອນ",
    "field.to_member_id": "ຜູ້ຮັບ",
    "field.archived": "ສະຖານະ",

    "reason.required": "ກະລຸນາໃສ່{field}.",
    "reason.not_string": "{field}ບໍ່ຖືກຕ້ອງ.",
    "reason.too_long": "{field}ຍາວເກີນໄປ.",
    "reason.invalid_characters": "{field}ມີຕົວອັກສອນທີ່ບໍ່ອະນຸຍາດ.",
    "reason.not_boolean": "{field}ບໍ່ຖືກຕ້ອງ.",
    "reason.no_changes": "ບໍ່ມີຫຍັງປ່ຽນແປງ.",
    "reason.not_integer": "{field}ຕ້ອງເປັນຈຳນວນເຕັມກີບ.",
    "reason.out_of_range": "{field}ເກີນຂອບເຂດທີ່ອະນຸຍາດ.",
    "reason.invalid_date": "ກະລຸນາໃສ່ວັນທີໃຫ້ຖືກຕ້ອງ.",
    "reason.not_list": "{field}ບໍ່ຖືກຕ້ອງ.",
    "reason.invalid_item": "{field}ມີລາຍການທີ່ບໍ່ຖືກຕ້ອງ.",
    "reason.duplicate_member": "ແຕ່ລະຄົນເລືອກໄດ້ຄັ້ງດຽວໃນ{field}.",
    "reason.unknown_member": "ມີຄົນໃນ{field}ທີ່ບໍ່ຢູ່ໃນກຸ່ມນີ້.",
    "reason.archived_member": "ສະມາຊິກທີ່ປິດໃຊ້ງານແລ້ວ ເພີ່ມໃສ່ລາຍຈ່າຍໃໝ່ບໍ່ໄດ້.",
    "reason.same_member": "ຜູ້ໂອນ ແລະ ຜູ້ຮັບ ຕ້ອງເປັນຄົນລະຄົນ.",

    "error.GROUP_NOT_FOUND": "ບໍ່ພົບກຸ່ມນີ້ ຫຼື ກຸ່ມຖືກລຶບແລ້ວ.",
    "error.MEMBER_NOT_FOUND": "ບໍ່ພົບສະມາຊິກນີ້ແລ້ວ.",
    "error.EXPENSE_NOT_FOUND": "ບໍ່ພົບລາຍຈ່າຍນີ້ແລ້ວ.",
    "error.SETTLEMENT_NOT_FOUND": "ບໍ່ພົບການໂອນນີ້ແລ້ວ.",
    "error.MEMBER_NAME_TAKEN": "ມີຄົນໃນກຸ່ມໃຊ້ຊື່ນີ້ແລ້ວ.",
    "error.MEMBER_IN_USE": "ສະມາຊິກນີ້ມີລາຍຈ່າຍ ຫຼື ການໂອນແລ້ວ.",
    "error.MEMBER_LIMIT_REACHED": "ກຸ່ມນີ້ມີສະມາຊິກຄົບຈຳນວນສູງສຸດແລ້ວ.",
    "error.EXPENSE_LIMIT_REACHED": "ກຸ່ມນີ້ມີລາຍຈ່າຍຄົບຈຳນວນສູງສຸດແລ້ວ.",
    "error.SETTLEMENT_LIMIT_REACHED": "ກຸ່ມນີ້ມີການໂອນຄົບຈຳນວນສູງສຸດແລ້ວ.",
    "error.UNBALANCED_EXPENSES": "ມີລາຍຈ່າຍທີ່ຍອດບໍ່ກົງກັນ. ກະລຸນາແກ້ໄຂກ່ອນຊຳລະເງິນ.",
    "error.INVALID_JSON": "ຂໍ້ມູນທີ່ສົ່ງບໍ່ຖືກຮູບແບບ.",
    "error.BODY_TOO_LARGE": "ຂໍ້ມູນທີ່ສົ່ງໃຫຍ່ເກີນໄປ.",
    "error.NOT_FOUND": "ບໍ່ພົບ.",
    "error.METHOD_NOT_ALLOWED": "ບໍ່ອະນຸຍາດໃຫ້ເຮັດແບບນີ້.",
    "error.INTERNAL_ERROR": "ເຊີບເວີມີບັນຫາ. ກະລຸນາລອງໃໝ່.",
    "error.NETWORK_ERROR": "ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້. ກະລຸນາກວດອິນເຕີເນັດ.",
    "error.UNKNOWN_ERROR": "ມີບາງຢ່າງຜິດພາດ. ກະລຸນາລອງໃໝ່.",
  },
};

export const LANGUAGES = ["en", "lo"];

/** Pure lookup: lang -> English -> the key itself, then fill {params}. */
export function translate(lang, key, params = {}) {
  const text = MESSAGES[lang]?.[key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match);
}

/** Human message for an ApiError-like {code, details}. */
export function errorMessage(lang, err) {
  if (err.code === "VALIDATION_ERROR") {
    const { field, reason } = err.details ?? {};
    const fieldName = field ? translate(lang, `field.${field}`) : "";
    return translate(lang, `reason.${reason}`, { field: fieldName });
  }
  const key = `error.${err.code}`;
  return key in MESSAGES.en ? translate(lang, key) : translate(lang, "error.UNKNOWN_ERROR");
}

// ---- Current language (browser state) ---------------------------------------

let currentLang = pickInitialLang();

function pickInitialLang() {
  const saved = storage.get("lang");
  if (LANGUAGES.includes(saved)) return saved;
  const browser = globalThis.navigator?.language ?? "";
  return browser.toLowerCase().startsWith("lo") ? "lo" : "en";
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = LANGUAGES.includes(lang) ? lang : "en";
  storage.set("lang", currentLang);
  if (globalThis.document) document.documentElement.lang = currentLang;
}

/** Translate in the current language. */
export function t(key, params) {
  return translate(currentLang, key, params);
}

export function describeError(err) {
  return errorMessage(currentLang, err);
}
