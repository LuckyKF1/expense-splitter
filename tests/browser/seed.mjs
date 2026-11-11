// Seeding helpers shared by the browser scenarios.

/** The seven people from the project brief's example trip. */
export const BRIEF_PEOPLE = ["luck", "fy", "no", "Lar", "saeng", "bick", "ter"];

/** What each person paid in the brief: 1,170,000 against a 1,180,000 bill. */
export const BRIEF_PAID = { luck: 680000, fy: 220000, no: 195000, Lar: 30000, saeng: 45000 };

/** Add members by name; names in `archived` are deactivated. Returns { name: id }. */
export async function addMembers(api, names, { archived = [] } = {}) {
  const ids = {};
  for (const name of names) {
    ids[name] = (await api("/members", "POST", { name })).id;
  }
  for (const name of archived) {
    await api(`/members/${ids[name]}`, "PATCH", { archived: true });
  }
  return ids;
}

/** Payer lines from { name: amount } using the ids from addMembers. */
export const payersFrom = (ids, paid) =>
  Object.entries(paid).map(([name, amount]) => ({ member_id: ids[name], amount }));
