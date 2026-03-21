"""Security tests for input validation and sanitization."""

import pytest
from app.core.security import (
    sanitize_html,
    sanitize_text,
    validate_solana_wallet,
    validate_url,
    validate_github_url,
    sanitize_sql_identifier,
    escape_like_pattern,
    is_safe_redirect,
    SecurityValidator,
)


class TestInputSanitization:
    """Tests for input sanitization functions."""

    def test_sanitize_html_removes_script_tags(self):
        """Script tags should be removed."""
        malicious = "<script>alert('xss')</script>Hello"
        result = sanitize_html(malicious)
        assert "<script>" not in result
        assert "alert" not in result

    def test_sanitize_html_removes_javascript_urls(self):
        """javascript: URLs should be removed."""
        malicious = '<a href="javascript:alert(1)">Click</a>'
        result = sanitize_html(malicious)
        assert "javascript:" not in result

    def test_sanitize_html_removes_event_handlers(self):
        """Event handlers should be removed."""
        malicious = '<img src="x" onerror="alert(1)">'
        result = sanitize_html(malicious)
        assert "onerror" not in result

    def test_sanitize_html_allows_safe_tags(self):
        """Safe tags should be preserved."""
        safe = "<p>Hello <b>World</b></p>"
        result = sanitize_html(safe)
        assert "<p>" in result
        assert "<b>" in result

    def test_sanitize_html_truncates_long_content(self):
        """Content should be truncated to max_length."""
        long_content = "x" * 20000
        result = sanitize_html(long_content, max_length=1000)
        assert len(result) <= 1000

    def test_sanitize_text_removes_html(self):
        """HTML tags should be stripped from plain text."""
        text = "<p>Hello</p> World"
        result = sanitize_text(text)
        assert "<p>" not in result
        assert result == "Hello World"

    def test_sanitize_text_removes_control_chars(self):
        """Control characters should be removed."""
        text = "Hello\x00World\x1f"
        result = sanitize_text(text)
        assert "\x00" not in result
        assert "\x1f" not in result


class TestWalletValidation:
    """Tests for Solana wallet address validation."""

    def test_valid_wallet_address(self):
        """Valid Solana wallet addresses should pass."""
        # Example valid base58 address
        valid_address = "7NpQwGJCyK5xVb5GdUgZzXQe4ZrVJQYQe5uY3nLnL9Va"
        assert validate_solana_wallet(valid_address) is True

    def test_invalid_wallet_too_short(self):
        """Wallet addresses that are too short should fail."""
        short_address = "abc"
        assert validate_solana_wallet(short_address) is False

    def test_invalid_wallet_too_long(self):
        """Wallet addresses that are too long should fail."""
        long_address = "x" * 50
        assert validate_solana_wallet(long_address) is False

    def test_invalid_wallet_invalid_chars(self):
        """Wallet addresses with invalid characters should fail."""
        invalid_address = "7NpQwGJCy5xVb5GdUgZzXQe4ZrVJQYQe5uY3nLnL9Va!"
        assert validate_solana_wallet(invalid_address) is False

    def test_empty_wallet(self):
        """Empty wallet address should fail."""
        assert validate_solana_wallet("") is False


class TestURLValidation:
    """Tests for URL validation."""

    def test_valid_http_url(self):
        """Valid HTTP URLs should pass."""
        assert validate_url("http://example.com") is True

    def test_valid_https_url(self):
        """Valid HTTPS URLs should pass."""
        assert validate_url("https://example.com") is True

    def test_invalid_url_no_scheme(self):
        """URLs without scheme should fail."""
        assert validate_url("example.com") is False

    def test_invalid_url_javascript_scheme(self):
        """javascript: URLs should fail."""
        assert validate_url("javascript:alert(1)") is False

    def test_valid_github_url(self):
        """Valid GitHub URLs should pass."""
        assert validate_github_url("https://github.com/owner/repo") is True

    def test_invalid_github_url_wrong_domain(self):
        """Non-GitHub URLs should fail."""
        assert validate_github_url("https://gitlab.com/owner/repo") is False


class TestSQLSanitization:
    """Tests for SQL injection prevention."""

    def test_sanitize_sql_identifier_alphanumeric(self):
        """Alphanumeric identifiers should pass."""
        result = sanitize_sql_identifier("table_name_123")
        assert result == "table_name_123"

    def test_sanitize_sql_identifier_removes_special_chars(self):
        """Special characters should be removed."""
        result = sanitize_sql_identifier("table;name--drop")
        assert ";" not in result
        assert "-" not in result

    def test_sanitize_sql_identifier_empty(self):
        """Empty identifier should return empty string."""
        assert sanitize_sql_identifier("") == ""

    def test_escape_like_pattern_percent(self):
        """Percent signs should be escaped in LIKE patterns."""
        result = escape_like_pattern("test%value")
        assert result == "test\\%value"

    def test_escape_like_pattern_underscore(self):
        """Underscores should be escaped in LIKE patterns."""
        result = escape_like_pattern("test_value")
        assert result == "test\\_value"

    def test_escape_like_pattern_backslash(self):
        """Backslashes should be escaped in LIKE patterns."""
        result = escape_like_pattern("test\\value")
        assert result == "test\\\\value"


class TestRedirectSafety:
    """Tests for redirect URL safety."""

    def test_safe_redirect_relative(self):
        """Relative URLs should be safe."""
        assert is_safe_redirect("/dashboard", []) is True

    def test_safe_redirect_allowed_host(self):
        """URLs with allowed hosts should be safe."""
        assert is_safe_redirect(
            "https://solfoundry.org/callback",
            ["solfoundry.org"]
        ) is True

    def test_unsafe_redirect_external(self):
        """External URLs should be unsafe without allowed hosts."""
        assert is_safe_redirect("https://evil.com", []) is False

    def test_unsafe_redirect_protocol_relative(self):
        """Protocol-relative URLs should be checked carefully."""
        # "//evil.com" could be interpreted as external
        assert is_safe_redirect("//evil.com", []) is False


class TestSecurityValidator:
    """Tests for SecurityValidator class."""

    def test_validate_bounty_title_valid(self):
        """Valid bounty titles should pass."""
        is_valid, error = SecurityValidator.validate_bounty_title(
            "Implement new feature"
        )
        assert is_valid is True
        assert error == ""

    def test_validate_bounty_title_empty(self):
        """Empty titles should fail."""
        is_valid, error = SecurityValidator.validate_bounty_title("")
        assert is_valid is False
        assert "required" in error.lower()

    def test_validate_bounty_title_too_long(self):
        """Titles exceeding max length should fail."""
        is_valid, error = SecurityValidator.validate_bounty_title("x" * 600)
        assert is_valid is False
        assert "characters" in error.lower()

    def test_validate_bounty_title_xss_attempt(self):
        """Titles with XSS attempts should fail."""
        is_valid, error = SecurityValidator.validate_bounty_title(
            "<script>alert(1)</script>"
        )
        assert is_valid is False

    def test_validate_bounty_description_valid(self):
        """Valid descriptions should pass."""
        is_valid, error = SecurityValidator.validate_bounty_description(
            "This is a detailed description."
        )
        assert is_valid is True
        assert error == ""

    def test_validate_comment_valid(self):
        """Valid comments should pass."""
        is_valid, error = SecurityValidator.validate_comment(
            "Great work on this!"
        )
        assert is_valid is True
        assert error == ""


# Run tests with: pytest tests/security/test_security.py -v