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
    "status.localOnly": "This address only works on this computer. Start the tunnel (scripts/tunnel.sh) and open the app from its https:// link, then share from there.",
    "status.copyFailed": "Couldn't copy. The link is: {url}",

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

    "expenses.title": "Expenses",
    "expenses.add": "Add expense",
    "expenses.empty": "No expenses yet. Add the first one.",
    "expenses.needMembers": "Add members before adding expenses.",
    "expenses.goToMembers": "Add members",
    "expenses.count": "{count} expenses · {total}",
    "expenses.countOne": "1 expense · {total}",
    "expenses.others": "{name} +{count}",
    "expenses.splitCount": "{count} people",
    "expenses.missing": "{amount} missing",
    "expenses.over": "{amount} over",

    "form.newTitle": "New expense",
    "form.editTitle": "Edit expense",
    "form.descriptionPlaceholder": "e.g. Dinner at the night market",
    "form.amountHint": "Whole Kip, e.g. 150,000",
    "form.whoPaid": "Who paid?",
    "form.multiPayers": "Several people paid",
    "form.singlePayer": "One person paid",
    "form.choosePayer": "Tap the person who paid.",
    "form.paidAll": "Paid all",
    "form.paidAllLabel": "{name} paid the whole amount",
    "form.payersHint": "Enter how much each person actually paid.",
    "form.paidOk": "Paid amounts match the total.",
    "form.paidMissing": "Paid {paid} of {total}: {difference} missing.",
    "form.paidOver": "Paid {paid} of {total}: {difference} too much.",
    "form.selectAll": "All",
    "form.selectNone": "None",
    "form.shareEach": "{amount} each",
    "form.shareRemainder": "{count} of them pay 1 ₭ more so the total is exact.",
    "form.confirmUnbalanced": "Paid amounts don't match the total ({difference}). Save anyway? Settling up stays blocked until it's fixed.",
    "form.confirmDelete": "Delete “{name}”?",
    "form.invalidAmount": "Enter the amount in whole Kip, e.g. 150,000.",
    "form.invalidPayerAmount": "Check the amount entered for {name}.",
    "form.needPayer": "Enter how much was paid, and by whom.",
    "form.needParticipant": "Choose who shares this expense.",

    "summary.title": "Summary",
    "summary.totalSpent": "Total spent",
    "summary.memberCount": "Members",
    "summary.expenseCount": "Expenses",
    "summary.transferred": "Paid back",
    "summary.balancesTitle": "Who is up, who is down",
    "summary.colName": "Name",
    "summary.colPaid": "Paid",
    "summary.colShare": "Share",
    "summary.colTransfers": "Transfers",
    "summary.colBalance": "Balance",
    "summary.getsBack": "gets back",
    "summary.owes": "owes",
    "summary.even": "even",
    "summary.paidShare": "Paid {paid} · Share {share}",
    "summary.empty": "No expenses yet. Add one to see who owes what.",
    "summary.settleCta": "See who pays whom",
    "summary.allSettled": "Everyone is settled up.",

    "unbalanced.title": "Some expenses don't add up",
    "unbalanced.body": "Paid amounts differ from the totals by {amount} overall. Fix these before settling up:",

    "settle.title": "Settle up",
    "settle.suggestionsTitle": "Suggested transfers",
    "settle.suggestionsHint": "The fewest transfers that make everyone even.",
    "settle.pays": "pays",
    "settle.markPaid": "Mark as paid",
    "settle.confirmPaid": "Record that {from} paid {to} {amount}?",
    "settle.nothingYet": "Nothing to settle yet. Add expenses first.",
    "settle.recordTitle": "Record another payment",
    "settle.recordHint": "For partial payments or anything paid outside the suggestions.",
    "settle.notePlaceholder": "e.g. BCEL One transfer",
    "settle.choose": "Choose…",
    "settle.record": "Record payment",
    "settle.recorded": "Payment recorded",
    "settle.historyTitle": "Payment history",
    "settle.historyEmpty": "No payments recorded yet.",
    "settle.confirmDelete": "Delete this payment record? Balances go back to before it.",
    "settle.deleteLabel": "Delete payment: {from} to {to}",

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
    "status.localOnly": "ທີ່ຢູ່ນີ້ໃຊ້ໄດ້ສະເພາະຄອມເຄື່ອງນີ້. ເປີດ tunnel (scripts/tunnel.sh) ແລ້ວເຂົ້າແອັບຜ່ານລິ້ງ https:// ຂອງມັນ ຈຶ່ງແບ່ງປັນລິ້ງຈາກບ່ອນນັ້ນ.",
    "status.copyFailed": "ສຳເນົາບໍ່ໄດ້. ລິ້ງແມ່ນ: {url}",

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

    "expenses.title": "ລາຍຈ່າຍ",
    "expenses.add": "ເພີ່ມລາຍຈ່າຍ",
    "expenses.empty": "ຍັງບໍ່ມີລາຍຈ່າຍ. ເພີ່ມລາຍການທຳອິດ.",
    "expenses.needMembers": "ເພີ່ມສະມາຊິກກ່ອນ ແລ້ວຈຶ່ງເພີ່ມລາຍຈ່າຍ.",
    "expenses.goToMembers": "ເພີ່ມສະມາຊິກ",
    "expenses.count": "{count} ລາຍການ · {total}",
    "expenses.countOne": "1 ລາຍການ · {total}",
    "expenses.others": "{name} +{count}",
    "expenses.splitCount": "{count} ຄົນ",
    "expenses.missing": "ຂາດ {amount}",
    "expenses.over": "ເກີນ {amount}",

    "form.newTitle": "ລາຍຈ່າຍໃໝ່",
    "form.editTitle": "ແກ້ໄຂລາຍຈ່າຍ",
    "form.descriptionPlaceholder": "ເຊັ່ນ: ອາຫານແລງຢູ່ຕະຫຼາດກາງຄືນ",
    "form.amountHint": "ເປັນກີບເຕັມ ເຊັ່ນ 150,000",
    "form.whoPaid": "ໃຜຈ່າຍ?",
    "form.multiPayers": "ຫຼາຍຄົນຊ່ວຍກັນຈ່າຍ",
    "form.singlePayer": "ຄົນດຽວຈ່າຍ",
    "form.choosePayer": "ແຕະຊື່ຄົນທີ່ຈ່າຍ.",
    "form.paidAll": "ຈ່າຍໝົດ",
    "form.paidAllLabel": "{name} ຈ່າຍທັງໝົດ",
    "form.payersHint": "ໃສ່ຈຳນວນທີ່ແຕ່ລະຄົນຈ່າຍແທ້.",
    "form.paidOk": "ຍອດທີ່ຈ່າຍກົງກັບຍອດລວມ.",
    "form.paidMissing": "ຈ່າຍແລ້ວ {paid} ຈາກ {total}: ຂາດ {difference}.",
    "form.paidOver": "ຈ່າຍແລ້ວ {paid} ຈາກ {total}: ເກີນ {difference}.",
    "form.selectAll": "ທັງໝົດ",
    "form.selectNone": "ບໍ່ເລືອກ",
    "form.shareEach": "ຄົນລະ {amount}",
    "form.shareRemainder": "ໃນນັ້ນ {count} ຄົນ ຈ່າຍເພີ່ມ 1 ₭ ເພື່ອໃຫ້ຍອດລວມພໍດີ.",
    "form.confirmUnbalanced": "ຍອດທີ່ຈ່າຍບໍ່ກົງກັບຍອດລວມ ({difference}). ບັນທຶກເລີຍບໍ? ຈະຊຳລະເງິນບໍ່ໄດ້ຈົນກວ່າຈະແກ້ໄຂ.",
    "form.confirmDelete": "ລຶບ “{name}” ບໍ?",
    "form.invalidAmount": "ໃສ່ຈຳນວນເງິນເປັນກີບເຕັມ ເຊັ່ນ 150,000.",
    "form.invalidPayerAmount": "ກວດຈຳນວນເງິນທີ່ໃສ່ໃຫ້ {name}.",
    "form.needPayer": "ໃສ່ວ່າໃຜຈ່າຍ ແລະ ຈ່າຍເທົ່າໃດ.",
    "form.needParticipant": "ເລືອກຄົນທີ່ຮ່ວມຫານລາຍຈ່າຍນີ້.",

    "summary.title": "ສະຫຼຸບ",
    "summary.totalSpent": "ລາຍຈ່າຍທັງໝົດ",
    "summary.memberCount": "ສະມາຊິກ",
    "summary.expenseCount": "ລາຍການ",
    "summary.transferred": "ໂອນຄືນແລ້ວ",
    "summary.balancesTitle": "ໃຜໄດ້ຄືນ ໃຜຕ້ອງຈ່າຍ",
    "summary.colName": "ຊື່",
    "summary.colPaid": "ຈ່າຍໄປ",
    "summary.colShare": "ສ່ວນທີ່ຕ້ອງຈ່າຍ",
    "summary.colTransfers": "ການໂອນ",
    "summary.colBalance": "ຍອດຄົງເຫຼືອ",
    "summary.getsBack": "ໄດ້ຮັບຄືນ",
    "summary.owes": "ຕ້ອງຈ່າຍ",
    "summary.even": "ເທົ່າກັນ",
    "summary.paidShare": "ຈ່າຍ {paid} · ສ່ວນ {share}",
    "summary.empty": "ຍັງບໍ່ມີລາຍຈ່າຍ. ເພີ່ມລາຍຈ່າຍເພື່ອເບິ່ງວ່າໃຜຕິດໃຜ.",
    "summary.settleCta": "ເບິ່ງວ່າໃຜຕ້ອງໂອນໃຫ້ໃຜ",
    "summary.allSettled": "ທຸກຄົນຊຳລະກັນຄົບແລ້ວ.",

    "unbalanced.title": "ມີລາຍຈ່າຍທີ່ຍອດບໍ່ກົງກັນ",
    "unbalanced.body": "ຍອດທີ່ຈ່າຍຕ່າງຈາກຍອດລວມທັງໝົດ {amount}. ກະລຸນາແກ້ໄຂລາຍການເຫຼົ່ານີ້ກ່ອນຊຳລະເງິນ:",

    "settle.title": "ຊຳລະເງິນ",
    "settle.suggestionsTitle": "ການໂອນທີ່ແນະນຳ",
    "settle.suggestionsHint": "ໂອນໜ້ອຍຄັ້ງທີ່ສຸດ ເພື່ອໃຫ້ທຸກຄົນເທົ່າກັນ.",
    "settle.pays": "ໂອນໃຫ້",
    "settle.markPaid": "ໝາຍວ່າໂອນແລ້ວ",
    "settle.confirmPaid": "ບັນທຶກວ່າ {from} ໂອນໃຫ້ {to} {amount} ບໍ?",
    "settle.nothingYet": "ຍັງບໍ່ມີຫຍັງຕ້ອງຊຳລະ. ເພີ່ມລາຍຈ່າຍກ່ອນ.",
    "settle.recordTitle": "ບັນທຶກການໂອນອື່ນ",
    "settle.recordHint": "ສຳລັບການໂອນບາງສ່ວນ ຫຼື ການໂອນນອກເໜືອຈາກທີ່ແນະນຳ.",
    "settle.notePlaceholder": "ເຊັ່ນ: ໂອນຜ່ານ BCEL One",
    "settle.choose": "ເລືອກ…",
    "settle.record": "ບັນທຶກການໂອນ",
    "settle.recorded": "ບັນທຶກການໂອນແລ້ວ",
    "settle.historyTitle": "ປະຫວັດການໂອນ",
    "settle.historyEmpty": "ຍັງບໍ່ມີການໂອນ.",
    "settle.confirmDelete": "ລຶບລາຍການໂອນນີ້ບໍ? ຍອດຄົງເຫຼືອຈະກັບຄືນຄືກ່ອນໂອນ.",
    "settle.deleteLabel": "ລຶບການໂອນ: {from} ໃຫ້ {to}",

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
