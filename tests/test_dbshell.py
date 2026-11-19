"""scripts/dbshell.py: look inside the database without the sqlite3 program."""

import io
import tempfile
import unittest
from pathlib import Path

from backend import database
from scripts import dbshell


class DbShellTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db = Path(tmp.name) / "expenses.db"
        database.init_db(self.db)
        with database.connect(self.db) as conn:
            conn.execute("INSERT INTO groups (name, share_token) VALUES ('Trip', 'tok')")
            conn.execute("INSERT INTO members (group_id, name) VALUES (1, 'ລັກກີ້')")

    def shell(self, *sql, write=False):
        conn = dbshell.open_db(self.db, write=write)
        self.addCleanup(conn.close)
        return "\n".join(dbshell.run(conn, s) for s in sql)

    def test_results_are_an_aligned_table_with_a_row_count(self):
        # Lao vowel and tone marks take no width on screen: "ລັກກີ້" is
        # 6 code points but 3 columns, so "name" sets the column width.
        out = self.shell("SELECT id, name, 'x' AS z FROM members")
        self.assertEqual(out.splitlines(), [
            "id | name | z",
            "---+------+--",
            "1  | ລັກກີ້  | x",
            "(1 row)",
        ])

    def test_null_is_shown_as_null(self):
        out = self.shell("SELECT NULL AS x")
        self.assertIn("NULL", out)

    def test_read_only_by_default(self):
        out = self.shell("DELETE FROM members")
        self.assertIn("read-only", out)
        self.assertIn("ລັກກີ້", self.shell("SELECT name FROM members"))

    def test_write_mode_changes_data_with_foreign_keys_enforced(self):
        out = self.shell("UPDATE groups SET name = 'Trip 2'", write=True)
        self.assertIn("1 row changed", out)
        out = self.shell("DELETE FROM groups WHERE id = 999", write=True)
        self.assertIn("0 rows changed", out)
        out = self.shell("INSERT INTO members (group_id, name) VALUES (42, 'x')", write=True)
        self.assertIn("FOREIGN KEY", out)

    def test_errors_are_reported_not_raised(self):
        self.assertIn("Error:", self.shell("SELECT * FROM nope"))

    def test_tables_and_schema_commands(self):
        tables = self.shell(".tables")
        for name in ("groups", "members", "expenses", "audit_events"):
            self.assertIn(name, tables)
        self.assertIn("CREATE TABLE members", self.shell(".schema members"))
        self.assertIn("Unknown command", self.shell(".nope"))

    def test_missing_database_is_not_created(self):
        missing = self.db.with_name("missing.db")
        with self.assertRaises(FileNotFoundError):
            dbshell.open_db(missing)
        self.assertFalse(missing.exists())

    def test_interactive_loop_joins_lines_until_a_statement_is_complete(self):
        conn = dbshell.open_db(self.db)
        self.addCleanup(conn.close)
        out = io.StringIO()
        dbshell.repl(conn, io.StringIO("SELECT name\nFROM groups;\n.quit\nSELECT 'never';\n"), out)
        self.assertIn("Trip", out.getvalue())
        self.assertNotIn("never", out.getvalue())


if __name__ == "__main__":
    unittest.main()
