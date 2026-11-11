"""Group summary: totals, per-member balances and discrepancies.

Loads data, then delegates the math to settlement.compute_balances.
"""

from backend.expenses import load_expenses
from backend.groups import find_group
from backend.settlement import compute_balances


def get_summary(conn, token):
    group = find_group(conn, token)
    members = conn.execute(
        "SELECT id, name, archived FROM members WHERE group_id = ? ORDER BY id",
        (group["id"],)).fetchall()
    expenses = load_expenses(conn, group["id"])
    settlements = [dict(row) for row in conn.execute(
        "SELECT from_member_id, to_member_id, amount FROM settlements "
        "WHERE group_id = ?", (group["id"],))]

    balances = compute_balances([m["id"] for m in members], expenses, settlements)
    unbalanced = [
        {key: e[key] for key in ("id", "description", "amount", "paid_total",
                                 "unbalanced_by")}
        for e in expenses if e["unbalanced_by"] != 0
    ]
    balance_total = sum(b["balance"] for b in balances.values())

    return {
        "currency": "LAK",
        "total_expenses": sum(e["amount"] for e in expenses),
        "total_paid": sum(e["paid_total"] for e in expenses),
        "expense_count": len(expenses),
        "member_count": sum(1 for m in members if not m["archived"]),
        "members": [
            {"member_id": m["id"], "name": m["name"], "archived": bool(m["archived"]),
             **balances[m["id"]]}
            for m in members
        ],
        "balance_total": balance_total,
        "is_balanced": not unbalanced,
        "unbalanced_expenses": unbalanced,
    }
