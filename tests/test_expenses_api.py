import unittest

from tests.test_groups_api import GroupApiTestCase

BRIEF_PAYMENTS = {"luck": 680000, "fy": 220000, "no": 195000, "Lar": 30000,
                  "saeng": 45000, "bick": 0, "ter": 0}


class ExpenseApiTestCase(GroupApiTestCase):
    def setUp(self):
        self.token = self.create_group()["token"]
        self.ids = {name: self.add_member(self.token, name)["id"]
                    for name in ("luck", "fy", "no")}

    def expense_body(self, **overrides):
        body = {
            "description": "Dinner",
            "amount": 300000,
            "spent_at": "2026-11-09",
            "payers": [{"member_id": self.ids["luck"], "amount": 300000}],
            "participants": list(self.ids.values()),
        }
        body.update(overrides)
        return body

    def post_expense(self, **overrides):
        return self.call("POST", f"/groups/{self.token}/expenses",
                         self.expense_body(**overrides))

    def create_expense(self, **overrides):
        status, expense = self.post_expense(**overrides)
        self.assertEqual(status, 201, expense)
        return expense

    def assert_invalid(self, field, reason, **overrides):
        status, body = self.post_expense(**overrides)
        self.assertEqual(status, 400, body)
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(body["error"]["details"]["field"], field, body)
        self.assertEqual(body["error"]["details"]["reason"], reason, body)


class CreateExpenseTests(ExpenseApiTestCase):
    def test_create_balanced_expense(self):
        expense = self.create_expense()
        self.assertIsInstance(expense["id"], int)
        self.assertEqual(expense["description"], "Dinner")
        self.assertEqual(expense["amount"], 300000)
        self.assertEqual(expense["spent_at"], "2026-11-09")
        self.assertEqual(expense["payers"],
                         [{"member_id": self.ids["luck"], "amount": 300000}])
        self.assertEqual(expense["shares"],
                         [{"member_id": i, "amount": 100000} for i in self.ids.values()])
        self.assertEqual(expense["paid_total"], 300000)
        self.assertEqual(expense["unbalanced_by"], 0)

    def test_brief_example_reports_discrepancy(self):
        for name in ("Lar", "saeng", "bick", "ter"):
            self.ids[name] = self.add_member(self.token, name)["id"]
        payers = [{"member_id": self.ids[n], "amount": a}
                  for n, a in BRIEF_PAYMENTS.items() if a > 0]
        expense = self.create_expense(amount=1180000, payers=payers,
                                      participants=list(self.ids.values()))
        self.assertEqual(expense["paid_total"], 1170000)
        self.assertEqual(expense["unbalanced_by"], -10000)  # stored, never auto-fixed
        self.assertEqual(sum(s["amount"] for s in expense["shares"]), 1180000)

    def test_multiple_payers_overpaying_is_reported(self):
        payers = [{"member_id": self.ids["luck"], "amount": 200000},
                  {"member_id": self.ids["fy"], "amount": 150000}]
        self.assertEqual(self.create_expense(payers=payers)["unbalanced_by"], 50000)

    def test_description_is_validated(self):
        self.assert_invalid("description", "required", description="  ")
        self.assert_invalid("description", "too_long", description="x" * 201)

    def test_amount_must_be_positive_integer(self):
        self.assert_invalid("amount", "required", amount=None)
        self.assert_invalid("amount", "not_integer", amount=1000.5)
        self.assert_invalid("amount", "not_integer", amount="1000")
        self.assert_invalid("amount", "not_integer", amount=True)
        self.assert_invalid("amount", "out_of_range", amount=0)
        self.assert_invalid("amount", "out_of_range", amount=-5000)
        self.assert_invalid("amount", "out_of_range", amount=10**12 + 1)

    def test_spent_at_must_be_a_real_date(self):
        self.assert_invalid("spent_at", "required", spent_at=None)
        for bad in ("2026-02-30", "09/11/2026", "2026-11-9", "2026-11-09T10:00", 20261109):
            self.assert_invalid("spent_at", "invalid_date", spent_at=bad)

    def test_payers_are_validated(self):
        luck = self.ids["luck"]
        self.assert_invalid("payers", "required", payers=[])
        self.assert_invalid("payers", "not_list", payers={"member_id": luck})
        self.assert_invalid("payers", "invalid_item", payers=[luck])
        self.assert_invalid("payers", "invalid_item",
                            payers=[{"member_id": luck, "amount": 0}])
        self.assert_invalid("payers", "invalid_item",
                            payers=[{"member_id": luck, "amount": 10.5}])
        self.assert_invalid("payers", "duplicate_member",
                            payers=[{"member_id": luck, "amount": 1},
                                    {"member_id": luck, "amount": 2}])

    def test_participants_are_validated(self):
        self.assert_invalid("participants", "required", participants=[])
        self.assert_invalid("participants", "invalid_item", participants=["luck"])
        self.assert_invalid("participants", "duplicate_member",
                            participants=[self.ids["fy"], self.ids["fy"]])

    def test_members_must_belong_to_this_group(self):
        other_token = self.create_group()["token"]
        stranger = self.add_member(other_token, "stranger")["id"]
        self.assert_invalid("participants", "unknown_member", participants=[stranger])
        self.assert_invalid("payers", "unknown_member",
                            payers=[{"member_id": stranger, "amount": 300000}])

    def test_archived_member_cannot_join_new_expense(self):
        self.call("PATCH", f"/groups/{self.token}/members/{self.ids['no']}",
                  {"archived": True})
        self.assert_invalid("participants", "archived_member")

    def test_unknown_group_is_404(self):
        status, body = self.call("POST", "/groups/nope/expenses", self.expense_body())
        self.assertEqual((status, body["error"]["code"]), (404, "GROUP_NOT_FOUND"))


