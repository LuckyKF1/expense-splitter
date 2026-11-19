import unittest
from pathlib import Path

from backend.errors import ApiError
from backend.validation import MAX_DATE, MIN_DATE, clean_text, optional_bool, require_date


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

    def test_broken_unicode_is_rejected_not_a_crash(self):
        # A lone surrogate (possible in JSON as "\ud800") cannot be stored
        # as UTF-8; it used to reach SQLite and fail with a 500.
        self.assert_rejected({"name": "a\ud800"}, "invalid_characters")

    def test_invisible_characters_are_removed(self):
        # Names copied from chat apps often carry zero-width spaces, BOMs or
        # direction marks. Left in, "luck" and "luck\u200b" look identical
        # but count as two different members.
        for hidden in ("\u200b", "\ufeff", "\u200e", "\u202e", "\u00ad", "\u2060"):
            self.assertEqual(clean_text({"name": f"lu{hidden}ck{hidden}"}, "name", max_length=10),
                             "luck", repr(hidden))

    def test_only_invisible_characters_is_required(self):
        self.assert_rejected({"name": "\u200b\u200b"}, "required")
        self.assert_rejected({"name": " \ufeff "}, "required")

    def test_emoji_joiner_inside_an_emoji_is_kept(self):
        family = "\U0001F468\u200d\U0001F469\u200d\U0001F467"
        self.assertEqual(clean_text({"name": family}, "name", max_length=10), family)

    def test_stray_joiner_next_to_a_letter_is_removed(self):
        self.assertEqual(clean_text({"name": "luck\u200d"}, "name", max_length=10), "luck")
        self.assertEqual(clean_text({"name": "lu\u200dck"}, "name", max_length=10), "luck")

    def test_lao_mark_order_is_normalized_to_nfc(self):
        # Same visible text, typed as KO + MAI EK + vowel U vs KO + U + MAI EK.
        tone_first = "ກຸ່"
        vowel_first = "ກຸ່"
        self.assertEqual(clean_text({"name": tone_first}, "name", max_length=10),
                         vowel_first)


class RequireDateTests(unittest.TestCase):
    def reason(self, value):
        with self.assertRaises(ApiError) as ctx:
            require_date({"d": value}, "d")
        return ctx.exception.details["reason"]

    def test_accepts_this_century(self):
        for value in ("2000-01-01", "2026-11-16", "2028-02-29", "2099-12-31"):
            self.assertEqual(require_date({"d": value}, "d"), value)

    def test_browser_date_pickers_use_the_same_range(self):
        js = (Path(__file__).parent.parent / "frontend/js/format.js").read_text()
        self.assertIn(f'min: "{MIN_DATE.isoformat()}", max: "{MAX_DATE.isoformat()}"', js)

    def test_year_typos_are_out_of_range(self):
        # A mistyped year ("0026", "2206") would sort the expense to the
        # very bottom or top of the list, where nobody finds it.
        for value in ("0001-01-01", "0026-11-16", "1999-12-31", "2100-01-01", "2206-11-16"):
            self.assertEqual(self.reason(value), "out_of_range", value)


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
