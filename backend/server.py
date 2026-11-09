"""HTTP server: JSON API under /api and static frontend files.

Run from the project root:
    python3 -m backend.server [--port 8000] [--host 127.0.0.1]

The server binds to localhost only. Public access goes through an SSH
tunnel (scripts/tunnel.sh, Phase 7) so this machine never opens a port
directly to the internet.
"""

import argparse
import json
import re
import sys
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from backend import database

FRONTEND_DIR = database.PROJECT_ROOT / "frontend"
MAX_BODY_BYTES = 64 * 1024

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",  # share tokens live in URLs
    "Content-Security-Policy": (
        "default-src 'self'; style-src 'self'; script-src 'self'; "
        "img-src 'self' data:; frame-ancestors 'none'"
    ),
}


class ApiError(Exception):
    """An error with a stable machine-readable code for the frontend."""

    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


# ---- Route handlers --------------------------------------------------------
# Each handler receives (request, **path_params) and returns
# (status, payload). Feature modules will add routes in later phases.


def health(request):
    conn = request.open_db()
    try:
        version = database.schema_version(conn)
    finally:
        conn.close()
    return HTTPStatus.OK, {"status": "ok", "schema_version": version}


ROUTES = [
    ("GET", r"/api/health", health),
]
COMPILED_ROUTES = [(m, re.compile(f"^{p}$"), h) for m, p, h in ROUTES]


# ---- Request handling ------------------------------------------------------


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "ExpenseSplitter"
    sys_version = ""  # don't advertise the Python version

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_PATCH(self):
        self.dispatch("PATCH")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            self.handle_api(method, path)
        elif method == "GET":
            self.serve_static(path)
        else:
            self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, error_body(
                "METHOD_NOT_ALLOWED", "Method not allowed"))

    # -- API --

    def handle_api(self, method, path):
        try:
            handler, params = self.match_route(method, path)
            status, payload = handler(self, **params)
            self.send_json(status, payload)
        except ApiError as err:
            self.send_json(err.status, error_body(err.code, err.message, err.details))
        except Exception:  # never leak stack traces to clients
            self.log_error("Unhandled error on %s %s", method, path)
            traceback.print_exc()
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, error_body(
                "INTERNAL_ERROR", "Something went wrong"))

    def match_route(self, method, path):
        path_matched = False
        for route_method, pattern, handler in COMPILED_ROUTES:
            match = pattern.match(path)
            if match:
                path_matched = True
                if route_method == method:
                    return handler, match.groupdict()
        if path_matched:
            raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED,
                           "METHOD_NOT_ALLOWED", "Method not allowed")
        raise ApiError(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Endpoint not found")

    def read_json(self):
        """Parse the request body as a JSON object (used from Phase 2)."""
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                           "BODY_TOO_LARGE", "Request body is too large")
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_JSON",
                           "Request body must be valid JSON")
        if not isinstance(data, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_JSON",
                           "Request body must be a JSON object")
        return data

    def open_db(self):
        return database.connect(self.server.db_path)

    # -- Static files --

    def serve_static(self, path):
        file_path = resolve_static_path(path)
        if file_path is None:
            self.send_plain(HTTPStatus.NOT_FOUND, "Not found")
            return
        body = file_path.read_bytes()
        content_type = CONTENT_TYPES.get(file_path.suffix, "application/octet-stream")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        # Development-friendly: always fetch fresh files after edits.
        self.send_header("Cache-Control", "no-cache")
        self.send_common_headers()
        self.end_headers()
        self.wfile.write(body)

    # -- Response helpers --

    def send_common_headers(self):
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_common_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_plain(self, status, text):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_common_headers()
        self.end_headers()
        self.wfile.write(body)


def error_body(code, message, details=None):
    return {"error": {"code": code, "message": message, "details": details or {}}}


def resolve_static_path(url_path):
    """Map a URL path to a file inside FRONTEND_DIR, or None.

    "/" and "/g/<token>" serve index.html (the frontend reads the token
    from location.pathname). Anything resolving outside FRONTEND_DIR,
    e.g. "/../backend/server.py", is rejected.
    """
    if url_path == "/" or url_path.startswith("/g/"):
        return FRONTEND_DIR / "index.html"
    candidate = (FRONTEND_DIR / url_path.lstrip("/")).resolve()
    if not candidate.is_relative_to(FRONTEND_DIR) or not candidate.is_file():
        return None
    return candidate


def make_server(host, port, db_path=database.DEFAULT_DB_PATH):
    database.init_db(db_path)
    server = ThreadingHTTPServer((host, port), RequestHandler)
    server.db_path = db_path
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description="Expense Splitter server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=database.DEFAULT_DB_PATH)
    args = parser.parse_args(argv)

    server = make_server(args.host, args.port, args.db)
    print(f"Expense Splitter running at http://{args.host}:{args.port}/")
    print(f"Database: {args.db}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())
