"""The one exception type that becomes an HTTP error response.

Lives in its own module so feature modules (groups.py, expenses.py, ...)
can raise it without importing server.py.
"""


class ApiError(Exception):
    """An error with a stable machine-readable code for the frontend.

    The frontend translates `code` (and `details["reason"]`) into
    English or Lao, so `message` is only a developer-facing fallback.
    """

    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}
