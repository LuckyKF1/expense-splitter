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
data/      SQLite database and backups/ (git-ignored)
scripts/   tunnel.sh (share over the internet), backup.py, dbshell.py
```

## Back up and inspect the database

```bash
python3 -m scripts.backup              # -> data/backups/expenses-YYYY-MM-DD-HHMMSS.db
python3 -m scripts.backup --keep 30    # also delete all but the newest 30 backups
python3 -m scripts.dbshell             # SQL prompt, read-only (.tables, .schema, .quit)
python3 -m scripts.dbshell "SELECT name FROM groups"
python3 -m scripts.dbshell --write     # allow changes: back up first
```

The backup is safe while the server is running. It uses SQLite's backup API,
so recent changes still in the write-ahead log are included. It opens the live
database read-only and checks every copy with `PRAGMA integrity_check`.
Without `--keep` nothing is ever deleted; with it, only files named like the
script's own backups are. Copy `data/backups/` to another disk or a cloud
folder now and then, because a backup on the same disk is lost with that disk.

To restore: stop the server, copy a backup over `data/expenses.db`, delete
`data/expenses.db-wal` and `data/expenses.db-shm` if they exist, then start
the server again.

`dbshell` exists because this machine has no `sqlite3` program. With
`--write`, foreign keys are still enforced but the app's own checks (shares
add up, names are cleaned) are bypassed, so prefer changing data in the app.

## Money rules

All amounts are integers in whole Kip. Floats are never used for money.

- An equal split gives everyone `amount // n`; the leftover Kip (fewer than
  `n`) go one each to the participants with the lowest member ids, so
  100,001 ₭ between members 1 and 2 is 50,001 + 50,000.
- Payers may add up to more or less than the amount. The expense is saved and
  reported (`unbalanced_by` = paid − amount), never adjusted silently;
  settle-up suggestions are refused until it is fixed.
- A member's `balance` = paid − share + settled_out − settled_in. Positive
  means the group owes them, negative means they owe; recording a payment
  moves both people toward 0.

## API

JSON over HTTP; requests with a body send `Content-Type: application/json`
(at most 64 KB). `{T}` is the group's share token, which is also the only
access control: anyone who has it can read and change that group.

Optional header `X-Actor-Member-ID: <member id>` names who made a change in the
activity history. The app sends the member chosen under “Who are you?”. It is
not verified.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/health` | | 200 `{status, schema_version}` |
| POST | `/api/groups` | `{name}` | 201 group |
| GET | `/api/groups/{T}` | | 200 group |
| PATCH | `/api/groups/{T}` | `{name}` | 200 group |
| PATCH | `/api/groups/{T}/admin` | `{member_id}` (id or `null` to clear) | 200 group |
| DELETE | `/api/groups/{T}` | | 204, deletes everything in the group |
| POST | `/api/groups/{T}/members` | `{name}` | 201 member |
| PATCH | `/api/groups/{T}/members/{id}` | `{name?, archived?}` | 200 member |
| DELETE | `/api/groups/{T}/members/{id}` | | 204; 409 if used anywhere (archive instead) |
| GET | `/api/groups/{T}/expenses` | | 200 list of expenses, newest first |
| POST | `/api/groups/{T}/expenses` | expense input | 201 expense |
| GET | `/api/groups/{T}/expenses/{id}` | | 200 expense |
| PUT | `/api/groups/{T}/expenses/{id}` | expense input | 200 expense |
| DELETE | `/api/groups/{T}/expenses/{id}` | | 204 |
| GET | `/api/groups/{T}/summary` | | 200 totals and per-member balances |
| GET | `/api/groups/{T}/settlement` | | 200 `{transfers}` suggested; 409 if unbalanced |
| GET | `/api/groups/{T}/settlements` | | 200 list of recorded payments |
| POST | `/api/groups/{T}/settlements` | payment input | 201 payment |
| DELETE | `/api/groups/{T}/settlements/{id}` | | 204 |
| GET | `/api/groups/{T}/activity` | | 200 list of changes, newest first |
| GET | `/api/groups/{T}/export` | | 200 full JSON backup of the group |

Shapes (real responses, trimmed):

```jsonc
// group
{"token": "HQnKF7bSwt41I_DPtevaHw", "name": "Trip", "admin_member_id": 1,
 "created_at": "2026-11-19T04:06:20Z",
 "members": [{"id": 1, "name": "Luck", "archived": false, "created_at": "..."}]}

// expense input (POST / PUT)
{"description": "Dinner", "amount": 100001, "spent_at": "2026-11-19",
 "payers": [{"member_id": 1, "amount": 100001}], "participants": [1, 2]}

// expense
{"id": 1, "description": "Dinner", "amount": 100001, "spent_at": "2026-11-19",
 "payers": [{"member_id": 1, "amount": 100001}],
 "shares": [{"member_id": 1, "amount": 50001}, {"member_id": 2, "amount": 50000}],
 "paid_total": 100001, "unbalanced_by": 0, "created_at": "...", "updated_at": "..."}

// summary
{"currency": "LAK", "total_expenses": 100001, "total_paid": 100001,
 "expense_count": 1, "member_count": 2, "balance_total": 0, "is_balanced": true,
 "unbalanced_expenses": [],
 "members": [{"member_id": 1, "name": "Luck", "archived": false, "paid": 100001,
              "share": 50001, "settled_out": 0, "settled_in": 0, "balance": 50000}]}

// settlement suggestions
{"transfers": [{"from_member_id": 2, "from_name": "Noy",
                "to_member_id": 1, "to_name": "Luck", "amount": 50000}]}

// payment input (note is optional, at most 200 characters)
{"from_member_id": 2, "to_member_id": 1, "amount": 50000, "paid_at": "2026-11-19", "note": ""}

// activity entry: before is null for "created", after is null for "deleted"
{"id": 5, "action": "created", "entity_type": "expense", "entity_id": "1",
 "actor_member_id": 1, "actor_name": "Luck", "created_at": "...",
 "before": null, "after": {"description": "Dinner", "amount": 100001, "...": "..."}}

// export
{"format": "expense-splitter-backup", "version": 1, "exported_at": "...",
 "group": {...}, "expenses": [...], "settlements": [...], "activity": [...]}
```

Rules checked on the server: names are cleaned (invisible characters removed,
trimmed) and must be 1–100 characters for a group, 1–50 for a member, unique
within the group; descriptions 1–200 characters; amounts are whole numbers
from 1 to 100,000,000,000; dates are `YYYY-MM-DD` between 2000-01-01 and
2099-12-31. Payers and participants must be active members of the group (an
archived member may stay on an expense they were already part of). Limits per
group: 100 members, 10,000 expenses, 10,000 payments.

Errors always look like this, with a stable `code` the app translates:

```json
{"error": {"code": "VALIDATION_ERROR", "message": "Invalid amount: out_of_range",
           "details": {"field": "amount", "reason": "out_of_range"}}}
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (with `details.field` and `details.reason`), `INVALID_JSON` |
| 404 | `GROUP_NOT_FOUND`, `MEMBER_NOT_FOUND`, `EXPENSE_NOT_FOUND`, `SETTLEMENT_NOT_FOUND`, `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `MEMBER_NAME_TAKEN`, `MEMBER_IN_USE`, `UNBALANCED_EXPENSES`, `MEMBER_LIMIT_REACHED`, `EXPENSE_LIMIT_REACHED`, `SETTLEMENT_LIMIT_REACHED` |
| 413 | `BODY_TOO_LARGE` |
| 500 | `INTERNAL_ERROR` |
