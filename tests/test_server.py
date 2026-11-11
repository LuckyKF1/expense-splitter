import base64
import contextlib
import hashlib
import http.client
import io
import json
import re
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from backend import server


class ServerTestCase(unittest.TestCase):
    """Starts a real server on a random free port for each test class."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.httpd = server.make_server("127.0.0.1", 0, Path(cls.tmp.name) / "test.db")
        cls.httpd.RequestHandlerClass.log_message = lambda *a: None  # quiet tests
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.tmp.cleanup()

    def request(self, method, path, body=None):
        """Return (status, headers, raw_body) without raising on 4xx/5xx."""
        req = urllib.request.Request(self.base + path, method=method, data=body)
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as err:
            return err.code, err.headers, err.read()


class ApiTests(ServerTestCase):
    def test_health(self):
        status, headers, body = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("application/json"))
        self.assertEqual(json.loads(body)["status"], "ok")

    def test_unknown_endpoint_returns_json_error(self):
        status, _, body = self.request("GET", "/api/nope")
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body)["error"]["code"], "NOT_FOUND")

    def test_wrong_method_returns_405(self):
        status, _, body = self.request("DELETE", "/api/health")
        self.assertEqual(status, 405)
        self.assertEqual(json.loads(body)["error"]["code"], "METHOD_NOT_ALLOWED")

    def test_security_headers_present(self):
        _, headers, _ = self.request("GET", "/api/health")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("default-src 'self'", headers["Content-Security-Policy"])
        self.assertNotIn("Python", headers["Server"])


class KeepAliveTests(ServerTestCase):
    """Over a tunnel every new connection costs a long round trip, so the
    server must keep connections open (HTTP/1.1) and stay correct on them."""

    def connection(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1], timeout=5)
        self.addCleanup(conn.close)
        return conn

    def test_responses_use_http_1_1_and_reuse_the_connection(self):
        conn = self.connection()
        for _ in range(3):
            conn.request("GET", "/api/health")
            response = conn.getresponse()
            response.read()
            self.assertEqual(response.version, 11)
            self.assertEqual(response.status, 200)
        conn.request("GET", "/css/style.css")
        self.assertEqual(conn.getresponse().status, 200)

    def test_unread_request_body_does_not_corrupt_the_next_request(self):
        conn = self.connection()
        # 404 is decided before the body would be read.
        conn.request("POST", "/api/nope", body=b'{"name": "x"}',
                     headers={"Content-Type": "application/json"})
        first = conn.getresponse()
        first.read()
        self.assertEqual(first.status, 404)
        conn.request("GET", "/api/health")
        second = conn.getresponse()
        self.assertEqual(second.status, 200)
        self.assertEqual(json.loads(second.read())["status"], "ok")

    def test_oversized_body_closes_the_connection_cleanly(self):
        conn = self.connection()
        conn.request("POST", "/api/groups", body=b"x" * (server.MAX_BODY_BYTES + 1))
        response = conn.getresponse()
        response.read()
        self.assertEqual(response.status, 413)
        self.assertEqual(response.getheader("Connection"), "close")
        conn.request("GET", "/api/health")  # http.client reconnects as told
        self.assertEqual(conn.getresponse().status, 200)

    def test_client_dropping_a_connection_is_not_logged_as_an_error(self):
        # Browsers and tunnels drop idle keep-alive connections all the
        # time; that must not print tracebacks into the server terminal.
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            for exc in (ConnectionResetError(104, "reset"), BrokenPipeError(32, "pipe")):
                try:
                    raise exc
                except OSError:
                    self.httpd.handle_error(None, ("127.0.0.1", 1))
        self.assertEqual(stderr.getvalue(), "")

    def test_real_errors_are_still_logged(self):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            try:
                raise ValueError("boom")
            except ValueError:
                self.httpd.handle_error(None, ("127.0.0.1", 1))
        self.assertIn("boom", stderr.getvalue())

    def test_204_response_keeps_the_connection_usable(self):
        conn = self.connection()
        conn.request("POST", "/api/groups", body=b'{"name": "t"}')
        token = json.loads(conn.getresponse().read())["token"]
        conn.request("DELETE", f"/api/groups/{token}")
        deleted = conn.getresponse()
        self.assertEqual((deleted.status, deleted.read()), (204, b""))
        conn.request("GET", "/api/health")
        self.assertEqual(conn.getresponse().status, 200)


class StaticFileTests(ServerTestCase):
    def test_root_serves_index(self):
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Expense Splitter", body)

    def test_share_link_serves_index(self):
        status, _, body = self.request("GET", "/g/some-token")
        self.assertEqual(status, 200)
        self.assertIn(b"Expense Splitter", body)

    def test_serves_css_with_content_type(self):
        status, headers, _ = self.request("GET", "/css/style.css")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/css"))

    def test_unchanged_static_file_revalidates_with_304(self):
        status, headers, body = self.request("GET", "/js/app.js")
        etag = headers["ETag"]
        self.assertEqual(status, 200)
        self.assertTrue(etag)
        req = urllib.request.Request(self.base + "/js/app.js", headers={"If-None-Match": etag})
        try:
            urllib.request.urlopen(req)
            self.fail("expected 304")
        except urllib.error.HTTPError as err:
            self.assertEqual(err.code, 304)
            self.assertEqual(err.read(), b"")

    def test_different_etag_gets_the_full_file(self):
        req = urllib.request.Request(self.base + "/js/app.js", headers={"If-None-Match": '"old"'})
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(b"import", resp.read())

    def index(self):
        status, headers, body = self.request("GET", "/g/some-token")
        self.assertEqual(status, 200)
        return headers, body.decode()

    def test_index_preloads_every_module_in_parallel(self):
        # Without this, imports are discovered level by level: one round
        # trip per level of the import tree.
        _, html = self.index()
        for module in ("/js/app.js", "/js/format.js", "/js/views/summary.js",
                       "/js/views/shared.js", "/js/expense-model.js"):
            self.assertRegex(html, rf'<link rel="modulepreload" href="{module}\?v=[0-9a-f]+">')

    def test_import_map_points_every_module_at_a_versioned_url(self):
        _, html = self.index()
        match = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
        self.assertIsNotNone(match, "no import map")
        imports = json.loads(match.group(1))["imports"]
        self.assertRegex(imports["/js/format.js"], r"^/js/format\.js\?v=[0-9a-f]+$")
        self.assertRegex(html, r'<script type="module" src="/js/app\.js\?v=[0-9a-f]+">')
        self.assertRegex(html, r'<link rel="stylesheet" href="/css/style\.css\?v=[0-9a-f]+">')

    def test_csp_allows_exactly_this_import_map(self):
        # The import map is an inline script; CSP must allow it by hash
        # (not by 'unsafe-inline', which would also allow injected scripts).
        headers, html = self.index()
        inline = re.search(r'<script type="importmap">(.*?)</script>', html, re.S).group(1)
        digest = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
        csp = headers["Content-Security-Policy"]
        self.assertIn(f"'sha256-{digest}'", csp)
        self.assertNotIn("unsafe-inline", csp)

    def test_versioned_files_are_cached_for_good(self):
        _, html = self.index()
        url = re.search(r'src="(/js/app\.js\?v=[0-9a-f]+)"', html).group(1)
        status, headers, _ = self.request("GET", url)
        self.assertEqual(status, 200)
        self.assertIn("immutable", headers["Cache-Control"])
        self.assertIn("max-age=31536000", headers["Cache-Control"])

    def test_unversioned_files_still_revalidate(self):
        _, headers, _ = self.request("GET", "/js/app.js")
        self.assertEqual(headers["Cache-Control"], "no-cache")

    def test_version_changes_when_a_file_changes(self):
        version = server.asset_version
        self.assertEqual(version(b"same"), version(b"same"))
        self.assertNotEqual(version(b"one"), version(b"two"))

    def test_path_traversal_is_blocked(self):
        for path in ("/../backend/server.py", "/%2e%2e/backend/server.py",
                     "/css/../../backend/database.py"):
            status, _, body = self.request("GET", path)
            self.assertEqual(status, 404, path)
            self.assertNotIn(b"import", body)

    def test_resolve_static_path_rejects_outside_paths(self):
        self.assertIsNone(server.resolve_static_path("/../backend/server.py"))
        self.assertIsNone(server.resolve_static_path("/../../etc/passwd"))


if __name__ == "__main__":
    unittest.main()
