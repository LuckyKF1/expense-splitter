"""Group and member operations.

Functions take an open sqlite3 connection plus already-parsed input and
return plain dicts ready for JSON. They know nothing about HTTP except
raising ApiError, which keeps them easy to test and reuse.

Groups are addressed by share_token, never by their integer id: with no
login, the unguessable token in the link is the only access control.
"""

import secrets
import sqlite3
from contextlib import contextmanager
from http import HTTPStatus

from backend import audit
from backend.errors import ApiError
from backend.validation import (clean_text, optional_bool, require_int,
                                validation_error)

GROUP_NAME_MAX = 100
MEMBER_NAME_MAX = 50
MAX_MEMBERS_PER_GROUP = 100  # keeps a public instance from being abused


# ---- Groups -------------------------------------------------------------


def create_group(conn, data):
    name = clean_text(data, "name", GROUP_NAME_MAX)
    token = secrets.token_urlsafe(16)  # 128 bits, 22 URL-safe characters
    with conn:
        group_id = conn.execute(
            "INSERT INTO groups (name, share_token) VALUES (?, ?) RETURNING id",
            (name, token)).fetchone()[0]
        audit.record(conn, group_id, None, "created", "group", group_id,
                     after={"name": name})
    return get_group(conn, token)


def get_group(conn, token):
    group = find_group(conn, token)
    members = conn.execute(
        "SELECT id, name, archived, created_at FROM members "
        "WHERE group_id = ? ORDER BY id", (group["id"],)).fetchall()
    return {
        "token": group["share_token"],
        "name": group["name"],
        "admin_member_id": group["admin_member_id"],
        "created_at": group["created_at"],
        "members": [member_to_dict(m) for m in members],
    }


def rename_group(conn, token, data, actor_member_id=None):
    name = clean_text(data, "name", GROUP_NAME_MAX)
    group = find_group(conn, token)
    before = {"name": group["name"]}
    after = {"name": name}
    with conn:
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group["id"]))
        if before != after:
            audit.record(conn, group["id"], actor_member_id, "updated", "group",
                         group["id"], before, after)
    return get_group(conn, token)


def delete_group(conn, token):
    group = find_group(conn, token)
    with conn:  # members, expenses and settlements cascade
        conn.execute("DELETE FROM groups WHERE id = ?", (group["id"],))


def find_group(conn, token):
    row = conn.execute(
        "SELECT id, name, share_token, created_at, admin_member_id "
        "FROM groups WHERE share_token = ?",
        (token,)).fetchone()
    if row is None:
        raise ApiError(HTTPStatus.NOT_FOUND, "GROUP_NOT_FOUND", "Group not found")
    return row


def set_group_admin(conn, token, data, actor_member_id=None):
    """Set or clear the group's one designated admin.

    The designation controls which payment-management UI is shown, but does
    not authenticate the person using a shared group link.
    """
    if "member_id" not in data:
        raise validation_error("member_id", "required")
    member_id = data["member_id"]
    if member_id is not None:
        member_id = require_int(data, "member_id", 1, 2**63 - 1)

    group = find_group(conn, token)
    if member_id is not None:
        member = get_member(conn, group["id"], member_id)
        if member["archived"]:
            raise validation_error("member_id", "archived_member")
    before = admin_snapshot(conn, group["id"], group["admin_member_id"])
    with conn:
        conn.execute("UPDATE groups SET admin_member_id = ? WHERE id = ?",
                     (member_id, group["id"]))
        after = admin_snapshot(conn, group["id"], member_id)
        if before != after:
            audit.record(conn, group["id"], actor_member_id, "updated", "group",
                         group["id"], before, after)
    return get_group(conn, token)


def admin_snapshot(conn, group_id, member_id):
    row = None if member_id is None else conn.execute(
        "SELECT name FROM members WHERE id = ? AND group_id = ?",
        (member_id, group_id)).fetchone()
    return {
        "admin_member_id": member_id,
        "admin_name": row["name"] if row else None,
    }


# ---- Members ------------------------------------------------------------


