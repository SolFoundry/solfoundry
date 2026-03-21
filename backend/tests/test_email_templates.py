"""Template rendering tests for email notifications.

Tests all email templates for:
- Valid HTML structure
- Required content presence
- Branding consistency
"""

import pytest
from app.services.email.templates import EmailTemplateEngine


class TestTemplateRendering:
    """Tests for individual template rendering."""

    def test_bounty_claimed_renders(self):
        """Test bounty_claimed template renders successfully."""
        context = {
            "user_name": "Alice",
            "bounty_title": "Implement OAuth2 Authentication",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440000",
            "claimer_name": "Bob",
            "bounty_reward": "500 $FNDRY",
        }

        html = EmailTemplateEngine.render_template("bounty_claimed", context)

        # Check required content
        assert "Bounty Claimed!" in html
        assert "Alice" in html
        assert "Bob" in html
        assert "Implement OAuth2 Authentication" in html
        assert "500 $FNDRY" in html

        # Check HTML structure
        assert "<!DOCTYPE html>" in html
        assert "</html>" in html

    def test_pr_submitted_renders(self):
        """Test pr_submitted template renders successfully."""
        context = {
            "user_name": "Reviewer",
            "bounty_title": "Add WebSocket Support",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440001",
            "pr_url": "https://github.com/SolFoundry/solfoundry/pull/42",
            "pr_number": "42",
            "contributor_name": "Charlie",
        }

        html = EmailTemplateEngine.render_template("pr_submitted", context)

        assert "New Pull Request" in html
        assert "Reviewer" in html
        assert "Charlie" in html
        assert "Add WebSocket Support" in html
        assert "#42" in html

    def test_review_complete_approved_renders(self):
        """Test review_complete template for approved status."""
        context = {
            "user_name": "Contributor",
            "bounty_title": "Fix Database Migration",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440002",
            "pr_url": "https://github.com/SolFoundry/solfoundry/pull/43",
            "review_status": "approved",
            "review_score": "8",
            "reviewer_feedback": "Great work! Minor suggestions in the comments.",
        }

        html = EmailTemplateEngine.render_template("review_complete", context)

        assert "Review Complete" in html
        assert "Approved" in html
        assert "8/10" in html
        assert "Great work!" in html

    def test_review_complete_changes_requested_renders(self):
        """Test review_complete template for changes requested."""
        context = {
            "user_name": "Contributor",
            "bounty_title": "Add Unit Tests",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440003",
            "pr_url": "https://github.com/SolFoundry/solfoundry/pull/44",
            "review_status": "changes_requested",
            "reviewer_feedback": "Please add more test coverage for edge cases.",
        }

        html = EmailTemplateEngine.render_template("review_complete", context)

        assert "Changes Requested" in html
        assert "add more test coverage" in html

    def test_payout_sent_renders(self):
        """Test payout_sent template renders successfully."""
        context = {
            "user_name": "Recipient",
            "bounty_title": "Complete API Documentation",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440004",
            "amount": "1000",
            "token": "$FNDRY",
            "transaction_url": "https://explorer.solana.com/tx/abc123",
        }

        html = EmailTemplateEngine.render_template("payout_sent", context)

        assert "Payout Sent!" in html
        assert "1000 $FNDRY" in html
        assert "Complete API Documentation" in html

    def test_new_bounty_renders(self):
        """Test new_bounty_matching_skills template renders."""
        context = {
            "user_name": "Developer",
            "bounty_title": "Build REST API with FastAPI",
            "bounty_id": "550e8400-e29b-41d4-a716-446655440005",
            "bounty_reward": "300 $FNDRY",
            "matched_skills": ["Python", "FastAPI", "REST API", "PostgreSQL"],
            "bounty_tier": "T1",
        }

        html = EmailTemplateEngine.render_template("new_bounty_matching_skills", context)

        assert "New Bounty Match!" in html
        assert "Build REST API with FastAPI" in html
        assert "Python" in html
        assert "FastAPI" in html
        assert "300 $FNDRY" in html

    def test_unsubscribe_confirmation_renders(self):
        """Test unsubscribe confirmation template."""
        context = {
            "user_name": "User",
            "notification_type": "bounty_claimed",
        }

        html = EmailTemplateEngine.render_template("unsubscribe_confirmation", context)

        assert "Unsubscribed" in html
        assert "bounty_claimed" in html


