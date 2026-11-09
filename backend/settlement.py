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