def add_member(conn, token, data, actor_member_id=None):
    name = clean_text(data, "name", MEMBER_NAME_MAX)
    group = find_group(conn, token)
    count = conn.execute("SELECT count(*) FROM members WHERE group_id = ?",
                         (group["id"],)).fetchone()[0]
    if count >= MAX_MEMBERS_PER_GROUP:
        raise ApiError(HTTPStatus.CONFLICT, "MEMBER_LIMIT_REACHED",
                       f"A group can have at most {MAX_MEMBERS_PER_GROUP} members")
    with conn, name_conflict_as_409():
        member_id = conn.execute(
            "INSERT INTO members (group_id, name) VALUES (?, ?) RETURNING id",
            (group["id"], name)).fetchone()[0]
        member = get_member(conn, group["id"], member_id)
        audit.record(conn, group["id"], actor_member_id, "created", "member",
                     member_id, after=member)
    return member


def update_member(conn, token, member_id, data, actor_member_id=None):
    """Rename and/or archive. Archiving hides a member from new expenses
    (Phase 3) while keeping their history, unlike deleting."""
    name = clean_text(data, "name", MEMBER_NAME_MAX) if "name" in data else None
    archived = optional_bool(data, "archived")
    if name is None and archived is None:
        raise validation_error(None, "no_changes")

    group = find_group(conn, token)
    before = get_member(conn, group["id"], member_id)  # 404 if not in this group
    admin_before = (admin_snapshot(conn, group["id"], member_id)
                    if archived is True and group["admin_member_id"] == member_id else None)
    with conn, name_conflict_as_409():
        if name is not None:
            conn.execute("UPDATE members SET name = ? WHERE id = ?", (name, member_id))
        if archived is not None:
            conn.execute("UPDATE members SET archived = ? WHERE id = ?",
                         (int(archived), member_id))
            if archived:
                conn.execute("UPDATE groups SET admin_member_id = NULL "
                             "WHERE admin_member_id = ?", (member_id,))
        if admin_before is not None:
            audit.record(conn, group["id"], actor_member_id, "updated", "group",
                         group["id"], admin_before,
                         admin_snapshot(conn, group["id"], None))
        after = get_member(conn, group["id"], member_id)
        if before != after:
            audit.record(conn, group["id"], actor_member_id, "updated", "member",
                         member_id, before, after)
    return after


def delete_member(conn, token, member_id, actor_member_id=None):
    group = find_group(conn, token)
    before = get_member(conn, group["id"], member_id)
    admin_before = (admin_snapshot(conn, group["id"], member_id)
                    if group["admin_member_id"] == member_id else None)
    try:
        with conn:
            conn.execute("DELETE FROM members WHERE id = ?", (member_id,))
            if admin_before is not None:
                audit.record(conn, group["id"], actor_member_id, "updated", "group",
                             group["id"], admin_before,
                             admin_snapshot(conn, group["id"], None))
            audit.record(conn, group["id"], actor_member_id, "deleted", "member",
                         member_id, before=before)
    except sqlite3.IntegrityError as err:
        # Foreign keys from expenses/settlements block the delete.
        raise ApiError(HTTPStatus.CONFLICT, "MEMBER_IN_USE",
                       "Member appears in expenses or settlements; archive instead"
                       ) from err


def get_member(conn, group_id, member_id):
    # Filtering by group_id stops one group's link from touching
    # members of another group by guessing ids.
    row = conn.execute(
        "SELECT id, name, archived, created_at FROM members "
        "WHERE id = ? AND group_id = ?", (member_id, group_id)).fetchone()
    if row is None:
        raise ApiError(HTTPStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found")
    return member_to_dict(row)


def member_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "archived": bool(row["archived"]),
        "created_at": row["created_at"],
    }


@contextmanager
def name_conflict_as_409():
    """Turn a UNIQUE violation on member names into MEMBER_NAME_TAKEN.

    Relying on the database constraint (not a SELECT beforehand) means
    two people adding the same name at the same moment cannot both win.
    """
    try:
        yield
    except sqlite3.IntegrityError as err:
        if "UNIQUE" not in str(err):
            raise
        raise ApiError(HTTPStatus.CONFLICT, "MEMBER_NAME_TAKEN",
                       "A member with this name already exists",
                       {"field": "name"}) from err
