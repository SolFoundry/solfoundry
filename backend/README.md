# SolFoundry Backend

FastAPI backend for SolFoundry platform.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py          # User model (Issue #11)
│   │   ├── notification.py  # Notification model (Issue #29)
│   │   └── bounty.py        # Bounty model (Issue #30)
│   ├── schemas/             # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── auth.py          # Auth schemas
│   │   ├── notification.py  # Notification schemas
│   │   └── bounty.py        # Bounty schemas
│   ├── api/                 # API routes
│   │   ├── __init__.py
│   │   ├── auth.py          # Auth endpoints (Issue #11)
│   │   ├── notifications.py # Notification endpoints (Issue #29)
│   │   └── bounties.py      # Bounty endpoints (Issue #30)
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── auth.py          # Auth service
│   │   ├── notifications.py # Notification service
│   │   └── search.py        # Search service
│   └── middleware/          # Custom middleware
│       ├── __init__.py
│       └── auth.py          # JWT middleware
├── tests/                   # Test files
│   ├── __init__.py
│   ├── test_auth.py
│   ├── test_notifications.py
│   └── test_bounties.py
├── requirements.txt
├── .env.example
└── README.md
```

## Implemented Features

### Issue #11 - Authentication System ✅
- GitHub OAuth flow
- Solana wallet authentication
- Account linking
- JWT tokens with refresh
- Protected routes

### Issue #29 - Notification System ✅
- In-app notifications with PostgreSQL storage
- Email notifications via Resend API
- **WebSocket real-time push** with Redis pub/sub
- Connection manager for concurrent users
- Mark as read/unread with bulk operations
- Unread count endpoint

### Issue #30 - Search & Filter Engine ✅
- Full-text search (PostgreSQL FTS)
- Multiple filters
- Sorting options
- Pagination
- Autocomplete suggestions
