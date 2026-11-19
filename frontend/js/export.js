function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(value)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function expensesCsv(backup) {
  const members = new Map(backup.group.members.map((member) => [member.id, member.name]));
  return csv([
    ["ID", "Date", "Description", "Amount (LAK)", "Paid total (LAK)",
      "Unbalanced by (LAK)", "Payers (JSON)", "Shares (JSON)"],
    ...backup.expenses.map((expense) => [
      expense.id,
      expense.spent_at,
      expense.description,
      expense.amount,
      expense.paid_total,
      expense.unbalanced_by,
      JSON.stringify(expense.payers.map((line) => ({
        member_id: line.member_id, name: members.get(line.member_id), amount: line.amount,
      }))),
      JSON.stringify(expense.shares.map((line) => ({
        member_id: line.member_id, name: members.get(line.member_id), amount: line.amount,
      }))),
    ]),
  ]);
}

export function settlementsCsv(backup) {
  return csv([
    ["ID", "From", "To", "Amount (LAK)", "Date", "Note", "Recorded at"],
    ...backup.settlements.map((payment) => [
      payment.id, payment.from_name, payment.to_name, payment.amount,
      payment.paid_at, payment.note, payment.created_at,
    ]),
  ]);
}

function download(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filenamePrefix(groupName) {
  const name = groupName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return name || "expense-group";
}

function exportDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function downloadGroupBackup(api, token, groupName) {
  const backup = await api.exportGroup(token);
  const name = `${filenamePrefix(groupName)}-${exportDate()}`;
  download(`${name}-backup.json`, `${JSON.stringify(backup, null, 2)}\n`,
    "application/json;charset=utf-8");
  return backup;
}

export async function downloadGroupCsv(api, token, groupName, type) {
  const backup = await api.exportGroup(token);
  const name = `${filenamePrefix(groupName)}-${exportDate()}`;
  const contents = type === "expenses" ? expensesCsv(backup) : settlementsCsv(backup);
  download(`${name}-${type}.csv`, contents, "text/csv;charset=utf-8");
}
