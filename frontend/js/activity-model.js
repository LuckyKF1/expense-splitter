// Turns an activity (audit) event's before/after snapshots into a short
// list of readable changes. Pure, so it is unit-tested in Node; the view
// does the formatting and translation.

// Per entity: the fields worth showing, in display order, and how to show them.
//   text | money | date | bool | lines (who paid how much) | people (who shares)
const FIELDS = {
  group: [["name", "text"], ["admin_name", "text"]],
  member: [["name", "text"], ["archived", "bool"]],
  expense: [["description", "text"], ["amount", "money"], ["spent_at", "date"],
    ["payers", "lines"], ["shares", "people"]],
  settlement: [["from_name", "text"], ["to_name", "text"], ["amount", "money"],
    ["paid_at", "date"], ["note", "text"]],
};

// Shares follow the total, so a new amount changes every share; what a
// reader cares about is whether the people splitting it changed.
const comparable = (kind, value) => (kind === "people"
  ? JSON.stringify((value ?? []).map((line) => line.member_id).sort((a, b) => a - b))
  : JSON.stringify(value ?? null));

const isEmpty = (value) => value === null || value === undefined || value === ""
  || value === false || (Array.isArray(value) && value.length === 0);

/** [{field, kind, before, after}] for the fields an event touched. */
export function activityChanges(event) {
  const fields = FIELDS[event.entity_type] ?? [];
  const before = event.before ?? null;
  const after = event.after ?? null;
  if (!before && !after) return [];
  return fields
    .map(([field, kind]) => ({ field, kind, before: before?.[field], after: after?.[field] }))
    .filter(({ kind, before: b, after: a }) => {
      if (event.action === "created") return !isEmpty(a);
      if (event.action === "deleted") return !isEmpty(b);
      return comparable(kind, b) !== comparable(kind, a);
    });
}
