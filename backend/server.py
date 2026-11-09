"""HTTP server: JSON API under /api and static frontend files.

Run from the project root:
    python3 -m backend.server [--port 8000] [--host 127.0.0.1]

The server binds to localhost only. Public access goes through an SSH
tunnel (scripts/tunnel.sh, Phase 7) so this machine never opens a port
directly to the internet.
"""

import argparse
import base64
import hashlib
import json
import re
import sys
import traceback
from contextlib import closing
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from backend import database, expenses, groups, settle_up, summary
from backend.errors import ApiError

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

CSP_TEMPLATE = (
    "default-src 'self'; style-src 'self'; script-src 'self'{extra_script}; "
    "img-src 'self' data:; frame-ancestors 'none'"
)
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",  # share tokens live in URLs
    "Content-Security-Policy": CSP_TEMPLATE.format(extra_script=""),
}
IMMUTABLE = "public, max-age=31536000, immutable"


# ---- Route handlers --------------------------------------------------------
# Each handler receives (request, **path_params) and returns
# (status, payload); a payload of None means "204 No Content".
# Handlers only translate HTTP <-> function calls; the logic lives in
# feature modules such as groups.py.


def health(request):
    with request.db() as conn:
        version = database.schema_version(conn)
    return HTTPStatus.OK, {"status": "ok", "schema_version": version}


def create_group(request):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.CREATED, groups.create_group(conn, data)


def get_group(request, token):
    with request.db() as conn:
        return HTTPStatus.OK, groups.get_group(conn, token)


def rename_group(request, token):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.OK, groups.rename_group(conn, token, data)


def delete_group(request, token):
    with request.db() as conn:
        groups.delete_group(conn, token)
    return HTTPStatus.NO_CONTENT, None


def add_member(request, token):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.CREATED, groups.add_member(conn, token, data)


def update_member(request, token, member_id):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.OK, groups.update_member(conn, token, int(member_id), data)


def delete_member(request, token, member_id):
    with request.db() as conn:
        groups.delete_member(conn, token, int(member_id))
    return HTTPStatus.NO_CONTENT, None


def list_expenses(request, token):
    with request.db() as conn:
        return HTTPStatus.OK, expenses.list_expenses(conn, token)


def create_expense(request, token):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.CREATED, expenses.create_expense(conn, token, data)


def get_expense(request, token, expense_id):
    with request.db() as conn:
        return HTTPStatus.OK, expenses.get_expense(conn, token, int(expense_id))


def update_expense(request, token, expense_id):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.OK, expenses.update_expense(conn, token, int(expense_id), data)


def delete_expense(request, token, expense_id):
    with request.db() as conn:
        expenses.delete_expense(conn, token, int(expense_id))
    return HTTPStatus.NO_CONTENT, None


def get_summary(request, token):
    with request.db() as conn:
        return HTTPStatus.OK, summary.get_summary(conn, token)


def get_settlement_suggestions(request, token):
    with request.db() as conn:
        return HTTPStatus.OK, settle_up.get_suggestions(conn, token)


def list_settlements(request, token):
    with request.db() as conn:
        return HTTPStatus.OK, settle_up.list_settlements(conn, token)


def record_settlement(request, token):
    data = request.read_json()
    with request.db() as conn:
        return HTTPStatus.CREATED, settle_up.record_settlement(conn, token, data)


def delete_settlement(request, token, settlement_id):
    with request.db() as conn:
        settle_up.delete_settlement(conn, token, int(settlement_id))
    return HTTPStatus.NO_CONTENT, None


TOKEN = r"(?P<token>[A-Za-z0-9_-]{1,64})"
MEMBER_ID = r"(?P<member_id>[0-9]{1,18})"
EXPENSE_ID = r"(?P<expense_id>[0-9]{1,18})"
SETTLEMENT_ID = r"(?P<settlement_id>[0-9]{1,18})"

ROUTES = [
    ("GET", r"/api/health", health),
    ("POST", r"/api/groups", create_group),
    ("GET", rf"/api/groups/{TOKEN}", get_group),
    ("PATCH", rf"/api/groups/{TOKEN}", rename_group),
    ("DELETE", rf"/api/groups/{TOKEN}", delete_group),
    ("POST", rf"/api/groups/{TOKEN}/members", add_member),
    ("PATCH", rf"/api/groups/{TOKEN}/members/{MEMBER_ID}", update_member),
    ("DELETE", rf"/api/groups/{TOKEN}/members/{MEMBER_ID}", delete_member),
    ("GET", rf"/api/groups/{TOKEN}/expenses", list_expenses),
    ("POST", rf"/api/groups/{TOKEN}/expenses", create_expense),
    ("GET", rf"/api/groups/{TOKEN}/expenses/{EXPENSE_ID}", get_expense),
    ("PUT", rf"/api/groups/{TOKEN}/expenses/{EXPENSE_ID}", update_expense),
    ("DELETE", rf"/api/groups/{TOKEN}/expenses/{EXPENSE_ID}", delete_expense),
    ("GET", rf"/api/groups/{TOKEN}/summary", get_summary),
    ("GET", rf"/api/groups/{TOKEN}/settlement", get_settlement_suggestions),
    ("GET", rf"/api/groups/{TOKEN}/settlements", list_settlements),
    ("POST", rf"/api/groups/{TOKEN}/settlements", record_settlement),
    ("DELETE", rf"/api/groups/{TOKEN}/settlements/{SETTLEMENT_ID}", delete_settlement),
]
COMPILED_ROUTES = [(m, re.compile(f"^{p}$"), h) for m, p, h in ROUTES]


