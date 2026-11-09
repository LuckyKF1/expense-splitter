import unittest

from backend import expenses
from backend.expenses import split_equally

JS_MAX_SAFE_INTEGER = 2**53 - 1


class SplitEquallyTests(unittest.TestCase):
    def test_divides_evenly(self):
        self.assertEqual(split_equally(300000, [1, 2, 3]),
                         {1: 100000, 2: 100000, 3: 100000})

    def test_brief_example_1180000_between_7(self):
        # 1,180,000 / 7 = 168,571 remainder 3 -> the 3 lowest ids get +1 Kip.
        shares = split_equally(1180000, [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(shares, {1: 168572, 2: 168572, 3: 168572,
                                  4: 168571, 5: 168571, 6: 168571, 7: 168571})
        self.assertEqual(sum(shares.values()), 1180000)

    def test_remainder_goes_by_member_id_not_input_order(self):
        self.assertEqual(split_equally(100, [9, 3, 5]), {3: 34, 5: 33, 9: 33})

    def test_single_participant_pays_everything(self):
        self.assertEqual(split_equally(45000, [4]), {4: 45000})

    def test_amount_smaller_than_participants(self):
        self.assertEqual(split_equally(2, [1, 2, 3]), {1: 1, 2: 1, 3: 0})

    def test_sum_always_matches_amount(self):
        for amount in (1, 7, 99, 1000, 1179999, expenses.MAX_AMOUNT):
            for count in range(1, 15):
                shares = split_equally(amount, list(range(1, count + 1)))
                self.assertEqual(sum(shares.values()), amount, (amount, count))
                self.assertLessEqual(max(shares.values()) - min(shares.values()), 1)


class LimitTests(unittest.TestCase):
    def test_largest_possible_group_total_is_exact_in_javascript(self):
        # The browser sums amounts as JS numbers; above 2**53 - 1 they
        # silently lose precision, breaking "never off by one Kip".
        worst_case = expenses.MAX_AMOUNT * expenses.MAX_EXPENSES_PER_GROUP
        self.assertLessEqual(worst_case, JS_MAX_SAFE_INTEGER)


if __name__ == "__main__":
    unittest.main()
