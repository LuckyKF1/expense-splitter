"""Pure money math: balances (Phase 4) and transfer suggestions (Phase 5).

Nothing here touches the database or HTTP. Inputs are plain lists and
dicts, outputs are plain dicts of integers, so every rule can be tested
with realistic numbers directly.

Sign convention: balance > 0 means the group owes this member money
(they should receive); balance < 0 means they owe the group (they
should pay).
"""


def compute_balances(member_ids, expenses, settlements=()):
    """Return {member_id: {paid, share, settled_out, settled_in, balance}}.

    balance = paid - share + settled_out - settled_in

    A settlement from A to B means A handed B cash: A's debt shrinks
    (+amount) and B is owed less (-amount).

    The sum of all balances equals the sum of every expense's
    `unbalanced_by`; it is zero only when payers match amounts everywhere.
    """
    totals = {m: {"paid": 0, "share": 0, "settled_out": 0, "settled_in": 0}
              for m in member_ids}
    for expense in expenses:
        for payer in expense["payers"]:
            totals[payer["member_id"]]["paid"] += payer["amount"]
        for share in expense["shares"]:
            totals[share["member_id"]]["share"] += share["amount"]
    for transfer in settlements:
        totals[transfer["from_member_id"]]["settled_out"] += transfer["amount"]
        totals[transfer["to_member_id"]]["settled_in"] += transfer["amount"]

    for t in totals.values():
        t["balance"] = t["paid"] - t["share"] + t["settled_out"] - t["settled_in"]
    return totals


def suggest_transfers(balances):
    """Turn {member_id: balance} into a short list of payments.

    Finding the true minimum number of transfers is NP-hard, so this uses
    a heuristic that is optimal in common cases and never worse than
    n - 1 transfers:
      1. Pair a debtor and a creditor with exactly equal amounts
         (one transfer clears two people).
      2. Repeatedly let the largest debtor pay the largest creditor.
         Every step zeroes at least one person, hence <= n - 1 steps.
    Ties go to the lower member id so the output is deterministic.

    Raises ValueError unless balances sum to zero: suggesting payments
    for books that do not reconcile would move real money wrongly.
    """
    if sum(balances.values()) != 0:
        raise ValueError("balances must sum to zero before settling")

    debts = {m: -b for m, b in balances.items() if b < 0}
    credits = {m: b for m, b in balances.items() if b > 0}
    transfers = []

    def pay(debtor, creditor, amount):
        transfers.append({"from_member_id": debtor, "to_member_id": creditor,
                          "amount": amount})
        debts[debtor] -= amount
        credits[creditor] -= amount
        if debts[debtor] == 0:
            del debts[debtor]
        if credits[creditor] == 0:
            del credits[creditor]

    for debtor in sorted(debts):
        match = next((c for c in sorted(credits) if credits[c] == debts[debtor]), None)
        if match is not None:
            pay(debtor, match, debts[debtor])

    while debts:
        debtor = max(debts, key=lambda m: (debts[m], -m))
        creditor = max(credits, key=lambda m: (credits[m], -m))
        pay(debtor, creditor, min(debts[debtor], credits[creditor]))
    return transfers