# ---- Request handling ------------------------------------------------------


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "ExpenseSplitter"
    # Keep-alive: over a tunnel each new connection costs a long round trip.
    # Every response therefore needs Content-Length, and every request body
    # must be consumed (see discard_unread_body) so the next request on the
    # same connection is parsed correctly.
    protocol_version = "HTTP/1.1"
    timeout = 30  # seconds an idle kept-alive connection may hold a thread
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
        self.body_consumed = False
        path = self.path.split("?", 1)[0]
        try:
            if path.startswith("/api/"):
                self.handle_api(method, path)
            elif method == "GET":
                self.serve_static(path)
            else:
                self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, error_body(
                    "METHOD_NOT_ALLOWED", "Method not allowed"))
        finally:
            self.discard_unread_body()

    def discard_unread_body(self):
        """Read any body the handler ignored (e.g. a POST to an unknown
        route), or close the connection if that is not safely possible.
        Leftover bytes would otherwise be parsed as the next request."""
        if self.body_consumed:
            return
        if "Transfer-Encoding" in self.headers:  # chunked bodies: not supported
            self.close_connection = True
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            self.close_connection = True
        elif length:
            self.rfile.read(length)

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
            self.close_connection = True  # body left unread; can't reuse
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                           "BODY_TOO_LARGE", "Request body is too large")
        raw = self.rfile.read(length) if length else b""
        self.body_consumed = True
        try:
            data = json.loads(raw or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_JSON",
                           "Request body must be valid JSON")
        if not isinstance(data, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_JSON",
                           "Request body must be a JSON object")
        return data

    def db(self):
        """One connection per request, always closed (use with `with`)."""
        return closing(database.connect(self.server.db_path))

    # -- Static files --

    def serve_static(self, path):
        file_path = resolve_static_path(path)
        if file_path is None:
            self.send_plain(HTTPStatus.NOT_FOUND, "Not found")
            return
        body = file_path.read_bytes()
        csp = None
        if file_path.name == "index.html":
            body, import_map = versioned_index(body)
            digest = base64.b64encode(hashlib.sha256(import_map).digest()).decode()
            csp = CSP_TEMPLATE.format(extra_script=f" 'sha256-{digest}'")

        # Caching. A URL carrying the file's current version (?v=<hash>,
        # written into index.html) can be kept forever: new code gets a new
        # URL. Anything else is "no-cache": kept, but checked with a cheap
        # 304 each time, so edits show up immediately.
        query = self.path.partition("?")[2]
        cache = IMMUTABLE if query == f"v={asset_version(body)}" else "no-cache"
        etag = f'"{asset_version(body)}"'
        if etag in self.headers.get("If-None-Match", ""):
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", cache)
            self.send_common_headers(csp)
            self.end_headers()
            return
        content_type = CONTENT_TYPES.get(file_path.suffix, "application/octet-stream")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", cache)
        self.send_common_headers(csp)
        self.end_headers()
        self.wfile.write(body)

    # -- Response helpers --

    def send_common_headers(self, csp=None):
        for name, value in SECURITY_HEADERS.items():
            if name == "Content-Security-Policy" and csp:
                value = csp
            self.send_header(name, value)
        if self.close_connection:
            # Tell the client up front so it opens a new connection next time.
            self.send_header("Connection", "close")

    def send_json(self, status, payload):
        if payload is None:  # 204 must not carry a body
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_common_headers()
            self.end_headers()
            return
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


def asset_version(content):
    """Short content hash: changes whenever the file's bytes change."""
    return hashlib.sha256(content).hexdigest()[:16]


def versioned_index(html):
    """Rewrite index.html so the browser can cache CSS/JS for good and
    fetch every module in one parallel round. Built from the files on disk
    at request time, so it can never go stale and needs no build step.

    - An import map sends each module URL (e.g. /js/format.js, which is
      where "./format.js" resolves) to /js/format.js?v=<hash>.
    - <link rel="modulepreload"> for every module, so the browser does not
      discover imports one level (= one round trip) at a time.
    - The stylesheet and entry script get ?v= as well.

    Returns (html, import_map_json) so the caller can allow the inline
    import map in the CSP by its hash.
    """
    def url(path):
        return f"/{path.relative_to(FRONTEND_DIR).as_posix()}?v={asset_version(path.read_bytes())}"

    modules = sorted((FRONTEND_DIR / "js").rglob("*.js"))
    versioned = {f"/{m.relative_to(FRONTEND_DIR).as_posix()}": url(m) for m in modules}
    import_map = json.dumps({"imports": versioned}, separators=(",", ":")).encode()
    preloads = "".join(f'  <link rel="modulepreload" href="{v}">\n' for v in versioned.values())
    css = url(FRONTEND_DIR / "css" / "style.css")

    head = (b'<script type="importmap">' + import_map + b"</script>\n"
            + preloads.encode()
            + f'  <link rel="stylesheet" href="{css}">\n'
              f'  <script type="module" src="{versioned["/js/app.js"]}"></script>\n'.encode())
    html = html.replace(b'  <link rel="stylesheet" href="/css/style.css">\n', b"", 1)
    html = html.replace(b'  <script type="module" src="/js/app.js"></script>\n', b"", 1)
    # The import map must come before anything that loads a module.
    return html.replace(b"</head>", b"  " + head + b"</head>", 1), import_map


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


class Server(ThreadingHTTPServer):
    daemon_threads = True  # idle keep-alive connections must not block exit

    def handle_error(self, request, client_address):
        # A client dropping a kept-alive connection is normal, not an error.
        if isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)


def make_server(host, port, db_path=database.DEFAULT_DB_PATH):
    database.init_db(db_path)
    server = Server((host, port), RequestHandler)
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
