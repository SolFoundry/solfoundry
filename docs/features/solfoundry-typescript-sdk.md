# SolFoundry TypeScript SDK
> Last updated: 2026-04-08
## Overview
The SolFoundry TypeScript SDK provides a structured way to manage bounties, submissions, and user authentication programmatically. It enhances the developer experience by offering type definitions and clear API documentation.
## How It Works
The SDK interacts with the backend API through functions defined in `frontend/src/services/BountyService.ts`, which include methods for creating, fetching, updating, and deleting bounties. Each function wraps the corresponding API call, ensuring type safety and consistency.
## Configuration
No configuration required.
## Usage
Example usage:
```typescript
import { createNewBounty, getAllBounties } from './services/BountyService';

const bounty = { id: '1', title: 'New Bounty', description: 'Description here', value: 100, createdDate: new Date() };
createNewBounty(bounty);
const bounties = await getAllBounties();
```
## References
- Closes issue #863