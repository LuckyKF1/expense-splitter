import unittest

from tests.test_expenses_api import BRIEF_PAYMENTS
from tests.test_summary_api import BriefGroupTestCase


class SettleUpApiTestCase(BriefGroupTestCase):
    def suggestions(self):
        return self.call("GET", f"/groups/{self.token}/settlement")

    def record(self, sender, receiver, amount, **extra):
        body = {"from_member_id": self.ids[sender], "to_member_id": self.ids[receiver],
                "amount": amount, "paid_at": "2026-11-10", **extra}
        return self.call("POST", f"/groups/{self.token}/settlements", body)

    def balances(self):
        return {m["name"]: m["balance"] for m in self.summary()["members"]}


class SuggestionTests(SettleUpApiTestCase):
    def test_unbalanced_expenses_block_suggestions(self):
        expense = self.add_expense(1180000, BRIEF_PAYMENTS)
        status, body = self.suggestions()
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "UNBALANCED_EXPENSES")
        self.assertEqual(body["error"]["details"]["balance_total"], -10000)
        self.assertEqual([e["id"] for e in body["error"]["details"]["unbalanced_expenses"]],
                         [expense["id"]])

    def test_brief_example_after_fix(self):
        self.add_expense(1180000, {**BRIEF_PAYMENTS, "bick": 10000})
        status, body = self.suggestions()
        self.assertEqual(status, 200, body)
        self.assertEqual(
            [(t["from_name"], t["to_name"], t["amount"]) for t in body["transfers"]],
            [("ter", "luck", 168571), ("bick", "luck", 158571), ("Lar", "luck", 138571),
             ("saeng", "fy", 51428), ("saeng", "luck", 45715), ("saeng", "no", 26428)])
        self.assertEqual(body["transfers"][0]["from_member_id"], self.ids["ter"])
        self.assertEqual(body["transfers"][0]["to_member_id"], self.ids["luck"])

    def test_no_expenses_means_nothing_to_settle(self):
        self.assertEqual(self.suggestions(), (200, {"transfers": []}))


class RecordSettlementTests(SettleUpApiTestCase):
    def setUp(self):
        super().setUp()
        self.add_expense(1180000, {**BRIEF_PAYMENTS, "bick": 10000})

    def test_recorded_payment_updates_balances_and_suggestions(self):
        status, settlement = self.record("ter", "luck", 168571, note="BCEL One")
        self.assertEqual(status, 201, settlement)
        self.assertEqual(settlement["amount"], 168571)
        self.assertEqual(settlement["note"], "BCEL One")
        self.assertEqual(settlement["paid_at"], "2026-11-10")

        balances = self.balances()
        self.assertEqual(balances["ter"], 0)
        self.assertEqual(balances["luck"], 511428 - 168571)
        names = [(t["from_name"], t["to_name"]) for t in self.suggestions()[1]["transfers"]]
        self.assertNotIn(("ter", "luck"), names)
        self.assertEqual(len(names), 5)

    def test_following_all_suggestions_settles_the_group(self):
        for t in self.suggestions()[1]["transfers"]:
            status, _ = self.record(t["from_name"], t["to_name"], t["amount"])
            self.assertEqual(status, 201)
        self.assertTrue(all(b == 0 for b in self.balances().values()))
        self.assertEqual(self.suggestions(), (200, {"transfers": []}))

    def test_partial_payment(self):
        self.record("bick", "luck", 100000)
        self.assertEqual(self.balances()["bick"], -58571)

    def test_overpayment_is_recorded_and_reversed_in_suggestions(self):
        self.record("ter", "luck", 200000)  # 31,429 too much
        self.assertEqual(self.balances()["ter"], 31429)
        transfers = self.suggestions()[1]["transfers"]
        self.assertIn("ter", [t["to_name"] for t in transfers])

    def test_history_newest_first_and_delete(self):
        first = self.record("ter", "luck", 1000)[1]
        second = self.record("bick", "luck", 2000)[1]
        status, history = self.call("GET", f"/groups/{self.token}/settlements")
        self.assertEqual(status, 200)
        self.assertEqual([s["id"] for s in history], [second["id"], first["id"]])

        path = f"/groups/{self.token}/settlements/{first['id']}"
        self.assertEqual(self.call("DELETE", path), (204, None))
        self.assertEqual(self.balances()["ter"], -168571)
        self.assertEqual(self.call("DELETE", path)[0], 404)

    def test_archived_member_can_still_pay(self):
        self.call("PATCH", f"/groups/{self.token}/members/{self.ids['ter']}",
                  {"archived": True})
        self.assertEqual(self.record("ter", "luck", 168571)[0], 201)

    def test_member_with_settlement_cannot_be_deleted(self):
        # "kham" is in no expense, so only the settlement can block deletion.
        self.ids["kham"] = self.add_member(self.token, "kham")["id"]
        self.assertEqual(self.record("kham", "luck", 1000)[0], 201)
        status, body = self.call("DELETE", f"/groups/{self.token}/members/{self.ids['kham']}")
        self.assertEqual((status, body["error"]["code"]), (409, "MEMBER_IN_USE"))

    def test_validation(self):
        def reason(**overrides):
            body = {"from_member_id": self.ids["ter"], "to_member_id": self.ids["luck"],
                    "amount": 1000, "paid_at": "2026-11-10", **overrides}
            status, resp = self.call("POST", f"/groups/{self.token}/settlements", body)
            self.assertEqual(status, 400, resp)
            details = resp["error"]["details"]
            return details["field"], details["reason"]

        self.assertEqual(reason(to_member_id=self.ids["ter"]), ("to_member_id", "same_member"))
        self.assertEqual(reason(amount=0), ("amount", "out_of_range"))
        self.assertEqual(reason(amount=99.5), ("amount", "not_integer"))
        self.assertEqual(reason(paid_at="tomorrow"), ("paid_at", "invalid_date"))
        self.assertEqual(reason(from_member_id="ter"), ("from_member_id", "not_integer"))
        self.assertEqual(reason(note="x" * 201), ("note", "too_long"))
        self.assertEqual(reason(note=5), ("note", "not_string"))

    def test_members_must_belong_to_this_group(self):
        other = self.create_group()["token"]
        stranger = self.add_member(other, "stranger")["id"]
        status, body = self.call("POST", f"/groups/{self.token}/settlements", {
            "from_member_id": stranger, "to_member_id": self.ids["luck"],
            "amount": 1000, "paid_at": "2026-11-10"})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["details"],
                         {"field": "from_member_id", "reason": "unknown_member"})

    def test_settlement_of_another_group_is_404(self):
        settlement = self.record("ter", "luck", 1000)[1]
        other = self.create_group()["token"]
        status, body = self.call("DELETE", f"/groups/{other}/settlements/{settlement['id']}")
        self.assertEqual((status, body["error"]["code"]), (404, "SETTLEMENT_NOT_FOUND"))


if __name__ == "__main__":
    unittest.main()
