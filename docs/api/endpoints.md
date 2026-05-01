
# SolFoundry API Endpoints

## Bounties

### GET /bounties
Retrieve a list of all available bounties.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bounty_123",
      "title": "String",
      "description": "String",
      "reward": 1000000000,
      "status": "open|closed|expired",
      "created_at": "ISO 8601 timestamp",
      "updated_at": "ISO 8601 timestamp",
      "author": {
        "address": "Solana address",
        "public_key": "Base58 encoded public key"
      },
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

---

### GET /bounties/{id}
Retrieve details for a specific bounty by its ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "bounty_123",
    "title": "String",
    "description": "String",
    "reward": 1000000000,
    "status": "open|closed|expired",
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp",
    "author": {
      "address": "Solana address",
      "public_key": "Base58 encoded public key"
    },
    "tags": ["tag1", "tag2"],
    "requirements": ["requirement1", "requirement2"],
    "submissions": [
      {
        "id": "submission_456",
        "status": "pending|accepted|rejected",
        "submitted_at": "ISO 8601 timestamp",
        "submitted_by": {
          "address": "Solana address",
          "public_key": "Base58 encoded public key"
        }
      }
    ]
  }
}
```

---

### POST /submissions
Submit a solution for a bounty.

**Request Body:**
```json
{
  "bounty_id": "string",
  "solution": {
    "code": "base64 encoded solution code",
    "description": "string",
    "links": ["url1", "url2"] // Optional
  },
  "metadata": {
    "environment": "string",
    "dependencies": ["dependency1", "dependency2"] // Optional
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "submission_id": "submission_789",
    "bounty_id": "bounty_123",
    "status": "pending",
    "submitted_at": "ISO 8601 timestamp",
    "submitted_by": {
      "address": "Solana address",
      "public_key": "Base58 encoded public key"
    }
  }
}
```

---

