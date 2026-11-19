"""Complete downloadable data snapshots for a group."""

from datetime import datetime, timezone

from backend import audit, expenses, groups, settle_up


def export_group(conn, token):
    group = groups.find_group(conn, token)
    return {
        "format": "expense-splitter-backup",
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "group": groups.get_group(conn, token),
        "expenses": expenses.list_expenses(conn, token),
        "settlements": settle_up.list_settlements(conn, token),
        "activity": audit.list_events(conn, group["id"]),
    }
