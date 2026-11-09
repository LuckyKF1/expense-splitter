import json
import unittest

from tests.test_server import ServerTestCase


class GroupApiTestCase(ServerTestCase):
    """Helpers for JSON calls. Each test creates its own group, so tests
    sharing one server/database do not interfere with each other."""

    def call(self, method, path, payload=None, raw=None):
        body = raw if raw is not None else (
            json.dumps(payload).encode() if payload is not None else None)
        status, _, resp = self.request(method, "/api" + path, body)
        return status, (json.loads(resp) if resp else None)

    def create_group(self, name="Vang Vieng trip"):
        status, group = self.call("POST", "/groups", {"name": name})
        self.assertEqual(status, 201, group)
        return group

    def add_member(self, token, name):
        status, member = self.call("POST", f"/groups/{token}/members", {"name": name})
        self.assertEqual(status, 201, member)
        return member

    def assert_error(self, result, status, code, details=None):
        actual_status, body = result
        self.assertEqual(actual_status, status, body)
        self.assertEqual(body["error"]["code"], code)
        if details is not None:
            self.assertEqual(body["error"]["details"], details)


class GroupTests(GroupApiTestCase):
    def test_create_group_returns_token_and_empty_members(self):
        group = self.create_group("  Vang Vieng trip  ")
        self.assertEqual(group["name"], "Vang Vieng trip")
        self.assertEqual(group["members"], [])
        self.assertGreaterEqual(len(group["token"]), 22)  # >= 128 bits of randomness
        self.assertNotIn("id", group)  # internal id is never exposed

    def test_tokens_are_unique(self):
        self.assertNotEqual(self.create_group()["token"], self.create_group()["token"])

    def test_get_group(self):
        token = self.create_group("ກິນເຂົ້າ")["token"]
        status, group = self.call("GET", f"/groups/{token}")
        self.assertEqual(status, 200)
        self.assertEqual(group["name"], "ກິນເຂົ້າ")

    def test_unknown_token_is_404(self):
        self.assert_error(self.call("GET", "/groups/doesnotexist"), 404, "GROUP_NOT_FOUND")

    def test_create_group_validates_name(self):
        self.assert_error(self.call("POST", "/groups", {"name": " "}), 400,
                          "VALIDATION_ERROR", {"field": "name", "reason": "required"})
        self.assert_error(self.call("POST", "/groups", {"name": "x" * 101}), 400,
                          "VALIDATION_ERROR", {"field": "name", "reason": "too_long"})

    def test_invalid_json_body_is_rejected(self):
        self.assert_error(self.call("POST", "/groups", raw=b"{not json"), 400, "INVALID_JSON")
        self.assert_error(self.call("POST", "/groups", raw=b"[]"), 400, "INVALID_JSON")

    def test_rename_group(self):
        token = self.create_group()["token"]
        status, group = self.call("PATCH", f"/groups/{token}", {"name": "Luang Prabang"})
        self.assertEqual(status, 200)
        self.assertEqual(group["name"], "Luang Prabang")
        self.assertEqual(self.call("GET", f"/groups/{token}")[1]["name"], "Luang Prabang")

    def test_delete_group(self):
        token = self.create_group()["token"]
        self.add_member(token, "luck")
        self.assertEqual(self.call("DELETE", f"/groups/{token}"), (204, None))
        self.assert_error(self.call("GET", f"/groups/{token}"), 404, "GROUP_NOT_FOUND")


