"""Input validation shared by all endpoints.

Every failure raises ApiError(400, "VALIDATION_ERROR") with
details {"field": ..., "reason": ...}. The frontend maps `reason` to a
translated message, so reasons are a small, stable vocabulary:
required, not_string, too_long, invalid_characters, not_boolean,
no_changes, not_integer, out_of_range, invalid_date, not_list,
invalid_item, duplicate_member, unknown_member, archived_member.
"""

import re
import unicodedata
from datetime import date
from http import HTTPStatus

from backend.errors import ApiError

DATE_PATTERN = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
# Wide enough for any real bill, narrow enough to catch a mistyped year.
MIN_DATE = date(2000, 1, 1)
MAX_DATE = date(2099, 12, 31)
ZERO_WIDTH_JOINER = "\u200d"


def validation_error(field, reason):
    return ApiError(HTTPStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    f"Invalid {field or 'request'}: {reason}",
                    {"field": field, "reason": reason})


def clean_text(data, field, max_length):
    """Return data[field] as trimmed, NFC-normalized, non-empty text.

    NFC matters for Lao: a tone mark and a vowel can be typed in either
    order and look identical. Without normalizing, "the same" name could
    be stored twice and bypass the duplicate-name check.
    """
    value = data.get(field)
    if value is None:
        raise validation_error(field, "required")
    if not isinstance(value, str):
        raise validation_error(field, "not_string")
    if any(unicodedata.category(ch) == "Cs" for ch in value):
        raise validation_error(field, "invalid_characters")
    text = remove_invisible(unicodedata.normalize("NFC", value)).strip()
    if not text:
        raise validation_error(field, "required")
    if any(unicodedata.category(ch) == "Cc" for ch in text):
        raise validation_error(field, "invalid_characters")
    if len(text) > max_length:
        raise validation_error(field, "too_long")
    return text


def remove_invisible(text):
    """Drop formatting characters, keeping joiners inside emoji sequences."""
    kept = []
    for i, ch in enumerate(text):
        if unicodedata.category(ch) != "Cf":
            kept.append(ch)
        elif ch == ZERO_WIDTH_JOINER and 0 < i < len(text) - 1 \
                and unicodedata.category(text[i - 1]) in ("So", "Sk", "Mn") \
                and unicodedata.category(text[i + 1]) == "So":
            kept.append(ch)
    return "".join(kept)


def optional_bool(data, field):
    """Return data[field] if it is a real JSON boolean, None if absent."""
    if field not in data:
        return None
    value = data[field]
    if not isinstance(value, bool):  # reject 0/1 and "true"
        raise validation_error(field, "not_boolean")
    return value


def optional_text(data, field, max_length):
    """Return an optional text value as clean text, or an empty string."""
    value = data.get(field)
    if value is None or (isinstance(value, str) and not value.strip()):
        return ""
    return clean_text(data, field, max_length)


def is_strict_int(value):
    """True for JSON integers only; bool is an int subclass in Python."""
    return isinstance(value, int) and not isinstance(value, bool)


def require_int(data, field, minimum, maximum):
    """Return data[field] as an integer within the inclusive range."""
    value = data.get(field)
    if value is None:
        raise validation_error(field, "required")
    if not is_strict_int(value):
        raise validation_error(field, "not_integer")
    if not minimum <= value <= maximum:
        raise validation_error(field, "out_of_range")
    return value


def require_date(data, field):
    """Return a real YYYY-MM-DD date between 2000 and 2099."""
    value = data.get(field)
    if value is None:
        raise validation_error(field, "required")
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        raise validation_error(field, "invalid_date")
    try:
        day = date.fromisoformat(value)
    except ValueError:
        raise validation_error(field, "invalid_date") from None
    if not MIN_DATE <= day <= MAX_DATE:
        raise validation_error(field, "out_of_range")
    return value
