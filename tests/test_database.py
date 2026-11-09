import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend import database


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "test.db"
        database.init_db(self.db_path)
        self.conn = database.connect(self.db_path)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def make_group_with_expense(self):
        c = self.conn
        group_id = c.execute(
            "INSERT INTO groups (name, share_token) VALUES ('Trip', 'tok') RETURNING id"
        ).fetchone()[0]
        alice = c.execute(
            "INSERT INTO members (group_id, name) VALUES (?, 'alice') RETURNING id",
            (group_id,)).fetchone()[0]
        expense_id = c.execute(
            "INSERT INTO expenses (group_id, description, amount, spent_at) "
            "VALUES (?, 'Dinner', 100000, '2026-11-09') RETURNING id",
            (group_id,)).fetchone()[0]
        c.execute("INSERT INTO expense_payers VALUES (?, ?, 100000)", (expense_id, alice))
        c.execute("INSERT INTO expense_shares VALUES (?, ?, 100000)", (expense_id, alice))
        c.commit()
        return group_id, alice, expense_id


class SchemaTests(DatabaseTestCase):
    def test_migrations_set_schema_version(self):
        self.assertEqual(database.schema_version(self.conn), len(database.MIGRATIONS))

    def test_init_db_is_idempotent(self):
        database.init_db(self.db_path)  # must not fail or re-run migrations
        self.assertEqual(database.schema_version(self.conn), len(database.MIGRATIONS))

    def test_foreign_keys_enabled(self):
        self.assertEqual(self.conn.execute("PRAGMA foreign_keys").fetchone()[0], 1)


class ConstraintTests(DatabaseTestCase):
    def test_rejects_non_positive_expense_amount(self):
        group_id, _, _ = self.make_group_with_expense()
        for bad in (0, -5000):
            with self.assertRaises(sqlite3.IntegrityError):
                self.conn.execute(
                    "INSERT INTO expenses (group_id, description, amount, spent_at) "
                    "VALUES (?, 'x', ?, '2026-11-09')", (group_id, bad))

    def test_strict_table_rejects_float_amount(self):
        group_id, _, _ = self.make_group_with_expense()
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO expenses (group_id, description, amount, spent_at) "
                "VALUES (?, 'x', 1.5, '2026-11-09')", (group_id,))

    def test_rejects_duplicate_member_name_in_group(self):
        group_id, _, _ = self.make_group_with_expense()
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO members (group_id, name) VALUES (?, 'alice')", (group_id,))

    def test_rejects_settlement_to_self(self):
        group_id, alice, _ = self.make_group_with_expense()
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO settlements (group_id, from_member_id, to_member_id, amount, paid_at) "
                "VALUES (?, ?, ?, 1000, '2026-11-09')", (group_id, alice, alice))

    def test_cannot_delete_member_used_in_expense(self):
        _, alice, _ = self.make_group_with_expense()
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("DELETE FROM members WHERE id = ?", (alice,))

    def test_deleting_group_cascades_everything(self):
        group_id, _, _ = self.make_group_with_expense()
        self.conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        for table in ("members", "expenses", "expense_payers", "expense_shares"):
            count = self.conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            self.assertEqual(count, 0, table)


if __name__ == "__main__":
    unittest.main()
