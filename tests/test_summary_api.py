import unittest

from tests.test_expenses_api import BRIEF_PAYMENTS
from tests.test_groups_api import GroupApiTestCase


class SummaryApiTests(GroupApiTestCase):
    def setUp(self):
        self.token = self.create_group()["token"]
        self.ids = {name: self.add_member(self.token, name)["id"] for name in BRIEF_PAYMENTS}

    def summary(self):
        status, body = self.call("GET", f"/groups/{self.token}/summary")
        self.assertEqual(status, 200, body)
        return body

    def add_expense(self, amount, payers, participants=None, description="Trip"):
        status, body = self.call("POST", f"/groups/{self.token}/expenses", {
            "description": description, "amount": amount, "spent_at": "2026-11-09",
            "payers": [{"member_id": self.ids[n], "amount": a}
                       for n, a in payers.items() if a > 0],
            "participants": [self.ids[n] for n in (participants or self.ids)],
        })
        self.assertEqual(status, 201, body)
        return body

    def test_empty_group(self):
        summary = self.summary()
        self.assertEqual(summary["currency"], "LAK")
        self.assertEqual(summary["total_expenses"], 0)
        self.assertEqual(summary["expense_count"], 0)
        self.assertEqual(summary["member_count"], 7)
        self.assertEqual(summary["balance_total"], 0)
        self.assertIs(summary["is_balanced"], True)
        self.assertTrue(all(m["balance"] == 0 for m in summary["members"]))

    def test_brief_example(self):
        expense = self.add_expense(1180000, BRIEF_PAYMENTS)
        summary = self.summary()
        self.assertEqual(summary["total_expenses"], 1180000)
        self.assertEqual(summary["total_paid"], 1170000)
        self.assertEqual(summary["expense_count"], 1)

        by_name = {m["name"]: m for m in summary["members"]}
        self.assertEqual(by_name["luck"]["paid"], 680000)
        self.assertEqual(by_name["luck"]["share"], 168572)
        self.assertEqual(by_name["luck"]["balance"], 511428)
        self.assertEqual(by_name["ter"]["paid"], 0)
        self.assertEqual(by_name["ter"]["balance"], -168571)

        self.assertIs(summary["is_balanced"], False)
        self.assertEqual(summary["balance_total"], -10000)
        self.assertEqual(summary["unbalanced_expenses"], [{
            "id": expense["id"], "description": "Trip", "amount": 1180000,
            "paid_total": 1170000, "unbalanced_by": -10000}])

    def test_balanced_after_fixing_the_discrepancy(self):
        # Someone forgot that bick paid 10,000; correcting it reconciles.
        self.add_expense(1180000, {**BRIEF_PAYMENTS, "bick": 10000})
        summary = self.summary()
        self.assertIs(summary["is_balanced"], True)
        self.assertEqual(summary["balance_total"], 0)
        self.assertEqual(summary["unbalanced_expenses"], [])
        self.assertEqual(sum(m["balance"] for m in summary["members"]), 0)

    def test_balance_total_always_equals_sum_of_discrepancies(self):
        self.add_expense(1180000, BRIEF_PAYMENTS)                 # paid -10,000 short
        self.add_expense(90000, {"fy": 100000}, ["fy", "no"])     # paid +10,000 over
        self.add_expense(50000, {"no": 45000}, ["no", "Lar"])     # paid  -5,000 short
        summary = self.summary()
        self.assertEqual(summary["balance_total"], -5000)
        self.assertEqual(sum(e["unbalanced_by"] for e in summary["unbalanced_expenses"]),
                         summary["balance_total"])
        self.assertEqual(len(summary["unbalanced_expenses"]), 3)

    def test_archived_member_is_listed_but_not_counted(self):
        self.call("PATCH", f"/groups/{self.token}/members/{self.ids['ter']}",
                  {"archived": True})
        summary = self.summary()
        self.assertEqual(summary["member_count"], 6)
        ter = next(m for m in summary["members"] if m["name"] == "ter")
        self.assertIs(ter["archived"], True)

    def test_unknown_group_is_404(self):
        status, body = self.call("GET", "/groups/nope/summary")
        self.assertEqual((status, body["error"]["code"]), (404, "GROUP_NOT_FOUND"))


if __name__ == "__main__":
    unittest.main()
