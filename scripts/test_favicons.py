"""Tests for favicon assets generated from assets/logo-icon.svg.

Validates that all required favicon files exist, have correct dimensions,
valid PNG format, and that index.html contains the required link tags.

Bounty #471 acceptance criteria:
  - Favicons in 16x16, 32x32, 180x180, 192x192, 512x512
  - Both .ico (via data URI) and .png formats
  - site.webmanifest updated with icon references
  - HTML <head> updated with all favicon link tags
"""

from __future__ import annotations

import json
import struct
from pathlib import Path

import pytest

# ── Repo root ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
FAVICONS_DIR = REPO_ROOT / "assets" / "favicons"
INDEX_HTML = REPO_ROOT / "index.html"
MANIFEST = FAVICONS_DIR / "site.webmanifest"

PNG_MAGIC = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

REQUIRED_PNGS: list[tuple[str, int, int]] = [
    ("favicon-16x16.png", 16, 16),
    ("favicon-32x32.png", 32, 32),
    ("apple-touch-icon.png", 180, 180),
    ("favicon-192x192.png", 192, 192),
    ("favicon-512x512.png", 512, 512),
]


def _png_dimensions(path: Path) -> tuple[int, int]:
    """Return (width, height) from the PNG IHDR chunk."""
    with path.open("rb") as fh:
        fh.seek(16)
        width, height = struct.unpack(">II", fh.read(8))
    return width, height


def _is_valid_png(path: Path) -> bool:
    """Check the 8-byte PNG magic signature."""
    with path.open("rb") as fh:
        return fh.read(8) == PNG_MAGIC


def _html_contains(fragment: str) -> bool:
    """Return True if index.html contains fragment (case-insensitive)."""
    return fragment.lower() in INDEX_HTML.read_text(encoding="utf-8").lower()


# ── File existence ────────────────────────────────────────────────────────────


def test_favicons_dir_exists():
    """assets/favicons/ directory must exist."""
    assert FAVICONS_DIR.is_dir(), f"Missing directory: {FAVICONS_DIR}"


def test_webmanifest_exists():
    """site.webmanifest must be present."""
    assert MANIFEST.is_file(), f"Missing: {MANIFEST}"


def test_index_html_exists():
    """Root index.html must exist."""
    assert INDEX_HTML.is_file(), "Missing index.html"


def test_source_svg_exists():
    """The source SVG logo-icon.svg must exist in assets/."""
    assert (REPO_ROOT / "assets" / "logo-icon.svg").is_file(), (
        "Missing source SVG: assets/logo-icon.svg"
    )


@pytest.mark.parametrize("filename,_w,_h", REQUIRED_PNGS)
def test_png_exists(filename: str, _w: int, _h: int):
    """Each required PNG favicon must exist on disk."""
    assert (FAVICONS_DIR / filename).is_file(), f"Missing: {filename}"


# ── PNG validity ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("filename,_w,_h", REQUIRED_PNGS)
def test_valid_png_magic(filename: str, _w: int, _h: int):
    """PNG file must start with the 8-byte PNG magic sequence."""
    assert _is_valid_png(FAVICONS_DIR / filename), (
        f"{filename}: invalid PNG magic bytes"
    )


@pytest.mark.parametrize("filename,_w,_h", REQUIRED_PNGS)
def test_png_not_empty(filename: str, _w: int, _h: int):
    """PNG files must not be empty."""
    assert (FAVICONS_DIR / filename).stat().st_size > 8, (
        f"{filename}: file is empty or too small"
    )


# ── PNG dimensions ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("filename,expected_w,expected_h", REQUIRED_PNGS)
def test_png_width(filename: str, expected_w: int, expected_h: int):
    """PNG width must match the specified size."""
    w, _ = _png_dimensions(FAVICONS_DIR / filename)
    assert w == expected_w, f"{filename}: expected width {expected_w}, got {w}"


