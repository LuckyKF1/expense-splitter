import json
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
