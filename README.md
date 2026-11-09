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

## Share with friends over the internet

The server only listens on this computer (127.0.0.1). To give friends a
link, run an SSH reverse tunnel in a second terminal:

```bash
python3 -m backend.server     # terminal 1
scripts/tunnel.sh             # terminal 2: prints an https:// address
```

Open the app through that `https://` address, then use **Share link** in a
group. (Sharing from `127.0.0.1` shows a warning, since that address only
works on this computer.) Notes:

- The free relay's domain changes when the tunnel reconnects; re-share the
  new address. The `/g/<token>` part of group links stays the same.
- The relay terminates HTTPS and can see traffic. Anyone with a group link
  can view and edit that group.
- This computer must stay on while friends use the app.

## Test

```bash
python3 -m unittest discover -s tests -t . -v     # backend
node --test "tests/js/*.test.mjs"                 # frontend logic (Node 18+)
```

## Project layout

```
backend/   server.py (HTTP + routing), database.py (schema, migrations)
frontend/  index.html, css/, js/ (ES modules, no build step)
tests/     unittest suites
data/      SQLite database (git-ignored)
scripts/   tunnel.sh (share over the internet)
```

## Money rules

All amounts are integers in whole Kip. Floats are never used for money.