class ReadUpdateDeleteTests(ExpenseApiTestCase):
    def test_list_newest_first(self):
        older = self.create_expense(description="Breakfast", spent_at="2026-11-08")
        newer = self.create_expense(description="Lunch", spent_at="2026-11-09")
        status, expenses = self.call("GET", f"/groups/{self.token}/expenses")
        self.assertEqual(status, 200)
        self.assertEqual([e["id"] for e in expenses], [newer["id"], older["id"]])
        self.assertEqual(expenses[0]["shares"][0]["amount"], 100000)

    def test_get_expense(self):
        expense = self.create_expense()
        status, fetched = self.call("GET", f"/groups/{self.token}/expenses/{expense['id']}")
        self.assertEqual((status, fetched), (200, expense))

    def test_update_replaces_payers_and_participants(self):
        expense = self.create_expense()
        body = self.expense_body(
            description="Dinner (fixed)", amount=200000,
            payers=[{"member_id": self.ids["fy"], "amount": 200000}],
            participants=[self.ids["fy"], self.ids["no"]])
        status, updated = self.call(
            "PUT", f"/groups/{self.token}/expenses/{expense['id']}", body)
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated["description"], "Dinner (fixed)")
        self.assertEqual(updated["payers"], [{"member_id": self.ids["fy"], "amount": 200000}])
        self.assertEqual([s["member_id"] for s in updated["shares"]],
                         [self.ids["fy"], self.ids["no"]])

    def test_update_keeps_already_included_archived_member(self):
        expense = self.create_expense()
        self.call("PATCH", f"/groups/{self.token}/members/{self.ids['no']}",
                  {"archived": True})
        status, updated = self.call(
            "PUT", f"/groups/{self.token}/expenses/{expense['id']}",
            self.expense_body(description="Edited later"))
        self.assertEqual(status, 200, updated)

    def test_invalid_update_changes_nothing(self):
        expense = self.create_expense()
        status, _ = self.call("PUT", f"/groups/{self.token}/expenses/{expense['id']}",
                              self.expense_body(amount=-1))
        self.assertEqual(status, 400)
        fetched = self.call("GET", f"/groups/{self.token}/expenses/{expense['id']}")[1]
        self.assertEqual(fetched, expense)

    def test_delete_expense_frees_member_for_deletion(self):
        expense = self.create_expense()
        path = f"/groups/{self.token}/expenses/{expense['id']}"
        self.assertEqual(self.call("DELETE", path), (204, None))
        self.assertEqual(self.call("GET", path)[0], 404)
        status, _ = self.call("DELETE", f"/groups/{self.token}/members/{self.ids['luck']}")
        self.assertEqual(status, 204)

    def test_expense_of_another_group_is_404(self):
        expense = self.create_expense()
        other_token = self.create_group()["token"]
        path = f"/groups/{other_token}/expenses/{expense['id']}"
        for method in ("GET", "DELETE"):
            status, body = self.call(method, path)
            self.assertEqual((status, body["error"]["code"]), (404, "EXPENSE_NOT_FOUND"))


if __name__ == "__main__":
    unittest.main()
