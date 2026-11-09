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

from backend.errors import ApiError
from backend.validation import clean_text, optional_bool, validation_error

GROUP_NAME_MAX = 100
MEMBER_NAME_MAX = 50
MAX_MEMBERS_PER_GROUP = 100  # keeps a public instance from being abused


# ---- Groups -------------------------------------------------------------


def create_group(conn, data):
    name = clean_text(data, "name", GROUP_NAME_MAX)
    token = secrets.token_urlsafe(16)  # 128 bits, 22 URL-safe characters
    with conn:
        conn.execute("INSERT INTO groups (name, share_token) VALUES (?, ?)",
                     (name, token))
    return get_group(conn, token)


def get_group(conn, token):
    group = find_group(conn, token)
    members = conn.execute(
        "SELECT id, name, archived, created_at FROM members "
        "WHERE group_id = ? ORDER BY id", (group["id"],)).fetchall()
    return {
        "token": group["share_token"],
        "name": group["name"],
        "created_at": group["created_at"],
        "members": [member_to_dict(m) for m in members],
    }


def rename_group(conn, token, data):
    name = clean_text(data, "name", GROUP_NAME_MAX)
    group = find_group(conn, token)
    with conn:
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group["id"]))
    return get_group(conn, token)


def delete_group(conn, token):
    group = find_group(conn, token)
    with conn:  # members, expenses and settlements cascade
        conn.execute("DELETE FROM groups WHERE id = ?", (group["id"],))


def find_group(conn, token):
    row = conn.execute(
        "SELECT id, name, share_token, created_at FROM groups WHERE share_token = ?",
        (token,)).fetchone()
    if row is None:
        raise ApiError(HTTPStatus.NOT_FOUND, "GROUP_NOT_FOUND", "Group not found")
    return row


# ---- Members ------------------------------------------------------------


def add_member(conn, token, data):
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
    return get_member(conn, group["id"], member_id)


def update_member(conn, token, member_id, data):
    """Rename and/or archive. Archiving hides a member from new expenses
    (Phase 3) while keeping their history, unlike deleting."""
    name = clean_text(data, "name", MEMBER_NAME_MAX) if "name" in data else None
    archived = optional_bool(data, "archived")
    if name is None and archived is None:
        raise validation_error(None, "no_changes")

    group = find_group(conn, token)
    get_member(conn, group["id"], member_id)  # 404 if not in this group
    with conn, name_conflict_as_409():
        if name is not None:
            conn.execute("UPDATE members SET name = ? WHERE id = ?", (name, member_id))
        if archived is not None:
            conn.execute("UPDATE members SET archived = ? WHERE id = ?",
                         (int(archived), member_id))
    return get_member(conn, group["id"], member_id)


def delete_member(conn, token, member_id):
    group = find_group(conn, token)
    get_member(conn, group["id"], member_id)
    try:
        with conn:
            conn.execute("DELETE FROM members WHERE id = ?", (member_id,))
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
