"""HTML email templates for SolFoundry bounty notifications."""

from typing import Optional


def _base_template(title: str, body_html: str, cta_url: Optional[str] = None, cta_text: Optional[str] = None) -> str:
    """Base email template with SolFoundry branding."""
    cta_section = ""
    if cta_url and cta_text:
        cta_section = f"""
        <tr>
          <td style="padding: 24px 40px; text-align: center;">
            <a href="{cta_url}" style="
              display: inline-block;
              background: #F59E0B;
              color: #0A0F1C;
              padding: 14px 32px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 16px;
              text-decoration: none;
            ">{cta_text}</a>
          </td>
        </tr>
        """

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #0A0F1C; font-family: 'Inter', -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #0A0F1C;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #111827; border-radius: 16px; border: 1px solid #374151; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: #111827; padding: 24px 40px; border-bottom: 1px solid #374151;">
              <h1 style="margin: 0; color: #00D4AA; font-size: 20px; font-weight: 700;">SOLFOUNDRY</h1>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <h2 style="margin: 0; color: #F9FAFB; font-size: 24px; font-weight: 700;">{title}</h2>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 20px 40px;">
              <div style="color: #9CA3AF; font-size: 15px; line-height: 1.6;">
                {body_html}
              </div>
            </td>
          </tr>
          <!-- CTA -->
          {cta_section}
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #374151; text-align: center;">
              <p style="margin: 0; color: #6B7280; font-size: 13px;">
                SolFoundry — The AI Agent Bounty Marketplace
                <br>
                <a href="{{unsubscribe_url}}" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a>
                 · 
                <a href="{{preferences_url}}" style="color: #6B7280; text-decoration: underline;">Notification Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def new_bounty_email(
    username: str,
    bounty_title: str,
    bounty_tier: str,
    reward: str,
    skills: list[str],
    bounty_url: str,
) -> str:
    """Email template for new bounty matching user's skills."""
    skills_html = " · ".join(skills)
    body = f"""
      <p>Hey {username},</p>
      <p>A new bounty matching your skills was just posted:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #1F2937; border-radius: 12px; margin: 16px 0;">
        <tr>
          <td style="padding: 20px;">
            <p style="margin: 0 0 8px; color: #F9FAFB; font-size: 18px; font-weight: 600;">{bounty_title}</p>
            <p style="margin: 0 0 4px;">
              <span style="background: #00D4AA20; color: #00D4AA; padding: 2px 8px; border-radius: 12px; font-size: 13px;">{bounty_tier}</span>
              <span style="color: #F59E0B; font-weight: 600; margin-left: 12px;">{reward}</span>
            </p>
            <p style="margin: 8px 0 0; color: #6B7280; font-size: 13px;">{skills_html}</p>
          </td>
        </tr>
      </table>
      <p>Open race — first quality PR wins. Don't miss out!</p>
    """
    return _base_template(
        title="🔨 New Bounty Available",
        body_html=body,
        cta_url=bounty_url,
        cta_text="View Bounty",
    )


def bounty_status_email(
    username: str,
    bounty_title: str,
    status: str,
    details: str,
    bounty_url: str,
) -> str:
    """Email template for bounty status changes."""
    status_colors = {
        "approved": "#00D4AA",
        "changes_requested": "#FBBF24",
        "merged": "#00D4AA",
        "cancelled": "#EF4444",
    }
    color = status_colors.get(status, "#9CA3AF")
    body = f"""
      <p>Hey {username},</p>
      <p>There's an update on a bounty you're tracking:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #1F2937; border-radius: 12px; margin: 16px 0;">
        <tr>
          <td style="padding: 20px;">
            <p style="margin: 0 0 8px; color: #F9FAFB; font-size: 18px; font-weight: 600;">{bounty_title}</p>
            <p style="margin: 0;">
              <span style="background: {color}20; color: {color}; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                {status.replace('_', ' ').title()}
              </span>
            </p>
            <p style="margin: 8px 0 0; color: #9CA3AF; font-size: 14px;">{details}</p>
          </td>
        </tr>
      </table>
    """
    return _base_template(
        title="📋 Bounty Status Update",
        body_html=body,
        cta_url=bounty_url,
        cta_text="View Details",
    )


def payout_email(
    username: str,
    bounty_title: str,
    amount: str,
    tx_url: str,
) -> str:
    """Email template for $FNDRY payout notifications."""
    body = f"""
      <p>Hey {username},</p>
      <p>🎉 Your PR was merged! You've been paid:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #1F2937; border-radius: 12px; margin: 16px 0; text-align: center;">
        <tr>
          <td style="padding: 32px;">
            <p style="margin: 0; color: #F59E0B; font-size: 36px; font-weight: 800;">{amount}</p>
            <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">$FNDRY tokens</p>
            <p style="margin: 12px 0 0; color: #9CA3AF; font-size: 14px;">for <strong style="color: #F9FAFB;">{bounty_title}</strong></p>
          </td>
        </tr>
      </table>
      <p>Payout sent to your Solana wallet. Transaction should confirm within seconds.</p>
    """
    return _base_template(
        title="💰 Payout Received!",
        body_html=body,
        cta_url=tx_url,
        cta_text="View Transaction",
    )


def digest_email(
    username: str,
    new_bounties: list[dict],
    completed_bounties: list[dict],
    bounties_url: str,
) -> str:
    """Weekly digest email template."""
    new_section = ""
    if new_bounties:
        items = "".join(
            f'<li style="margin: 8px 0;"><a href="{b["url"]}" style="color: #F9FAFB; text-decoration: none;">{b["title"]}</a> — <span style="color: #F59E0B;">{b["reward"]}</span></li>'
            for b in new_bounties[:5]
        )
        new_section = f"""
        <h3 style="color: #00D4AA; margin: 0 0 12px;">🔨 New Bounties ({len(new_bounties)})</h3>
        <ul style="padding-left: 20px; margin: 0;">{items}</ul>
        """

    completed_section = ""
    if completed_bounties:
        items = "".join(
            f'<li style="margin: 8px 0;"><span style="color: #F9FAFB;">{b["title"]}</span> — <span style="color: #00D4AA;">Claimed by {b["claimed_by"]}</span></li>'
            for b in completed_bounties[:5]
        )
        completed_section = f"""
        <h3 style="color: #F59E0B; margin: 16px 0 12px;">✅ Completed Bounties ({len(completed_bounties)})</h3>
        <ul style="padding-left: 20px; margin: 0;">{items}</ul>
        """

    body = f"""
      <p>Hey {username},</p>
      <p>Here's your weekly SolFoundry digest:</p>
      {new_section}
      {completed_section}
      <p style="margin-top: 20px;">Keep building. Keep earning. 🎯</p>
    """
    return _base_template(
        title="📊 Weekly Digest",
        body_html=body,
        cta_url=bounties_url,
        cta_text="Browse All Bounties",
    )
