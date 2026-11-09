# Expense Splitter

Split group expenses (trips, restaurants, activities) in Lao Kip.
Built with the Python standard library, SQLite, and vanilla HTML/CSS/JS.
No packages to install.

## Requirements

- Python 3.10+ (uses `sqlite3`, `http.server`, `unittest`)
- A modern browser

## Run

```bash
python3 -m backend.server            # http://127.0.0.1:8000/
python3 -m backend.server --port 8080 --db data/other.db
```

The database (`data/expenses.db`) is created automatically on first run.

## Test

```bash
python3 -m unittest discover -s tests -t . -v
```

## Project layout

```
backend/   server.py (HTTP + routing), database.py (schema, migrations)
frontend/  index.html, css/, js/ (ES modules, no build step)
tests/     unittest suites
data/      SQLite database (git-ignored)
scripts/   helper scripts: tunnel, DB inspection (added in Phase 7)
```

## Money rules

All amounts are integers in whole Kip. Floats are never used for money.