class MemberTests(GroupApiTestCase):
    def setUp(self):
        self.token = self.create_group()["token"]

    def members(self):
        return self.call("GET", f"/groups/{self.token}")[1]["members"]

    def test_add_member(self):
        member = self.add_member(self.token, " luck ")
        self.assertEqual(member["name"], "luck")
        self.assertIs(member["archived"], False)
        self.assertIsInstance(member["id"], int)
        self.assertEqual([m["name"] for m in self.members()], ["luck"])

    def test_members_are_listed_in_creation_order(self):
        for name in ("luck", "fy", "no", "ລາ"):
            self.add_member(self.token, name)
        self.assertEqual([m["name"] for m in self.members()], ["luck", "fy", "no", "ລາ"])

    def test_duplicate_name_is_rejected_case_insensitively(self):
        self.add_member(self.token, "Lar")
        for name in ("Lar", "lar", " LAR "):
            self.assert_error(
                self.call("POST", f"/groups/{self.token}/members", {"name": name}),
                409, "MEMBER_NAME_TAKEN")

    def test_same_name_allowed_in_different_groups(self):
        self.add_member(self.token, "luck")
        other = self.create_group()["token"]
        self.add_member(other, "luck")

    def test_member_name_validation(self):
        self.assert_error(
            self.call("POST", f"/groups/{self.token}/members", {"name": "x" * 51}),
            400, "VALIDATION_ERROR", {"field": "name", "reason": "too_long"})

    def test_add_member_to_unknown_group_is_404(self):
        self.assert_error(self.call("POST", "/groups/nope/members", {"name": "a"}),
                          404, "GROUP_NOT_FOUND")

    def test_rename_member(self):
        member = self.add_member(self.token, "luk")
        status, updated = self.call(
            "PATCH", f"/groups/{self.token}/members/{member['id']}", {"name": "luck"})
        self.assertEqual(status, 200)
        self.assertEqual(updated["name"], "luck")

    def test_rename_member_to_taken_name_is_409(self):
        self.add_member(self.token, "fy")
        member = self.add_member(self.token, "no")
        self.assert_error(
            self.call("PATCH", f"/groups/{self.token}/members/{member['id']}", {"name": "FY"}),
            409, "MEMBER_NAME_TAKEN")

    def test_archive_and_restore_member(self):
        member = self.add_member(self.token, "bick")
        path = f"/groups/{self.token}/members/{member['id']}"
        self.assertIs(self.call("PATCH", path, {"archived": True})[1]["archived"], True)
        self.assertIs(self.members()[0]["archived"], True)
        self.assertIs(self.call("PATCH", path, {"archived": False})[1]["archived"], False)

    def test_patch_member_requires_a_field(self):
        member = self.add_member(self.token, "ter")
        self.assert_error(
            self.call("PATCH", f"/groups/{self.token}/members/{member['id']}", {}),
            400, "VALIDATION_ERROR", {"field": None, "reason": "no_changes"})

    def test_patch_member_rejects_non_bool_archived(self):
        member = self.add_member(self.token, "ter")
        self.assert_error(
            self.call("PATCH", f"/groups/{self.token}/members/{member['id']}",
                      {"archived": "yes"}),
            400, "VALIDATION_ERROR", {"field": "archived", "reason": "not_boolean"})

    def test_delete_member(self):
        member = self.add_member(self.token, "saeng")
        status, _ = self.call("DELETE", f"/groups/{self.token}/members/{member['id']}")
        self.assertEqual(status, 204)
        self.assertEqual(self.members(), [])

    def test_member_of_another_group_is_404(self):
        other = self.create_group()["token"]
        stranger = self.add_member(other, "stranger")
        path = f"/groups/{self.token}/members/{stranger['id']}"
        self.assert_error(self.call("PATCH", path, {"name": "x"}), 404, "MEMBER_NOT_FOUND")
        self.assert_error(self.call("DELETE", path), 404, "MEMBER_NOT_FOUND")

    def test_delete_member_with_expenses_is_409(self):
        member = self.add_member(self.token, "luck")
        self.insert_expense_paid_by(member["id"])
        self.assert_error(
            self.call("DELETE", f"/groups/{self.token}/members/{member['id']}"),
            409, "MEMBER_IN_USE")
        self.assertEqual(len(self.members()), 1)

    def insert_expense_paid_by(self, member_id):
        status, body = self.call("POST", f"/groups/{self.token}/expenses", {
            "description": "Dinner", "amount": 1000, "spent_at": "2026-11-09",
            "payers": [{"member_id": member_id, "amount": 1000}],
            "participants": [member_id]})
        self.assertEqual(status, 201, body)


if __name__ == "__main__":
    unittest.main()
