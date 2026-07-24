"""HTML email templates for SolFoundry notifications."""

BOUNTY_POSTED_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
        .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; }
        .bounty-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0; }
        .bounty-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 8px; }
        .bounty-meta { font-size: 13px; color: #64748b; }
        .bounty-meta span { margin-right: 16px; }
        .btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
        .footer a { color: #6366f1; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔥 New Bounty Posted</h1>
            <p>A bounty matching your interests is now available</p>
        </div>
        <div class="body">
            <p>Hi there,</p>
            <p>A new bounty has been posted on SolFoundry that matches your interests:</p>
            <div class="bounty-card">
                <h2 class="bounty-title">{{ bounty_title }}</h2>
                <div class="bounty-meta">
                    <span>💰 Reward: <strong>{{ reward }}</strong></span>
                    <span>🏷️ Tier: <strong>{{ tier }}</strong></span>
                </div>
                <p>{{ bounty_description }}</p>
                <a href="{{ bounty_url }}" class="btn">View Bounty →</a>
            </div>
            <p>Don't wait — bounties are claimed quickly by our contributors!</p>
        </div>
        <div class="footer">
            <p>You're receiving this because you subscribed to SolFoundry notifications.</p>
            <p><a href="{{ preferences_url }}">Manage preferences</a> · <a href="{{ unsubscribe_url }}">Unsubscribe</a></p>
            <p>© 2026 SolFoundry. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

BOUNTY_UPDATED_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #f59e0b, #eab308); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
        .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; }
        .update-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 Bounty Updated</h1>
            <p>{{ bounty_title }}</p>
        </div>
        <div class="body">
            <p>Hi there,</p>
            <p>A bounty you're following has been updated:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0;">
                <span class="update-badge">Updated</span>
                <h2 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 12px 0 8px;">{{ bounty_title }}</h2>
                <p style="color: #64748b; font-size: 14px;">
                    {% if changed_by %}Updated by: <strong>{{ changed_by }}</strong><br>{% endif %}
                    💰 Reward: <strong>{{ reward }}</strong> · 🏷️ Tier: <strong>{{ tier }}</strong>
                </p>
                <a href="{{ bounty_url }}" class="btn">View Changes →</a>
            </div>
        </div>
        <div class="footer">
            <p><a href="{{ preferences_url }}">Manage preferences</a> · <a href="{{ unsubscribe_url }}">Unsubscribe</a></p>
            <p>© 2026 SolFoundry.</p>
        </div>
    </div>
</body>
</html>
"""

BOUNTY_COMPLETED_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; }
        .btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Bounty Completed</h1>
            <p>{{ bounty_title }}</p>
        </div>
        <div class="body">
            <p>Hi there,</p>
            <p>The bounty <strong>{{ bounty_title }}</strong> has been completed and the reward has been paid out!</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
                <p style="font-size: 14px; color: #166534; margin: 0;">Reward Paid</p>
                <p style="font-size: 32px; font-weight: 700; color: #16a34a; margin: 8px 0;">{{ reward }}</p>
            </div>
            <a href="{{ bounty_url }}" class="btn">View Results →</a>
        </div>
        <div class="footer">
            <p><a href="{{ preferences_url }}">Manage preferences</a></p>
        </div>
    </div>
</body>
</html>
"""

DIGEST_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 8px 0 0; opacity: 0.9; }
        .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; }
        .event-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; }
        .event-card h3 { margin: 0 0 4px; font-size: 16px; color: #1e293b; }
        .event-card p { margin: 4px 0; font-size: 13px; color: #64748b; }
        .event-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .badge-new { background: #dbeafe; color: #1d4ed8; }
        .badge-update { background: #fef3c7; color: #92400e; }
        .badge-complete { background: #dcfce7; color: #16a34a; }
        .summary { background: #eef2ff; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .summary h3 { margin: 0 0 8px; color: #4338ca; }
        .summary p { margin: 4px 0; font-size: 14px; color: #1e293b; }
        .btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📬 Your SolFoundry Digest</h1>
            <p>{{ frequency | capitalize }} digest — {{ digest_date }}</p>
        </div>
        <div class="body">
            <div class="summary">
                <h3>📊 Summary</h3>
                <p>🔥 <strong>{{ new_count }}</strong> new bounties posted</p>
                <p>📝 <strong>{{ updated_count }}</strong> bounties updated</p>
                <p>✅ <strong>{{ completed_count }}</strong> bounties completed</p>
            </div>
            {% for event in events %}
            <div class="event-card">
                {% if event.event_type == 'bounty_posted' %}
                <span class="event-badge badge-new">New</span>
                {% elif event.event_type == 'bounty_updated' %}
                <span class="event-badge badge-update">Updated</span>
                {% elif event.event_type == 'bounty_completed' %}
                <span class="event-badge badge-complete">Completed</span>
                {% endif %}
                <h3>{{ event.bounty_title }}</h3>
                <p>💰 {{ event.reward }} · 🏷️ {{ event.tier }}</p>
                <a href="{{ event.bounty_url }}" style="font-size: 13px; color: #6366f1;">View details →</a>
            </div>
            {% endfor %}
            <div style="text-align: center; margin-top: 24px;">
                <a href="https://solfoundry.org/bounties" class="btn">Browse All Bounties →</a>
            </div>
        </div>
        <div class="footer">
            <p><a href="{{ preferences_url }}">Manage preferences</a> · <a href="{{ unsubscribe_url }}">Unsubscribe</a></p>
            <p>© 2026 SolFoundry.</p>
        </div>
    </div>
</body>
</html>
"""

# Template mapping
EMAIL_TEMPLATES = {
    "bounty_posted": {
        "subject": "🔥 New Bounty: {{ bounty_title }}",
        "html": BOUNTY_POSTED_HTML,
    },
    "bounty_updated": {
        "subject": "📝 Updated: {{ bounty_title }}",
        "html": BOUNTY_UPDATED_HTML,
    },
    "bounty_completed": {
        "subject": "✅ Completed: {{ bounty_title }}",
        "html": BOUNTY_COMPLETED_HTML,
    },
    "digest": {
        "subject": "📬 Your SolFoundry {{ frequency }} Digest",
        "html": DIGEST_HTML,
    },
}