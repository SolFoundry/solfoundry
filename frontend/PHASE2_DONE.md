# Phase 2: Frontend -- DONE

## Date: 2026-03-30

## Changes Made

### Task 1: Created SendToAddress component
**New file:** `src/components/escrow/SendToAddress.tsx`
- Reusable "send to address + verify signature" component replacing wallet-adapter transaction signing
- Displays treasury wallet address with copy button
- Shows exact amount and token to send
- Optional fee breakdown display (bounty reward, platform fee, total)
- Input field for pasting transaction signature
- "Verify Payment" button calls backend (`/api/escrow/fund` for funding, `/api/bounties/{id}/verify-review-fee` for review fees)
- Status states: Awaiting Payment -> Verifying -> Payment Confirmed / Verification Failed
- Dark theme styling matching existing codebase patterns
- Added to barrel export in `src/components/escrow/index.ts`

### Task 2: Refactored BountyCreationWizard Step 7 (Fund & Publish)
**File:** `src/components/BountyCreationWizard.tsx`
- Removed `useFndryBalance()` import and balance checking from Step 7
- Removed `FundBountyButton` import and direct wallet transaction signing
- Removed `solscanTxUrl` and `useNetwork` imports (no longer needed)
- New flow: Create bounty as draft -> Fetch deposit info from `GET /api/treasury/deposit-info?bounty_id={id}` -> Display SendToAddress component -> On verification, PATCH bounty to "open" status
- Kept wallet connection for auth (useWallet for identity verification)
- Kept confirmation checkbox and bounty summary
- Added `apiClient` import for consistent API calls

### Task 3: Updated SubmissionForm review fee flow
**File:** `src/components/bounties/SubmissionForm.tsx`
- Removed `useReviewFee` hook (old wallet-adapter transaction signing)
- Now fetches review fee info from `GET /api/bounties/{bountyId}/review-fee-deposit`
- Shows SendToAddress component for FNDRY review fee payment on USDC bounties
- For FNDRY bounties (no review fee), skips the payment step entirely
- After SendToAddress verification, enables the submit button with the signature

### Task 4: Removed tokenomics page
- Removed `/tokenomics` route from `src/App.tsx`
- Removed "Tokenomics" nav item from `src/components/layout/Sidebar.tsx`
- Updated `src/pages/DashboardPage.tsx` to navigate to `/bounties` instead of `/tokenomics`
- Kept `src/types/tokenomics.ts` (per instructions)
- Component files left in place as dead code (route removed, not importable)

### Task 5: Updated How It Works page
**File:** `src/components/how-it-works/HowItWorksPage.tsx`
- Changed hero text from "get rewarded in $FNDRY" to "get rewarded in USDC"
- Updated Step 5 "Get Paid" description to reflect USDC payouts for creator bounties and FNDRY for platform bounties
- Added new FAQ item about the review fee: "$FNDRY review fee (10% of bounty value) on USDC bounties"
- Updated "How do payouts work?" FAQ to explain the dual USDC/FNDRY payout model

### Task 6: Fixed default reward amount
**File:** `src/components/BountyCreationWizard.tsx`
- Changed `initialFormData.rewardAmount` from `20` to `50`

### Task 7: Updated footer messaging
**File:** `src/components/layout/Footer.tsx`
- Changed "earn $FNDRY" to "earn USDC rewards and $FNDRY"

### Task 8: Gutted old EscrowDepositModal
**File:** `src/components/escrow/EscrowDepositModal.tsx`
- Replaced with a deprecated stub that renders a notice message
- Removed `useFndryBalance` dependency
- Kept the component name and interface for backward compatibility of any remaining imports

## Files Created
- `src/components/escrow/SendToAddress.tsx` (new component)

## Files Modified
- `src/components/BountyCreationWizard.tsx` (Step 7 refactor, default reward, import cleanup)
- `src/components/bounties/SubmissionForm.tsx` (review fee refactor to SendToAddress)
- `src/components/escrow/EscrowDepositModal.tsx` (gutted, deprecated stub)
- `src/components/escrow/index.ts` (added SendToAddress export)
- `src/components/how-it-works/HowItWorksPage.tsx` (content updates)
- `src/components/layout/Footer.tsx` (messaging update)
- `src/components/layout/Sidebar.tsx` (removed Tokenomics nav item)
- `src/pages/DashboardPage.tsx` (removed tokenomics navigation)
- `src/App.tsx` (removed tokenomics route)

## Not Modified
- Wallet connect in header (WalletConnect component) -- untouched, still works for auth
- Backend files -- no backend changes
- `src/types/tokenomics.ts` -- kept per instructions
- Test files -- not updated (will need updates in QA phase)

## Architecture Notes
- Wallet adapter is now auth-only (sign message to prove identity)
- All funding flows use "send to address + paste signature + verify" pattern
- Backend endpoints consumed: `GET /api/treasury/deposit-info`, `GET /api/bounties/{id}/review-fee-deposit`, `POST /api/escrow/fund`, `POST /api/bounties/{id}/verify-review-fee`
- `apiClient` used consistently for all API calls (auth token, retry, error handling)
