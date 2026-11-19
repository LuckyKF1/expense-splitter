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
python3 -m backend.server                          # terminal 1
scripts/tunnel.sh                                  # terminal 2: Pinggy, free
PINGGY_TOKEN=<token> scripts/tunnel.sh             # Pinggy Pro: permanent address
TUNNEL_PROVIDER=localhost.run scripts/tunnel.sh    # fallback relay (USA, slower)
```

Open the app through the printed `https://` address, then use **Share link**
in a group. (Sharing from `127.0.0.1` shows a warning, since that address only
works on this computer.)

| Relay | Permanent link | Latency from Laos (measured) |
|---|---|---|
| Pinggy free | no: random, cut after a time limit | ~40-90 ms (Singapore) |
| Pinggy Pro (paid) | yes | ~40-90 ms (Singapore) |
| localhost.run | no: changes on reconnect | ~260-330 ms (USA) |

Every relay terminates HTTPS and can see traffic, this computer must stay
on, and anyone with a group link can view and edit that group.

Each group can designate one active member as its Admin. The Admin label is
for coordination: once assigned, payment controls are shown only on devices
that selected that member under “Who are you?” (without an Admin, everyone
sees them). It is not authentication or an access-control
boundary; anyone with the group link can still edit the group or call its API.

The Members page can download a JSON backup (including the group link and
change history), expense CSV, or payment CSV. It also links to the group
activity history, which records successful group, member, expense, and payment
changes with before/after snapshots. The actor is the member selected on that
device; because there is no login, this attribution is only a convenience and
can be changed or spoofed by anyone with the group link. Deleting a group
deletes its activity history too.

## Test

```bash
python3 -m unittest discover -s tests -t . -v     # backend
node --test "tests/js/*.test.mjs"                 # frontend logic (Node 18+)
node tests/browser/run.mjs                        # real app in headless Chrome (Node 22+)
```

The browser tests start their own server on a free port with a throwaway
database (your `data/expenses.db` is never touched), open each screen in
headless Chrome at phone and desktop sizes, and click through the real flows.
They need Chrome or Chromium installed (`CHROME=/path/to/chrome` if it is not
on `PATH`), but no npm packages.

```bash
node tests/browser/run.mjs settle members          # only some scenarios
SHOTS=/tmp/shots node tests/browser/run.mjs        # also save screenshots
RTT=300 node tests/browser/run.mjs tests/browser/perf.mjs   # load-time report at 300 ms latency
```

## Project layout

```
backend/   server.py (HTTP + routing), database.py (schema, migrations)
frontend/  index.html, css/, js/ (ES modules, no build step)
tests/     unittest suites; js/ (node --test); browser/ (Chrome scenarios)
data/      SQLite database (git-ignored)
scripts/   tunnel.sh (share over the internet)
```

## Money rules

All amounts are integers in whole Kip. Floats are never used for money.
