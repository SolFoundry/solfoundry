
# Bounty Lifecycle Documentation

This document explains the lifecycle of a bounty in SolFoundry, detailing the states a bounty goes through from creation to completion.

## Bounty States

### 1. Open
- **Description**: The bounty is active and available for claiming.
- **Status**: Any user can claim this bounty.
- **Actions**:
  - Users can submit claims for this bounty
  - Bounty details are visible to the community

### 2. Claimed
- **Description**: A user has claimed this bounty.
- **Status**: The bounty is no longer available for others to claim.
- **Actions**:
  - The claimant can submit their work for review
  - The bounty creator can review the submitted work

### 3. In Review
- **Description**: The bounty creator is reviewing the submitted work.
- **Status**: The bounty is temporarily inactive while under review.
- **Actions**:
  - The bounty creator can approve or reject the submission
  - The claimant can check the review status

### 4. Merged
- **Description**: The submitted work has been approved and merged into the project.
- **Status**: The bounty is considered complete.
- **Actions**:
  - The bounty creator can initiate payment
  - The claimant can track payment status

### 5. Paid
- **Description**: The bounty creator has completed the payment to the claimant.
- **Status**: The bounty lifecycle is complete.
- **Actions**:
  - The bounty is marked as fully resolved
  - Both parties can view the complete history

## Transition Flow

The bounty lifecycle follows this progression:

```
Open → Claimed → In Review → Merged → Paid
```

## Summary

This lifecycle ensures a structured process for bounty management, from initial creation through to final payment, with clear states for all participants to track progress and responsibilities.

**Completed lifecycle docs for [SolFoundry/solfoundry]**

