"""HTML email templates for SolFoundry notifications.

Provides branded email templates for different notification types.
"""

import os
from datetime import datetime
from typing import Any, Dict, Optional


class EmailTemplateEngine:
    """Engine for rendering HTML email templates."""

    # SolFoundry brand colors
    COLORS = {
        "primary": "#6366F1",  # Indigo
        "secondary": "#8B5CF6",  # Purple
        "accent": "#EC4899",  # Pink
        "background": "#F8FAFC",
        "card": "#FFFFFF",
        "text": "#1E293B",
        "text_secondary": "#64748B",
        "border": "#E2E8F0",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
    }

    # Logo URL
    LOGO_URL = os.getenv(
        "EMAIL_LOGO_URL",
        "https://solfoundry.org/logo.png"
    )

    # Base URL for links
    BASE_URL = os.getenv("FRONTEND_URL", "https://solfoundry.org")

    @staticmethod
    def render_template(
        template_name: str,
        context: Dict[str, Any],
    ) -> str:
        """Render a template with the given context.

        Args:
            template_name: Name of the template to render.
            context: Variables to pass to the template.

        Returns:
            Rendered HTML string.
        """
        templates = {
            "bounty_claimed": EmailTemplateEngine._bounty_claimed_template,
            "pr_submitted": EmailTemplateEngine._pr_submitted_template,
            "review_complete": EmailTemplateEngine._review_complete_template,
            "payout_sent": EmailTemplateEngine._payout_sent_template,
            "new_bounty_matching_skills": EmailTemplateEngine._new_bounty_template,
            "unsubscribe_confirmation": EmailTemplateEngine._unsubscribe_confirmation_template,
            "email_preferences": EmailTemplateEngine._email_preferences_template,
        }

        renderer = templates.get(template_name)
        if not renderer:
            raise ValueError(f"Unknown template: {template_name}")

        # Add common context
        context = {
            **context,
            "logo_url": EmailTemplateEngine.LOGO_URL,
            "base_url": EmailTemplateEngine.BASE_URL,
            "current_year": datetime.utcnow().year,
            "colors": EmailTemplateEngine.COLORS,
        }

        return renderer(context)

    @staticmethod
    def _base_html(content: str, context: Dict[str, Any]) -> str:
        """Generate base HTML structure with SolFoundry branding."""
        colors = context["colors"]
        logo_url = context["logo_url"]
        base_url = context["base_url"]
        current_year = context["current_year"]
        unsubscribe_url = context.get("unsubscribe_url", f"{base_url}/settings/notifications")
        user_name = context.get("user_name", "Contributor")

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SolFoundry Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: {colors['background']}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: {colors['background']};">
        <tr>
            <td style="padding: 40px 20px;">
                <!-- Email Container -->
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="margin: 0 auto; background-color: {colors['card']}; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; border-bottom: 1px solid {colors['border']};">
                            <a href="{base_url}" style="text-decoration: none;">
                                <img src="{logo_url}" alt="SolFoundry" width="160" style="display: inline-block; height: auto;">
                            </a>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid {colors['border']}; text-align: center;">
                            <p style="margin: 0 0 15px 0; font-size: 14px; color: {colors['text_secondary']};">
                                You're receiving this email because you're a SolFoundry contributor.
                            </p>
                            <p style="margin: 0 0 15px 0; font-size: 14px;">
                                <a href="{unsubscribe_url}" style="color: {colors['primary']}; text-decoration: underline;">Manage notification preferences</a>
                                &nbsp;&bull;&nbsp;
                                <a href="{base_url}" style="color: {colors['primary']}; text-decoration: underline;">Visit Dashboard</a>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: {colors['text_secondary']};">
                                © {current_year} SolFoundry. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    @staticmethod
    def _bounty_claimed_template(context: Dict[str, Any]) -> str:
        """Template for bounty claimed notification."""
        colors = context["colors"]
        base_url = context["base_url"]
        bounty_title = context.get("bounty_title", "Unknown Bounty")
        bounty_id = context.get("bounty_id", "")
        bounty_url = f"{base_url}/bounties/{bounty_id}" if bounty_id else "#"
        claimer_name = context.get("claimer_name", "A contributor")
        bounty_reward = context.get("bounty_reward", "")
        user_name = context.get("user_name", "Creator")

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                🎉 Bounty Claimed!
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                Great news! <strong>{claimer_name}</strong> has claimed your bounty:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px; border-left: 4px solid {colors['primary']};">
                        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: {colors['text']};">{bounty_title}</p>
                        {f'<p style="margin: 0; font-size: 14px; color: {colors["success"]}; font-weight: 600;">Reward: {bounty_reward}</p>' if bounty_reward else ''}
                    </td>
                </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                The contributor will now work on implementing the solution. You'll be notified when a PR is submitted for review.
            </p>
            <a href="{bounty_url}" style="display: inline-block; padding: 14px 28px; background-color: {colors['primary']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Bounty Details
            </a>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _pr_submitted_template(context: Dict[str, Any]) -> str:
        """Template for PR submitted notification."""
        colors = context["colors"]
        base_url = context["base_url"]
        bounty_title = context.get("bounty_title", "Unknown Bounty")
        bounty_id = context.get("bounty_id", "")
        bounty_url = f"{base_url}/bounties/{bounty_id}" if bounty_id else "#"
        pr_url = context.get("pr_url", "#")
        pr_number = context.get("pr_number", "")
        contributor_name = context.get("contributor_name", "A contributor")
        user_name = context.get("user_name", "Reviewer")

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                🔀 New Pull Request
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                <strong>{contributor_name}</strong> has submitted a pull request for review:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px; border-left: 4px solid {colors['secondary']};">
                        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: {colors['text']};">{bounty_title}</p>
                        <p style="margin: 0; font-size: 14px; color: {colors['primary']};">PR #{pr_number}</p>
                    </td>
                </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                Please review the changes at your earliest convenience. Timely reviews help maintain contributor engagement.
            </p>
            <a href="{pr_url}" style="display: inline-block; padding: 14px 28px; background-color: {colors['primary']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review Pull Request
            </a>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _review_complete_template(context: Dict[str, Any]) -> str:
        """Template for review complete notification."""
        colors = context["colors"]
        base_url = context["base_url"]
        bounty_title = context.get("bounty_title", "Unknown Bounty")
        bounty_id = context.get("bounty_id", "")
        bounty_url = f"{base_url}/bounties/{bounty_id}" if bounty_id else "#"
        pr_url = context.get("pr_url", "#")
        review_status = context.get("review_status", "approved")
        review_score = context.get("review_score", "")
        reviewer_feedback = context.get("reviewer_feedback", "")
        user_name = context.get("user_name", "Contributor")

        # Determine status color and icon
        if review_status == "approved":
            status_color = colors["success"]
            status_icon = "✅"
            status_text = "Approved"
        elif review_status == "changes_requested":
            status_color = colors["warning"]
            status_icon = "🔄"
            status_text = "Changes Requested"
        else:
            status_color = colors["text_secondary"]
            status_icon = "📝"
            status_text = "Review Complete"

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                {status_icon} Review Complete
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                The review for your PR is complete:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px; border-left: 4px solid {status_color};">
                        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: {colors['text']};">{bounty_title}</p>
                        <p style="margin: 0 0 8px 0; font-size: 14px;">
                            <span style="background-color: {status_color}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: 600;">{status_text}</span>
                            {f'<span style="margin-left: 8px; color: {colors["text_secondary"]};">Score: {review_score}/10</span>' if review_score else ''}
                        </p>
                    </td>
                </tr>
            </table>
            {f'<p style="margin: 0 0 24px 0; font-size: 16px; color: {colors["text"]}; line-height: 1.6; padding: 16px; background-color: {colors["background"]}; border-radius: 8px;">{reviewer_feedback}</p>' if reviewer_feedback else ''}
            <a href="{pr_url}" style="display: inline-block; padding: 14px 28px; background-color: {colors['primary']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Details
            </a>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _payout_sent_template(context: Dict[str, Any]) -> str:
        """Template for payout sent notification."""
        colors = context["colors"]
        base_url = context["base_url"]
        bounty_title = context.get("bounty_title", "Unknown Bounty")
        bounty_id = context.get("bounty_id", "")
        bounty_url = f"{base_url}/bounties/{bounty_id}" if bounty_id else "#"
        amount = context.get("amount", "0")
        token = context.get("token", "$FNDRY")
        transaction_url = context.get("transaction_url", "#")
        user_name = context.get("user_name", "Contributor")

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                💰 Payout Sent!
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                Congratulations! Your bounty payout has been processed:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background: linear-gradient(135deg, {colors['primary']}, {colors['secondary']}); border-radius: 12px; padding: 32px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">Amount Received</p>
                        <p style="margin: 0; font-size: 36px; font-weight: 700; color: white;">{amount} {token}</p>
                    </td>
                </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px;">
                        <p style="margin: 0 0 4px 0; font-size: 14px; color: {colors['text_secondary']};">Bounty</p>
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: {colors['text']};">{bounty_title}</p>
                    </td>
                </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                The tokens have been sent to your registered wallet address. Please check the transaction on the blockchain explorer.
            </p>
            <a href="{transaction_url}" style="display: inline-block; padding: 14px 28px; background-color: {colors['success']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Transaction
            </a>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _new_bounty_template(context: Dict[str, Any]) -> str:
        """Template for new bounty matching skills notification."""
        colors = context["colors"]
        base_url = context["base_url"]
        bounty_title = context.get("bounty_title", "New Bounty")
        bounty_id = context.get("bounty_id", "")
        bounty_url = f"{base_url}/bounties/{bounty_id}" if bounty_id else "#"
        bounty_reward = context.get("bounty_reward", "")
        matched_skills = context.get("matched_skills", [])
        bounty_tier = context.get("bounty_tier", "")
        user_name = context.get("user_name", "Contributor")

        skills_html = ""
        if matched_skills:
            skills_html = '<p style="margin: 8px 0 0 0; font-size: 14px; color: ' + colors['text_secondary'] + ';">Matched skills: '
            skills_html += ', '.join([f'<span style="background-color: ' + colors['primary'] + '; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">' + skill + '</span>' for skill in matched_skills[:5]])
            skills_html += '</p>'

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                🎯 New Bounty Match!
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                A new bounty has been posted that matches your skills:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px; border-left: 4px solid {colors['accent']};">
                        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: {colors['text']};">{bounty_title}</p>
                        {f'<p style="margin: 0 0 4px 0; font-size: 14px; color: {colors["success"]}; font-weight: 600;">Reward: {bounty_reward}</p>' if bounty_reward else ''}
                        {f'<p style="margin: 0; font-size: 14px; color: {colors["text_secondary"]};">Tier: {bounty_tier}</p>' if bounty_tier else ''}
                        {skills_html}
                    </td>
                </tr>
            </table>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                Claim it before someone else does! Tier 1 bounties are first-come-first-served.
            </p>
            <a href="{bounty_url}" style="display: inline-block; padding: 14px 28px; background-color: {colors['accent']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View & Claim Bounty
            </a>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _unsubscribe_confirmation_template(context: Dict[str, Any]) -> str:
        """Template for unsubscribe confirmation."""
        colors = context["colors"]
        base_url = context["base_url"]
        notification_type = context.get("notification_type", "this notification type")
        user_name = context.get("user_name", "User")
        preferences_url = f"{base_url}/settings/notifications"

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                ✅ Unsubscribed
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                You have been successfully unsubscribed from <strong>{notification_type}</strong> emails.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px; text-align: center;">
                        <p style="margin: 0 0 16px 0; font-size: 14px; color: {colors['text_secondary']};">
                            Changed your mind? You can update your preferences anytime.
                        </p>
                        <a href="{preferences_url}" style="display: inline-block; padding: 12px 24px; background-color: {colors['primary']}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            Manage Preferences
                        </a>
                    </td>
                </tr>
            </table>
        """
        return EmailTemplateEngine._base_html(content, context)

    @staticmethod
    def _email_preferences_template(context: Dict[str, Any]) -> str:
        """Template for email preferences page."""
        colors = context["colors"]
        base_url = context["base_url"]
        user_name = context.get("user_name", "User")
        preferences = context.get("preferences", {})

        content = f"""
            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: {colors['text']};">
                ⚙️ Email Preferences
            </h1>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text_secondary']}; line-height: 1.6;">
                Hi {user_name},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 16px; color: {colors['text']}; line-height: 1.6;">
                Your current email notification preferences:
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background-color: {colors['background']}; border-radius: 12px; padding: 24px;">
                        <!-- Preference items will be dynamically inserted -->
                    </td>
                </tr>
            </table>
        """
        return EmailTemplateEngine._base_html(content, context)