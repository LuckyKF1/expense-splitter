import re
import unittest
from pathlib import Path

CSS = (Path(__file__).parent.parent / "frontend/css/style.css").read_text()


def tokens(selector_pattern):
    block = re.search(selector_pattern + r"\s*\{([^}]*)\}", CSS)
    return dict(re.findall(r"(--[\w-]+):\s*([^;]+);", block.group(1)))


class DarkThemeTests(unittest.TestCase):
    def test_chosen_dark_theme_matches_the_device_dark_theme(self):
        # The dark colours are written twice (device setting, and the theme
        # button); editing only one would make the two "dark" modes differ.
        device = tokens(r':root:not\(\[data-theme="light"\]\)')
        chosen = tokens(r':root\[data-theme="dark"\]')
        self.assertGreater(len(device), 10)
        self.assertEqual(device, chosen)


if __name__ == "__main__":
    unittest.main()
