"""Settling up: transfer suggestions and the history of real payments.

Recorded settlements are facts ("ter sent luck 168,571 Kip"), so they
are accepted even while expenses are unbalanced, from archived members,
or when they overpay; balances simply absorb them. Suggestions, on the
other hand, are refused until every expense reconciles.
"""

from http import HTTPStatus

from backend.errors import ApiError
from backend.expenses import MAX_AMOUNT
from backend.groups import find_group
from backend.settlement import suggest_transfers
from backend.summary import get_summary
from backend.validation import (optional_text, require_date, require_int,
                                validation_error)

NOTE_MAX = 200
MAX_SETTLEMENTS_PER_GROUP = 10_000
MAX_ID = 2**63 - 1  # SQLite INTEGER range


def get_suggestions(conn, token):
    summary = get_summary(conn, token)
    if not summary["is_balanced"]:
        raise ApiError(
            HTTPStatus.CONFLICT, "UNBALANCED_EXPENSES",
            "Fix expenses whose payers do not add up before settling",
            {"balance_total": summary["balance_total"],
             "unbalanced_expenses": summary["unbalanced_expenses"]})

    names = {m["member_id"]: m["name"] for m in summary["members"]}
    transfers = suggest_transfers(
        {m["member_id"]: m["balance"] for m in summary["members"]})
    return {"transfers": [
        {**t, "from_name": names[t["from_member_id"]], "to_name": names[t["to_member_id"]]}
        for t in transfers
    ]}


def record_settlement(conn, token, data):
    sender = require_int(data, "from_member_id", 1, MAX_ID)
    receiver = require_int(data, "to_member_id", 1, MAX_ID)
    amount = require_int(data, "amount", 1, MAX_AMOUNT)
    paid_at = require_date(data, "paid_at")
    note = optional_text(data, "note", NOTE_MAX)
    if sender == receiver:
        raise validation_error("to_member_id", "same_member")

    group = find_group(conn, token)
    group_members = {row[0] for row in conn.execute(
        "SELECT id FROM members WHERE group_id = ?", (group["id"],))}
    for field, member_id in (("from_member_id", sender), ("to_member_id", receiver)):
        if member_id not in group_members:
            raise validation_error(field, "unknown_member")

    count = conn.execute("SELECT count(*) FROM settlements WHERE group_id = ?",
                         (group["id"],)).fetchone()[0]
    if count >= MAX_SETTLEMENTS_PER_GROUP:
        raise ApiError(HTTPStatus.CONFLICT, "SETTLEMENT_LIMIT_REACHED",
                       f"A group can have at most {MAX_SETTLEMENTS_PER_GROUP} settlements")
    with conn:
        settlement_id = conn.execute(
            "INSERT INTO settlements (group_id, from_member_id, to_member_id, amount, "
            "paid_at, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (group["id"], sender, receiver, amount, paid_at, note)).fetchone()[0]
    return load_settlements(conn, group["id"], settlement_id)[0]


def list_settlements(conn, token):
    return load_settlements(conn, find_group(conn, token)["id"])


def delete_settlement(conn, token, settlement_id):
    """For correcting mistakes; the payment then no longer counts."""
    group = find_group(conn, token)
    with conn:
        deleted = conn.execute("DELETE FROM settlements WHERE id = ? AND group_id = ?",
                               (settlement_id, group["id"])).rowcount
    if not deleted:
        raise ApiError(HTTPStatus.NOT_FOUND, "SETTLEMENT_NOT_FOUND", "Settlement not found")


def load_settlements(conn, group_id, settlement_id=None):
    """Newest payment date first, with member names for display."""
    where, params = "s.group_id = ?", [group_id]
    if settlement_id is not None:
        where, params = where + " AND s.id = ?", params + [settlement_id]
    rows = conn.execute(
        "SELECT s.id, s.from_member_id, f.name AS from_name, s.to_member_id, "
        "t.name AS to_name, s.amount, s.paid_at, s.note, s.created_at "
        "FROM settlements s "
        "JOIN members f ON f.id = s.from_member_id "
        "JOIN members t ON t.id = s.to_member_id "
        f"WHERE {where} ORDER BY s.paid_at DESC, s.id DESC", params)
    return [dict(row) for row in rows]
