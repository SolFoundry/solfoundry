# SolFoundry TypeScript SDK

## Overview

This SDK provides comprehensive support for managing bounties, submissions, and user authentication in a TypeScript environment.

## Bounties

- **Create Bounty**: Adds a new bounty to the system.
- **Fetch Bounties**: Retrieves a list of all bounties.
- **Update Bounty**: Modifies an existing bounty.
- **Delete Bounty**: Removes a bounty from the system.

### Example Usage

```javascript
import { createBounty, fetchBounties } from "./api/bounties";

const newBounty = createBounty({
  id: "1",
  title: "Bounty One",
  description: "Description for bounty one",
  value: 100,
  createdDate: new Date(),
});
const bounties = fetchBounties();
```

## Submissions

- **Submit Bounty**: Handles submission of a bounty by a user.
- **Fetch Submissions**: Retrieves submissions for a specific bounty.

### Example Usage

```javascript
import { createSubmission, fetchSubmissions } from "./api/submissions";

const newSubmission = createSubmission({
  id: "1",
  bountyId: "1",
  userId: "user1",
  submissionDate: new Date(),
  status: "pending",
});
const submissionsForBounty = fetchSubmissions("1");
```

## Documentation

Further documentation and examples can be found [here](./README.md).
