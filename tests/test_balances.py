import random
import unittest

from backend.expenses import split_equally
from backend.settlement import compute_balances


def expense(amount, payers, shares):
    paid = sum(payers.values())
    return {"amount": amount,
            "payers": [{"member_id": m, "amount": a} for m, a in payers.items()],
            "shares": [{"member_id": m, "amount": a} for m, a in shares.items()],
            "unbalanced_by": paid - amount}


LUCK, FY, NO, LAR, SAENG, BICK, TER = range(1, 8)
ALL = [LUCK, FY, NO, LAR, SAENG, BICK, TER]

BRIEF_EXPENSE = expense(
    1180000,
    {LUCK: 680000, FY: 220000, NO: 195000, LAR: 30000, SAENG: 45000},
    {LUCK: 168572, FY: 168572, NO: 168572,
     LAR: 168571, SAENG: 168571, BICK: 168571, TER: 168571})


class ComputeBalancesTests(unittest.TestCase):
    def test_brief_example(self):
        balances = compute_balances(ALL, [BRIEF_EXPENSE])
        self.assertEqual({m: b["balance"] for m, b in balances.items()}, {
            LUCK: 511428, FY: 51428, NO: 26428,
            LAR: -138571, SAENG: -123571, BICK: -168571, TER: -168571})
        self.assertEqual(balances[LUCK]["paid"], 680000)
        self.assertEqual(balances[BICK]["paid"], 0)
        self.assertEqual(balances[TER]["share"], 168571)

    def test_discrepancy_shows_up_in_balance_total(self):
        balances = compute_balances(ALL, [BRIEF_EXPENSE])
        self.assertEqual(sum(b["balance"] for b in balances.values()), -10000)

    def test_balanced_expenses_sum_to_zero(self):
        expenses = [
            expense(300000, {LUCK: 300000}, {LUCK: 100000, FY: 100000, NO: 100000}),
            expense(90000, {FY: 50000, NO: 40000}, {FY: 45000, NO: 45000}),
        ]
        balances = compute_balances([LUCK, FY, NO], expenses)
        self.assertEqual(sum(b["balance"] for b in balances.values()), 0)
        self.assertEqual(balances[LUCK]["balance"], 200000)
        self.assertEqual(balances[FY]["balance"], -95000)
        self.assertEqual(balances[NO]["balance"], -105000)

    def test_member_without_expenses_has_zero_everything(self):
        balances = compute_balances([LUCK, FY], [])
        self.assertEqual(balances[FY], {"paid": 0, "share": 0, "settled_out": 0,
                                        "settled_in": 0, "balance": 0})

    def test_settlement_moves_balance_towards_zero(self):
        expenses = [expense(200000, {LUCK: 200000}, {LUCK: 100000, FY: 100000})]
        settlements = [{"from_member_id": FY, "to_member_id": LUCK, "amount": 60000}]
        balances = compute_balances([LUCK, FY], expenses, settlements)
        self.assertEqual(balances[FY]["balance"], -40000)   # owed 100k, paid back 60k
        self.assertEqual(balances[LUCK]["balance"], 40000)
        self.assertEqual(balances[FY]["settled_out"], 60000)
        self.assertEqual(balances[LUCK]["settled_in"], 60000)

    def test_full_settlement_clears_everyone(self):
        expenses = [expense(200000, {LUCK: 200000}, {LUCK: 100000, FY: 100000})]
        settlements = [{"from_member_id": FY, "to_member_id": LUCK, "amount": 100000}]
        balances = compute_balances([LUCK, FY], expenses, settlements)
        self.assertTrue(all(b["balance"] == 0 for b in balances.values()))


class BalanceInvariantTests(unittest.TestCase):
    def test_random_groups_reconcile(self):
        rng = random.Random(20261109)  # fixed seed: failures are reproducible
        for _ in range(200):
            members = list(range(1, rng.randint(2, 12) + 1))
            expenses, settlements = [], []
            for _ in range(rng.randint(0, 15)):
                amount = rng.randint(1, 5_000_000)
                participants = rng.sample(members, rng.randint(1, len(members)))
                payer_ids = rng.sample(members, rng.randint(1, len(members)))
                payers = {m: rng.randint(1, amount) for m in payer_ids}
                expenses.append(expense(amount, payers,
                                        split_equally(amount, participants)))
            for _ in range(rng.randint(0, 5)):
                a, b = rng.sample(members, 2)
                settlements.append({"from_member_id": a, "to_member_id": b,
                                    "amount": rng.randint(1, 1_000_000)})

            balances = compute_balances(members, expenses, settlements)

            self.assertEqual(sum(b["balance"] for b in balances.values()),
                             sum(e["unbalanced_by"] for e in expenses))
            self.assertEqual(sum(b["share"] for b in balances.values()),
                             sum(e["amount"] for e in expenses))


if __name__ == "__main__":
    unittest.main()
