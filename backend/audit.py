"""Audit events for changes made inside a group."""

import json


def record(conn, group_id, actor_member_id, action, entity_type, entity_id,
           before=None, after=None):
    actor = None
    actor_name = None
    if actor_member_id is not None:
        actor = conn.execute(
            "SELECT name FROM members WHERE id = ? AND group_id = ?",
            (actor_member_id, group_id)).fetchone()
        actor_name = actor["name"] if actor else None
        if actor is None and before:
            if entity_type == "member" and str(actor_member_id) == str(entity_id):
                actor_name = before.get("name")
            elif before.get("admin_member_id") == actor_member_id:
                actor_name = before.get("admin_name")

    conn.execute(
        "INSERT INTO audit_events "
        "(group_id, actor_member_id, actor_name, action, entity_type, entity_id, "
        "before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (group_id, actor_member_id if actor or actor_name else None,
         actor_name, action, entity_type,
         str(entity_id) if entity_id is not None else None,
         json.dumps(before, ensure_ascii=False, sort_keys=True) if before is not None else None,
         json.dumps(after, ensure_ascii=False, sort_keys=True) if after is not None else None))


def list_events(conn, group_id):
    rows = conn.execute(
        "SELECT id, actor_member_id, actor_name, action, entity_type, entity_id, "
        "before_json, after_json, created_at FROM audit_events "
        "WHERE group_id = ? ORDER BY id DESC", (group_id,))
    return [{
        "id": row["id"],
        "actor_member_id": row["actor_member_id"],
        "actor_name": row["actor_name"],
        "action": row["action"],
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "before": json.loads(row["before_json"]) if row["before_json"] else None,
        "after": json.loads(row["after_json"]) if row["after_json"] else None,
        "created_at": row["created_at"],
    } for row in rows]
