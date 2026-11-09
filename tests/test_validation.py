import unittest

from backend.errors import ApiError
from backend.validation import clean_text, optional_bool


class CleanTextTests(unittest.TestCase):
    def assert_rejected(self, data, reason):
        with self.assertRaises(ApiError) as ctx:
            clean_text(data, "name", max_length=10)
        self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(ctx.exception.code, "VALIDATION_ERROR")
        self.assertEqual(ctx.exception.details, {"field": "name", "reason": reason})

    def test_strips_surrounding_whitespace(self):
        self.assertEqual(clean_text({"name": "  luck \n"}, "name", max_length=10), "luck")

    def test_missing_field_is_required(self):
        self.assert_rejected({}, "required")

    def test_blank_string_is_required(self):
        self.assert_rejected({"name": "   "}, "required")

    def test_non_string_is_rejected(self):
        self.assert_rejected({"name": 123}, "not_string")

    def test_too_long_is_rejected(self):
        self.assert_rejected({"name": "x" * 11}, "too_long")

    def test_control_characters_are_rejected(self):
        self.assert_rejected({"name": "a\x00b"}, "invalid_characters")

    def test_lao_mark_order_is_normalized_to_nfc(self):
        # Same visible text, typed as KO + MAI EK + vowel U vs KO + U + MAI EK.
        tone_first = "ກຸ່"
        vowel_first = "ກຸ່"
        self.assertEqual(clean_text({"name": tone_first}, "name", max_length=10),
                         vowel_first)


class OptionalBoolTests(unittest.TestCase):
    def test_missing_returns_none(self):
        self.assertIsNone(optional_bool({}, "archived"))

    def test_returns_bool(self):
        self.assertIs(optional_bool({"archived": True}, "archived"), True)

    def test_rejects_non_bool(self):
        with self.assertRaises(ApiError) as ctx:
            optional_bool({"archived": 1}, "archived")
        self.assertEqual(ctx.exception.details, {"field": "archived", "reason": "not_boolean"})


if __name__ == "__main__":
    unittest.main()
