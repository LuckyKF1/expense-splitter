"""Run SQL against the database (this computer has no sqlite3 program).

    python3 -m scripts.dbshell                          # interactive, read-only
    python3 -m scripts.dbshell "SELECT * FROM groups"   # one query, then exit
    python3 -m scripts.dbshell --write                  # allow changes
    python3 -m scripts.dbshell --db data/other.db

Read-only unless --write is given, so looking around can never damage data.
With --write, foreign keys are enforced like in the app, but nothing else
is: the app's own checks (shares add up, names are clean...) are bypassed.
Make a backup first (python3 -m scripts.backup).

Commands: .tables, .schema [table], .help, .quit. SQL may span several
lines; it runs when a line ends with ";".
"""

import argparse
import sqlite3
import sys
import unicodedata
from pathlib import Path

from backend import database

HELP = """.tables          list tables
.schema [table]  show CREATE statements
.quit            leave (or Ctrl-D)
SQL ending in ; runs it."""


def open_db(path, write=False):
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"No database at {path}")
    if write:
        return database.connect(path)
    # mode=ro: SQLite itself refuses changes, and a typo'd path is not created.
    conn = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def run(conn, text):
    """Run one SQL statement or dot command and return what to print."""
    text = text.strip()
    if text.startswith("."):
        return dot_command(conn, text)
    try:
        cursor = conn.execute(text)
        if cursor.description is None:
            conn.commit()
            n = cursor.rowcount
            return f"({n} row{'' if n == 1 else 's'} changed)" if n >= 0 else "(done)"
        columns = [d[0] for d in cursor.description]
        return format_table(columns, cursor.fetchall())
    except sqlite3.Error as error:
        conn.rollback()
        hint = " (start with --write to change data)" if "readonly" in str(error) else ""
        return f"Error: {error}{hint}".replace("readonly", "read-only")


def dot_command(conn, text):
    name, _, arg = text.partition(" ")
    if name == ".tables":
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
            " AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
        return "  ".join(r[0] for r in rows)
    if name == ".schema":
        sql = "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL"
        rows = conn.execute(sql + (" AND tbl_name = ?" if arg else ""),
                            (arg.strip(),) if arg else ()).fetchall()
        return "\n".join(f"{r[0]};" for r in rows) or f"No table named {arg.strip()}"
    if name == ".help":
        return HELP
    return f"Unknown command {name}. Try .help"


def format_table(columns, rows):
    cells = [[show(v) for v in row] for row in rows]
    widths = [max([width(c)] + [width(r[i]) for r in cells]) for i, c in enumerate(columns)]

    def line(values):
        # The last column is not padded, so lines have no trailing spaces.
        padded = [v + " " * (w - width(v)) for v, w in zip(values[:-1], widths)]
        return " | ".join(padded + [values[-1]])

    n = len(rows)
    return "\n".join([line(columns), "-+-".join("-" * w for w in widths)]
                     + [line(r) for r in cells] + [f"({n} row{'' if n == 1 else 's'})"])


def show(value):
    if value is None:
        return "NULL"
    return " ".join(str(value).splitlines())  # one table row per database row


def width(text):
    """Columns the text takes in a terminal: marks take none, CJK takes two."""
    total = 0
    for ch in text:
        if unicodedata.category(ch) in ("Mn", "Me", "Cf"):
            continue
        total += 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
    return total


def repl(conn, stdin=sys.stdin, stdout=sys.stdout):
    interactive = stdin.isatty()
    buffer = ""
    while True:
        if interactive:
            stdout.write("...> " if buffer else "sql> ")
            stdout.flush()
        line = stdin.readline()
        if not line:  # Ctrl-D / end of input
            break
        if not buffer and line.strip().startswith("."):
            if line.strip() in (".quit", ".exit"):
                break
            print(run(conn, line), file=stdout)
            continue
        buffer += line
        if sqlite3.complete_statement(buffer):
            print(run(conn, buffer), file=stdout)
            buffer = ""


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run SQL against the Expense Splitter database")
    parser.add_argument("sql", nargs="?", help="run this one statement and exit")
    parser.add_argument("--db", type=Path, default=database.DEFAULT_DB_PATH)
    parser.add_argument("--write", action="store_true", help="allow changes (default: read-only)")
    args = parser.parse_args(argv)
    try:
        conn = open_db(args.db, write=args.write)
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 1
    with conn:
        if args.sql:
            out = run(conn, args.sql)
            print(out)
            return 1 if out.startswith("Error:") else 0
        mode = "read-write" if args.write else "read-only"
        print(f"{args.db} ({mode}). Type .help for commands, .quit to leave.")
        repl(conn)
    return 0


if __name__ == "__main__":
    sys.exit(main())
