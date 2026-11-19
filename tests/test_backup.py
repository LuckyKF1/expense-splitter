"""scripts/backup.py: consistent copies of the live database."""

import sqlite3
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from backend import database
from scripts import backup


class BackupTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.db = self.dir / "expenses.db"
        self.out = self.dir / "backups"
        database.init_db(self.db)
        with database.connect(self.db) as conn:
            conn.execute("INSERT INTO groups (name, share_token) VALUES ('Trip', 'tok')")

    def test_copy_has_the_data_and_the_schema_version(self):
        path = backup.make_backup(self.db, self.out, now=datetime(2026, 11, 19, 9, 5, 7))
        self.assertEqual(path.name, "expenses-2026-11-19-090507.db")
        conn = sqlite3.connect(path)
        self.addCleanup(conn.close)
        self.assertEqual(conn.execute("SELECT name FROM groups").fetchall(), [("Trip",)])
        self.assertEqual(conn.execute("PRAGMA user_version").fetchone()[0], len(database.MIGRATIONS))

    def test_changes_still_in_the_write_ahead_log_are_included(self):
        # The server keeps its connection open in WAL mode; a plain file copy
        # of expenses.db alone would miss recent writes.
        live = database.connect(self.db)
        self.addCleanup(live.close)
        live.execute("INSERT INTO groups (name, share_token) VALUES ('Dinner', 'tok2')")
        live.commit()
        path = backup.make_backup(self.db, self.out)
        conn = sqlite3.connect(path)
        self.addCleanup(conn.close)
        self.assertEqual(conn.execute("SELECT count(*) FROM groups").fetchone()[0], 2)

    def test_never_overwrites_an_existing_backup(self):
        when = datetime(2026, 11, 19, 9, 0, 0)
        first = backup.make_backup(self.db, self.out, now=when)
        second = backup.make_backup(self.db, self.out, now=when)
        self.assertNotEqual(first, second)
        self.assertTrue(first.exists() and second.exists())

    def test_a_missing_database_is_an_error_not_an_empty_backup(self):
        with self.assertRaises(FileNotFoundError):
            backup.make_backup(self.dir / "nope.db", self.out)
        self.assertFalse((self.dir / "nope.db").exists())

    def test_pruning_keeps_the_newest_and_ignores_other_files(self):
        for day in range(1, 6):
            backup.make_backup(self.db, self.out, now=datetime(2026, 11, day))
        other = self.out / "keep-me.db"
        other.write_bytes(b"not ours")
        removed = backup.prune(self.out, keep=2)
        self.assertEqual(len(removed), 3)
        left = sorted(p.name for p in self.out.iterdir())
        self.assertEqual(left, ["expenses-2026-11-04-000000.db",
                                "expenses-2026-11-05-000000.db", "keep-me.db"])

    def test_keep_zero_means_keep_everything(self):
        for day in range(1, 4):
            backup.make_backup(self.db, self.out, now=datetime(2026, 11, day))
        self.assertEqual(backup.prune(self.out, keep=0), [])
        self.assertEqual(len(list(self.out.iterdir())), 3)


if __name__ == "__main__":
    unittest.main()
