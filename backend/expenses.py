"""Expense operations and the equal-split rule.

Two invariants live here because SQL CHECKs cannot span tables:
- shares always sum exactly to the expense amount (enforced by
  split_equally and asserted before every commit);
- payers may NOT sum to the amount. That mismatch is stored as entered
  and reported as `unbalanced_by` (paid_total - amount), never silently
  corrected. Phase 5 refuses to suggest settlements while any exist.
"""

from http import HTTPStatus

from backend.errors import ApiError
from backend.groups import find_group
from backend.validation import (clean_text, is_strict_int, require_date,
                                require_int, validation_error)

DESCRIPTION_MAX = 200
# 100 billion Kip: far above any real bill, still catches extra-zero typos.
# MAX_AMOUNT * MAX_EXPENSES_PER_GROUP must stay <= 2**53 - 1 so group
# totals are exact in the browser (see tests/test_split.py LimitTests).
MAX_AMOUNT = 10**11
MAX_EXPENSES_PER_GROUP = 10_000

UTC_NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"


# ---- Pure business logic ----------------------------------------------------


def split_equally(amount, participant_ids):
    """Split an integer amount so the shares sum to exactly `amount`.

    Everyone gets amount // n; the leftover Kip (fewer than n) go one each
    to the participants with the lowest member ids. The rule is
    deterministic, so recomputing never moves money between people.
    """
    ordered = sorted(participant_ids)
    base, remainder = divmod(amount, len(ordered))
    return {member_id: base + (1 if index < remainder else 0)
            for index, member_id in enumerate(ordered)}


# ---- Input parsing ------------------------------------------------------------


def parse_expense(data):
    """Validate the request shape; membership is checked separately."""
    return {
        "description": clean_text(data, "description", DESCRIPTION_MAX),
        "amount": require_int(data, "amount", 1, MAX_AMOUNT),
        "spent_at": require_date(data, "spent_at"),
        "payers": parse_payers(data.get("payers")),
        "participants": parse_participants(data.get("participants")),
    }


def parse_payers(value):
    items = require_list(value, "payers")
    payers = {}
    for item in items:
        if not (isinstance(item, dict) and is_strict_int(item.get("member_id"))
                and is_strict_int(item.get("amount"))
                and 1 <= item["amount"] <= MAX_AMOUNT):
            raise validation_error("payers", "invalid_item")
        if item["member_id"] in payers:
            raise validation_error("payers", "duplicate_member")
        payers[item["member_id"]] = item["amount"]
    return payers


def parse_participants(value):
    items = require_list(value, "participants")
    if not all(is_strict_int(item) for item in items):
        raise validation_error("participants", "invalid_item")
    if len(set(items)) != len(items):
        raise validation_error("participants", "duplicate_member")
    return items


def require_list(value, field):
    if value is None or value == []:
        raise validation_error(field, "required")
    if not isinstance(value, list):
        raise validation_error(field, "not_list")
    return value


def check_members(conn, group_id, expense, already_included=frozenset()):
    """Every referenced member must belong to the group and be active.

    An archived member may stay on an expense they were already part of,
    so old expenses remain editable after someone leaves the group.
    """
    archived_by_id = dict(conn.execute(
        "SELECT id, archived FROM members WHERE group_id = ?", (group_id,)))
    for field, member_ids in (("payers", expense["payers"]),
                              ("participants", expense["participants"])):
        for member_id in member_ids:
            if member_id not in archived_by_id:
                raise validation_error(field, "unknown_member")
            if archived_by_id[member_id] and member_id not in already_included:
                raise validation_error(field, "archived_member")


# ---- Operations -----------------------------------------------------------------


def create_expense(conn, token, data):
    expense = parse_expense(data)
    group = find_group(conn, token)
    check_members(conn, group["id"], expense)
    count = conn.execute("SELECT count(*) FROM expenses WHERE group_id = ?",
                         (group["id"],)).fetchone()[0]
    if count >= MAX_EXPENSES_PER_GROUP:
        raise ApiError(HTTPStatus.CONFLICT, "EXPENSE_LIMIT_REACHED",
                       f"A group can have at most {MAX_EXPENSES_PER_GROUP} expenses")
    with conn:
        expense_id = conn.execute(
            "INSERT INTO expenses (group_id, description, amount, spent_at) "
            "VALUES (?, ?, ?, ?) RETURNING id",
            (group["id"], expense["description"], expense["amount"],
             expense["spent_at"])).fetchone()[0]
        write_lines(conn, expense_id, expense)
    return get_expense(conn, token, expense_id)


