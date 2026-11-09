"""SQLite connection handling and schema migrations.

Design notes:
- One connection per request (sqlite3 connections should not be shared
  across threads; ThreadingHTTPServer runs each request in its own thread).
- All money columns are INTEGER (whole Lao Kip). No floats anywhere.
- Cross-table invariants (e.g. shares sum == expense amount) cannot be
  expressed as SQL CHECKs, so they are enforced in Python inside a
  transaction (see expenses.py, Phase 3).
- Member references use the default NO ACTION foreign key mode, which
  SQLite checks at the end of each statement. That lets deleting a whole
  group cascade cleanly, while deleting a single member who still appears
  in an expense fails with a constraint error (mapped to HTTP 409).
"""

import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "expenses.db"

UTC_NOW = "(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"

# Each entry migrates the schema from version N to N+1.
# Never edit an entry that has already shipped; append a new one instead.
MIGRATIONS = [
    f"""
    CREATE TABLE groups (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
        share_token TEXT    NOT NULL UNIQUE,
        created_at  TEXT    NOT NULL DEFAULT {UTC_NOW}
    ) STRICT;

    CREATE TABLE members (
        id         INTEGER PRIMARY KEY,
        group_id   INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
        name       TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
        archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT    NOT NULL DEFAULT {UTC_NOW},
        UNIQUE (group_id, name)
    ) STRICT;

    CREATE TABLE expenses (
        id          INTEGER PRIMARY KEY,
        group_id    INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
        description TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 200),
        amount      INTEGER NOT NULL CHECK (amount > 0),
        spent_at    TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT {UTC_NOW},
        updated_at  TEXT    NOT NULL DEFAULT {UTC_NOW}
    ) STRICT;

    -- Who paid, and how much. The sum may differ from expenses.amount;
    -- that difference is reported as "unbalanced", never auto-corrected.
    CREATE TABLE expense_payers (
        expense_id INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
        member_id  INTEGER NOT NULL REFERENCES members (id),
        amount     INTEGER NOT NULL CHECK (amount > 0),
        PRIMARY KEY (expense_id, member_id)
    ) STRICT;

    -- Who shares the cost, and their computed portion. A row here means
    -- the member is a participant. Sum always equals expenses.amount.
    CREATE TABLE expense_shares (
        expense_id INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
        member_id  INTEGER NOT NULL REFERENCES members (id),
        amount     INTEGER NOT NULL CHECK (amount >= 0),
        PRIMARY KEY (expense_id, member_id)
    ) STRICT;

    -- Money actually transferred between members to settle up.
    CREATE TABLE settlements (
        id             INTEGER PRIMARY KEY,
        group_id       INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
        from_member_id INTEGER NOT NULL REFERENCES members (id),
        to_member_id   INTEGER NOT NULL REFERENCES members (id),
        amount         INTEGER NOT NULL CHECK (amount > 0),
        paid_at        TEXT    NOT NULL,
        note           TEXT    NOT NULL DEFAULT '' CHECK (length(note) <= 200),
        created_at     TEXT    NOT NULL DEFAULT {UTC_NOW},
        CHECK (from_member_id <> to_member_id)
    ) STRICT;

    CREATE INDEX idx_members_group     ON members (group_id);
    CREATE INDEX idx_expenses_group    ON expenses (group_id);
    CREATE INDEX idx_payers_member     ON expense_payers (member_id);
    CREATE INDEX idx_shares_member     ON expense_shares (member_id);
    CREATE INDEX idx_settlements_group ON settlements (group_id);
    """,
    # v2: member names are unique per group regardless of letter case,
    # so "Luck" and "luck" cannot both exist (NOCASE folds ASCII only;
    # Lao has no letter case, so nothing is lost there).
    """
    CREATE UNIQUE INDEX ux_members_group_name_nocase
        ON members (group_id, name COLLATE NOCASE);
    """,
]


def connect(db_path=DEFAULT_DB_PATH):
    """Open a connection with the settings every request needs."""
    conn = sqlite3.connect(db_path, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def schema_version(conn):
    return conn.execute("PRAGMA user_version").fetchone()[0]


def init_db(db_path=DEFAULT_DB_PATH):
    """Create the database file if needed and apply pending migrations."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = connect(db_path)
    try:
        # WAL lets readers proceed while one request is writing.
        conn.execute("PRAGMA journal_mode = WAL")
        current = schema_version(conn)
        for version, script in enumerate(MIGRATIONS[current:], start=current + 1):
            # executescript commits implicitly, so wrap the migration and
            # its version bump in one explicit transaction.
            conn.executescript(
                f"BEGIN;\n{script}\nPRAGMA user_version = {version};\nCOMMIT;"
            )
    finally:
        conn.close()
