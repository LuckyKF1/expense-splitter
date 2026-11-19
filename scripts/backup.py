"""Copy the database to data/backups/, safely, even while the server runs.

    python3 -m scripts.backup                 # data/expenses.db -> data/backups/
    python3 -m scripts.backup --keep 30       # also delete all but the newest 30
    python3 -m scripts.backup --db data/other.db --out /media/usb/backups

Why not just copy the file: the server uses SQLite's write-ahead log, so
recent changes can still be in expenses.db-wal. SQLite's backup API copies
a consistent snapshot including those. Every copy is checked with
PRAGMA integrity_check before the script reports success.

To restore: stop the server, copy a backup over data/expenses.db (and delete
data/expenses.db-wal and data/expenses.db-shm if present), start it again.
"""

import argparse
import re
import sqlite3
import sys
from contextlib import closing
from datetime import datetime
from pathlib import Path

from backend import database

DEFAULT_OUT = database.PROJECT_ROOT / "data" / "backups"
# Only files with exactly this name shape are ever pruned.
BACKUP_NAME = re.compile(r"^expenses-\d{4}-\d{2}-\d{2}-\d{6}(-\d+)?\.db$")


def make_backup(db_path, out_dir, now=None):
    """Write a checked copy of db_path into out_dir and return its path."""
    db_path, out_dir = Path(db_path), Path(out_dir)
    if not db_path.is_file():
        raise FileNotFoundError(f"No database at {db_path}")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = free_name(out_dir, (now or datetime.now()).strftime("expenses-%Y-%m-%d-%H%M%S"))

    # mode=ro: never create or change the live database.
    with closing(sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True)) as source, \
            closing(sqlite3.connect(target)) as copy:
        source.backup(copy)
        result = copy.execute("PRAGMA integrity_check").fetchone()[0]
    if result != "ok":
        target.unlink()
        raise RuntimeError(f"The copy failed its integrity check: {result}")
    return target


def free_name(out_dir, stem):
    """out_dir/stem.db, or stem-2.db, stem-3.db... never an existing file."""
    target, n = out_dir / f"{stem}.db", 1
    while target.exists():
        n += 1
        target = out_dir / f"{stem}-{n}.db"
    return target


def prune(out_dir, keep):
    """Delete all but the newest `keep` backups made by this script.

    keep=0 keeps everything. Other files in out_dir are never touched.
    """
    if keep <= 0:
        return []
    ours = sorted(p for p in Path(out_dir).iterdir() if p.is_file() and BACKUP_NAME.match(p.name))
    old = ours[:-keep]
    for path in old:
        path.unlink()
    return old


def main(argv=None):
    parser = argparse.ArgumentParser(description="Back up the Expense Splitter database")
    parser.add_argument("--db", type=Path, default=database.DEFAULT_DB_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--keep", type=int, default=0,
                        help="delete all but the newest N backups (default: keep all)")
    args = parser.parse_args(argv)
    try:
        path = make_backup(args.db, args.out)
    except (FileNotFoundError, RuntimeError, sqlite3.Error) as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        return 1
    print(f"Backup written: {path} ({path.stat().st_size:,} bytes)")
    for old in prune(args.out, args.keep):
        print(f"Removed old backup: {old.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