def update_expense(conn, token, expense_id, data):
    """Full replacement (PUT): payers and participants are rewritten."""
    expense = parse_expense(data)
    group = find_group(conn, token)
    current = load_expenses(conn, group["id"], expense_id)
    if not current:
        raise expense_not_found()
    already_included = ({p["member_id"] for p in current[0]["payers"]}
                        | {s["member_id"] for s in current[0]["shares"]})
    check_members(conn, group["id"], expense, already_included)
    with conn:
        conn.execute(
            f"UPDATE expenses SET description = ?, amount = ?, spent_at = ?, "
            f"updated_at = {UTC_NOW_SQL} WHERE id = ?",
            (expense["description"], expense["amount"], expense["spent_at"],
             expense_id))
        conn.execute("DELETE FROM expense_payers WHERE expense_id = ?", (expense_id,))
        conn.execute("DELETE FROM expense_shares WHERE expense_id = ?", (expense_id,))
        write_lines(conn, expense_id, expense)
    return get_expense(conn, token, expense_id)


def delete_expense(conn, token, expense_id):
    group = find_group(conn, token)
    with conn:  # payers and shares cascade
        deleted = conn.execute("DELETE FROM expenses WHERE id = ? AND group_id = ?",
                               (expense_id, group["id"])).rowcount
    if not deleted:
        raise expense_not_found()


def get_expense(conn, token, expense_id):
    group = find_group(conn, token)
    found = load_expenses(conn, group["id"], expense_id)
    if not found:
        raise expense_not_found()
    return found[0]


def list_expenses(conn, token):
    group = find_group(conn, token)
    return load_expenses(conn, group["id"])


# ---- Storage helpers ------------------------------------------------------------


def write_lines(conn, expense_id, expense):
    shares = split_equally(expense["amount"], expense["participants"])
    # Should be impossible; if it ever happens the transaction rolls back.
    # (An explicit raise, not `assert`, which `python -O` would strip.)
    if sum(shares.values()) != expense["amount"]:
        raise RuntimeError("shares must sum to the expense amount")
    conn.executemany("INSERT INTO expense_payers VALUES (?, ?, ?)",
                     [(expense_id, m, a) for m, a in expense["payers"].items()])
    conn.executemany("INSERT INTO expense_shares VALUES (?, ?, ?)",
                     [(expense_id, m, a) for m, a in shares.items()])


def load_expenses(conn, group_id, expense_id=None):
    """Load one or all expenses of a group in three queries total
    (not one query per expense), newest spending date first."""
    where, params = "e.group_id = ?", [group_id]
    if expense_id is not None:
        where, params = where + " AND e.id = ?", params + [expense_id]
    rows = conn.execute(
        f"SELECT e.id, e.description, e.amount, e.spent_at, e.created_at, "
        f"e.updated_at FROM expenses e WHERE {where} "
        f"ORDER BY e.spent_at DESC, e.id DESC", params).fetchall()
    payers = lines_by_expense(conn, "expense_payers", where, params)
    shares = lines_by_expense(conn, "expense_shares", where, params)
    return [expense_to_dict(row, payers.get(row["id"], []), shares.get(row["id"], []))
            for row in rows]


def lines_by_expense(conn, table, where, params):
    # `table` is one of two constants above, never user input.
    lines = {}
    for row in conn.execute(
            f"SELECT l.expense_id, l.member_id, l.amount FROM {table} l "
            f"JOIN expenses e ON e.id = l.expense_id WHERE {where} "
            f"ORDER BY l.member_id", params):
        lines.setdefault(row["expense_id"], []).append(
            {"member_id": row["member_id"], "amount": row["amount"]})
    return lines


def expense_to_dict(row, payers, shares):
    paid_total = sum(p["amount"] for p in payers)
    return {
        "id": row["id"],
        "description": row["description"],
        "amount": row["amount"],
        "spent_at": row["spent_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "payers": payers,
        "shares": shares,
        "paid_total": paid_total,
        "unbalanced_by": paid_total - row["amount"],
    }


def expense_not_found():
    return ApiError(HTTPStatus.NOT_FOUND, "EXPENSE_NOT_FOUND", "Expense not found")