@pytest.mark.parametrize("filename,expected_w,expected_h", REQUIRED_PNGS)
def test_png_height(filename: str, expected_w: int, expected_h: int):
    """PNG height must match the specified size."""
    _, h = _png_dimensions(FAVICONS_DIR / filename)
    assert h == expected_h, f"{filename}: expected height {expected_h}, got {h}"


@pytest.mark.parametrize("filename,_w,_h", REQUIRED_PNGS)
def test_png_is_square(filename: str, _w: int, _h: int):
    """All favicon PNGs must be square."""
    w, h = _png_dimensions(FAVICONS_DIR / filename)
    assert w == h, f"{filename}: not square ({w}x{h})"


# ── site.webmanifest ──────────────────────────────────────────────────────────


def test_manifest_valid_json():
    """site.webmanifest must be valid JSON."""
    json.loads(MANIFEST.read_text(encoding="utf-8"))  # raises on invalid JSON


def test_manifest_has_name():
    """Manifest must declare an app name."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert "name" in data, "Missing 'name' in site.webmanifest"


def test_manifest_has_icons():
    """Manifest must include an icons array."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert "icons" in data and len(data["icons"]) > 0, (
        "Missing or empty 'icons' in site.webmanifest"
    )


def test_manifest_has_192_icon():
    """Manifest must include a 192x192 icon."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sizes = [i.get("sizes", "") for i in data["icons"]]
    assert "192x192" in sizes, "Missing 192x192 in site.webmanifest icons"


def test_manifest_has_512_icon():
    """Manifest must include a 512x512 icon."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sizes = [i.get("sizes", "") for i in data["icons"]]
    assert "512x512" in sizes, "Missing 512x512 in site.webmanifest icons"


def test_manifest_icon_srcs_exist():
    """All manifest icon src paths must point to existing files."""
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for icon in data["icons"]:
        src = icon.get("src", "")
        # src may be absolute (/assets/...) or relative
        rel = src.lstrip("/")
        path = REPO_ROOT / rel
        assert path.is_file(), f"Manifest icon src missing on disk: {src}"


# ── index.html link tags ──────────────────────────────────────────────────────


def test_html_has_16x16():
    """index.html must reference a 16x16 favicon."""
    assert _html_contains('sizes="16x16"'), "Missing 16x16 tag in index.html"


def test_html_has_32x32():
    """index.html must reference a 32x32 favicon."""
    assert _html_contains('sizes="32x32"'), "Missing 32x32 tag in index.html"


def test_html_has_180x180():
    """index.html must reference a 180x180 apple-touch-icon."""
    assert _html_contains('sizes="180x180"'), (
        "Missing 180x180 apple-touch-icon tag in index.html"
    )


def test_html_has_192x192():
    """index.html must reference a 192x192 favicon."""
    assert _html_contains('sizes="192x192"'), "Missing 192x192 tag in index.html"


def test_html_has_512x512():
    """index.html must reference a 512x512 favicon."""
    assert _html_contains('sizes="512x512"'), "Missing 512x512 tag in index.html"


def test_html_has_manifest_link():
    """index.html must link to site.webmanifest."""
    assert _html_contains('rel="manifest"'), (
        "Missing <link rel='manifest'> in index.html"
    )


def test_html_has_apple_touch_icon():
    """index.html must include an apple-touch-icon link."""
    assert _html_contains('rel="apple-touch-icon"'), (
        "Missing apple-touch-icon link in index.html"
    )


def test_html_has_ico_format():
    """ICO format must be present — physical file or data URI."""
    content = INDEX_HTML.read_text(encoding="utf-8")
    has_ico = (
        "image/x-icon" in content
        or "image/vnd.microsoft.icon" in content
        or "data:image/x-icon" in content
    )
    assert has_ico, "Missing ICO format reference in index.html"


def test_html_has_png_type():
    """index.html must have at least one image/png link tag."""
    assert _html_contains('type="image/png"'), (
        "Missing image/png link tags in index.html"
    )