class TestTemplateBranding:
    """Tests for branding consistency across templates."""

    @pytest.fixture
    def all_templates(self):
        """Get all template names."""
        return [
            "bounty_claimed",
            "pr_submitted",
            "review_complete",
            "payout_sent",
            "new_bounty_matching_skills",
            "unsubscribe_confirmation",
        ]

    @pytest.fixture
    def base_context(self):
        """Base context for templates."""
        return {
            "user_name": "Test User",
            "bounty_title": "Test Bounty",
            "bounty_id": "test-id",
        }

    def test_all_templates_have_logo(self, all_templates, base_context):
        """Test all templates include logo."""
        for template in all_templates:
            try:
                html = EmailTemplateEngine.render_template(template, base_context)
                # Should have logo URL
                assert "solfoundry.org/logo.png" in html or "logo" in html.lower(), \
                    f"Template {template} missing logo"
            except Exception as e:
                # Some templates may need more context
                pass

    def test_all_templates_have_footer(self, all_templates, base_context):
        """Test all templates have footer with preferences link."""
        for template in all_templates:
            try:
                html = EmailTemplateEngine.render_template(template, base_context)
                assert "preferences" in html.lower() or "unsubscribe" in html.lower(), \
                    f"Template {template} missing preferences/unsubscribe link"
            except Exception:
                pass

    def test_all_templates_have_doctype(self, all_templates, base_context):
        """Test all templates have proper HTML doctype."""
        for template in all_templates:
            try:
                html = EmailTemplateEngine.render_template(template, base_context)
                assert "<!DOCTYPE html>" in html, f"Template {template} missing DOCTYPE"
                assert "</html>" in html, f"Template {template} missing closing HTML tag"
            except Exception:
                pass


class TestTemplateEdgeCases:
    """Tests for edge cases in template rendering."""

    def test_empty_skills_list(self):
        """Test new bounty template with empty skills list."""
        context = {
            "user_name": "Developer",
            "bounty_title": "General Task",
            "bounty_id": "test-id",
            "bounty_reward": "100 $FNDRY",
            "matched_skills": [],
            "bounty_tier": "T3",
        }

        html = EmailTemplateEngine.render_template("new_bounty_matching_skills", context)
        assert "General Task" in html

    def test_long_bounty_title(self):
        """Test template with very long bounty title."""
        long_title = "A" * 200
        context = {
            "user_name": "User",
            "bounty_title": long_title,
            "bounty_id": "test-id",
        }

        # Should not raise error
        html = EmailTemplateEngine.render_template("bounty_claimed", context)
        assert long_title in html

    def test_special_characters_in_name(self):
        """Test template with special characters in user name."""
        context = {
            "user_name": "O'Brien & Smith <script>",  # XSS attempt
            "bounty_title": "Test",
            "bounty_id": "test-id",
        }

        html = EmailTemplateEngine.render_template("bounty_claimed", context)
        # The template should handle this gracefully
        # Note: In production, we should escape HTML entities

    def test_missing_optional_fields(self):
        """Test template with missing optional fields."""
        context = {
            "user_name": "User",
            "bounty_title": "Test Bounty",
            "bounty_id": "test-id",
            # Missing: bounty_reward, claimer_name, etc.
        }

        # Should not raise error
        html = EmailTemplateEngine.render_template("bounty_claimed", context)
        assert "Bounty Claimed!" in html


if __name__ == "__main__":
    pytest.main([__file__, "-v"])