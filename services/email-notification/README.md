# SolFoundry Email Notification Service

An email notification service for SolFoundry that sends alerts to contributors about bounty events.

## Features

- **Event-driven notifications**: Send emails for bounty_posted, bounty_updated, bounty_completed events
- **User preferences**: Users can subscribe/unsubscribe to specific event types and choose digest frequency
- **Digest emails**: Daily and weekly digest summaries
- **Beautiful HTML templates**: Responsive, branded email templates for all event types
- **Rate limiting**: Configurable rate limits to prevent spam
- **Delivery tracking**: Logs all delivery attempts with status
- **Bounce handling**: Tracks bounces for retry management

## Architecture

```
services/email-notification/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application entry point
│   ├── config.py        # Environment-based configuration
│   ├── models.py        # Pydantic models
│   ├── api.py           # REST API routes
│   ├── email_service.py # Email sending logic
│   └── templates.py     # HTML email templates
├── requirements.txt
├── Dockerfile
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/health` | Health check |
| GET | `/api/notifications/preferences/{user_id}` | Get user preferences |
| PUT | `/api/notifications/preferences/{user_id}` | Create/update preferences |
| DELETE | `/api/notifications/preferences/{user_id}` | Delete preferences (opt-out) |
| POST | `/api/notifications/send` | Send a bounty notification |
| POST | `/api/notifications/send-digest` | Send digest emails |
| GET | `/api/notifications/stats` | Service statistics |
| GET | `/api/notifications/delivery-log` | Recent delivery log |

## Configuration

Configuration is via environment variables with the `EMAIL_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_SMTP_HOST` | `localhost` | SMTP server host |
| `EMAIL_SMTP_PORT` | `587` | SMTP server port |
| `EMAIL_SMTP_USER` | `""` | SMTP username |
| `EMAIL_SMTP_PASSWORD` | `""` | SMTP password |
| `EMAIL_SMTP_USE_TLS` | `true` | Use TLS for SMTP |
| `EMAIL_FROM` | `notifications@solfoundry.org` | From email address |
| `EMAIL_FROM_NAME` | `SolFoundry` | From display name |
| `EMAIL_MAX_EMAILS_PER_MINUTE` | `50` | Rate limit per minute |
| `EMAIL_MAX_EMAILS_PER_HOUR` | `1000` | Rate limit per hour |
| `EMAIL_MAX_BOUNCE_COUNT` | `3` | Max bounces before suppression |

## Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload

# With Docker
docker build -t solfoundry-email-notification .
docker run -p 8100:8100 \
  -e EMAIL_SMTP_HOST=smtp.example.com \
  -e EMAIL_SMTP_USER=user \
  -e EMAIL_SMTP_PASSWORD=pass \
  solfoundry-email-notification
```

## Integration with SolFoundry

The service is designed to be called by the SolFoundry backend when bounty events occur. Integrate by:

1. Adding the service to `docker-compose.yml`
2. Calling `POST /api/notifications/send` from the backend when bounty events happen
3. Setting up a cron job to call `POST /api/notifications/send-digest?frequency=daily` for digest emails