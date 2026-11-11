import random
import unittest

from backend.settlement import suggest_transfers

LUCK, FY, NO, LAR, SAENG, BICK, TER = range(1, 8)

# Brief example after fixing the discrepancy (bick paid the missing 10,000).
BRIEF_BALANCED = {LUCK: 511428, FY: 51428, NO: 26428,
                  LAR: -138571, SAENG: -123571, BICK: -158571, TER: -168571}


def apply(balances, transfers):
    """Balances after everyone makes their suggested payment."""
    after = dict(balances)
    for t in transfers:
        after[t["from_member_id"]] += t["amount"]
        after[t["to_member_id"]] -= t["amount"]
    return after


def as_tuples(transfers):
    return [(t["from_member_id"], t["to_member_id"], t["amount"]) for t in transfers]


class SuggestTransfersTests(unittest.TestCase):
    def test_brief_example(self):
        transfers = suggest_transfers(BRIEF_BALANCED)
        self.assertEqual(as_tuples(transfers), [
            (TER, LUCK, 168571), (BICK, LUCK, 158571), (LAR, LUCK, 138571),
            (SAENG, FY, 51428), (SAENG, LUCK, 45715), (SAENG, NO, 26428)])
        self.assertTrue(all(b == 0 for b in apply(BRIEF_BALANCED, transfers).values()))

    def test_everyone_even_needs_no_transfers(self):
        self.assertEqual(suggest_transfers({LUCK: 0, FY: 0}), [])
        self.assertEqual(suggest_transfers({}), [])

    def test_one_debtor_one_creditor(self):
        self.assertEqual(as_tuples(suggest_transfers({LUCK: 50000, FY: -50000, NO: 0})),
                         [(FY, LUCK, 50000)])

    def test_exact_matches_are_paired_first(self):
        # Largest-first greedy alone needs 4 transfers here:
        # 1->5 70, 3->2 40, 4->2 30, 4->5 10.
        # Pairing the equal 70s first needs only 3.
        balances = {1: -70, 2: 70, 3: -40, 4: -40, 5: 80}
        self.assertEqual(as_tuples(suggest_transfers(balances)),
                         [(1, 2, 70), (3, 5, 40), (4, 5, 40)])

    def test_ties_are_broken_by_member_id(self):
        transfers = suggest_transfers({1: 100, 2: 100, 3: -100, 4: -100})
        self.assertEqual(as_tuples(transfers), [(3, 1, 100), (4, 2, 100)])

    def test_refuses_balances_that_do_not_sum_to_zero(self):
        unbalanced = {**BRIEF_BALANCED, BICK: -168571}  # the original -10,000
        with self.assertRaises(ValueError):
            suggest_transfers(unbalanced)

    def test_random_balances_settle_in_at_most_n_minus_1_transfers(self):
        rng = random.Random(20261109)
        for _ in range(500):
            members = list(range(1, rng.randint(1, 15) + 1))
            balances = {m: rng.randint(-2_000_000, 2_000_000) for m in members}
            balances[members[-1]] -= sum(balances.values())  # make it sum to 0

            transfers = suggest_transfers(balances)

            self.assertTrue(all(b == 0 for b in apply(balances, transfers).values()))
            self.assertLessEqual(len(transfers), max(len(members) - 1, 0))
            for t in transfers:
                self.assertGreater(t["amount"], 0)
                self.assertNotEqual(t["from_member_id"], t["to_member_id"])
                self.assertLess(balances[t["from_member_id"]], 0)   # only debtors pay
                self.assertGreater(balances[t["to_member_id"]], 0)  # only creditors receive


if __name__ == "__main__":
    unittest.main()
