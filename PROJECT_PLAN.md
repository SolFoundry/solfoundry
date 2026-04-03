# SolFoundry Tokenomics Refactor -- Project Plan
## Date: 2026-03-30

## Overview
Refactor SolFoundry from wallet-adapter transaction signing to custodial "send to address + verify signature" model. Keep wallet connect for identity/auth only. Fix all broken pages. Update content to reflect USDC bounty model.

## Architecture Decision
- Wallet Connect: KEEP for identity (sign message to prove wallet ownership)
- Transaction Signing: REMOVE from wallet adapter
- Funding Flow: "Send X USDC to [treasury address]" -> user pastes tx signature -> backend verifies on-chain
- Review Fees: Same pattern -- "Send X FNDRY to [treasury address]" -> paste signature -> verify
- Treasury: Direct to AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1 (no intermediary addresses)

## Bounty Types
- Creator bounties (via website): USDC-funded, 5% platform fee, 10% FNDRY review fee for submissions
- Platform/community bounties (via GitHub issues): FNDRY-funded, free to review
- This dual model lets contributors earn FNDRY without buying it

## Confirmed Settings
- Treasury wallet: AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1 (has 1.25M FNDRY)
- Creator fee: 5% of USDC bounty, paid in USDC at creation (FEE_BASIS_POINTS=500) -- CORRECT
- Review fee: 10% of USDC bounty value, paid in FNDRY at submission (REVIEW_FEE_BPS=1000) -- NEEDS FIX on prod (currently 500)
- Add TREASURY_WALLET explicitly to prod .env

## Key Fixes Needed
1. Treasury wallet mismatch: solana_indexer.py has different default (57uMi...) than everywhere else (AqqW7...)
2. REVIEW_FEE_BPS on prod: change from 500 to 1000 (10% is the correct rate)
3. Add TREASURY_WALLET=AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1 to prod .env

---

## Phase 1: Backend (backend-engineer agent)
### Files to modify:
- app/services/solana_indexer.py -- Fix treasury wallet default to match AqqW7...
- app/api/escrow.py -- Add GET /escrow/treasury-info endpoint (returns treasury wallet address for UI display)
- app/api/bounties.py -- Ensure POST /bounties accepts funding_token field properly
- .env.example -- Add all 9 missing env vars with documentation
- Clean up: add TREASURY_WALLET to prod .env explicitly

### New endpoint needed:
GET /api/treasury/deposit-info
Returns: { wallet_address, token (USDC or FNDRY), amount_required, fee_breakdown }
This powers the "send to this address" UI component.

### Verify:
- fund_escrow_from_signature() works correctly for both USDC and FNDRY
- review_fee verification handles paste-signature flow
- Treasury address is consistent across ALL files

---

## Phase 2: Frontend (frontend-engineer agent)
### Major changes:
1. Strip wallet adapter transaction signing:
   - Remove useFndryBalance hook usage from BountyCreationWizard funding step
   - Remove EscrowDepositModal (replace with new SendToAddress component)
   - Remove FundBountyButton transaction signing
   - Keep wallet connect ONLY for auth (sign message)

2. New "Send to Address" funding component:
   - Shows treasury wallet address with copy button (no QR)
   - Shows exact amount + fee breakdown
   - Input field for transaction signature
   - "Verify Payment" button -> calls backend to verify on-chain
   - Status indicator: Pending -> Verifying -> Confirmed / Failed

3. BountyCreationWizard Step 7 refactor:
   - Remove balance check entirely (user sends from any wallet)
   - Replace with: Create bounty (draft) -> Show treasury address + amount -> Paste signature -> Verify -> Activate
   - Wallet only needed for auth, not for balance checking

4. SubmissionForm review fee:
   - Same "send to address" pattern for FNDRY review fee
   - Show: "Send [X] FNDRY to [address] to submit your work"
   - Paste signature -> verify -> allow submission

5. Remove tokenomics page entirely:
   - Delete route and component
   - Remove from nav

6. Update How It Works page:
   - Change "$FNDRY rewards" to "USDC rewards"
   - Update Step 5 "Get Paid" to reflect USDC payouts
   - Add note about FNDRY review fees and platform bounties

7. Fix wallet connection state:
   - Wallet connect via header should persist across page navigation
   - Onboarding flow wallet connect should sync with header state
   - Wallet is for identity only -- no transaction signing

8. Clean existing bounty data:
   - Delete the cancelled "Create a Bounty Agent for $FNDRY" test bounty

9. Default reward amount:
   - Change default from 100000 to 50 USDC

10. Footer update:
    - Update "earn $FNDRY" messaging

---

## Phase 3: Code Review (code-reviewer agent)
- Cross-file consistency check
- Verify no remaining FNDRY balance checks in funding paths
- Verify all treasury address references are consistent
- Security review of the signature verification flow

## Phase 4: QA Testing (qa-tester agent)
- Test full bounty creation flow end-to-end
- Test review fee submission flow
- Test wallet auth (sign message, profile creation)
- Verify tokenomics page is removed
- Verify How It Works content is updated
- Test with both Phantom and Solflare

## Phase 5: Deploy
- Build frontend: npm run build
- SCP frontend build to /var/www/solfoundry on 192.241.139.206
- Update backend on /opt/solfoundry/backend
- Restart solfoundry-api service
- Verify live site
- Run one test bounty creation with ~$20 USDC

---

## Agent Assignments
| Phase | Agent | Priority |
|-------|-------|----------|
| 1 | backend-engineer | P0 |
| 2 | frontend-engineer | P0 (after phase 1) |
| 3 | code-reviewer | P1 (after phase 2) |
| 4 | qa-tester | P1 (after phase 3) |
| 5 | controller (manual) | P0 (after phase 4) |

## All Questions Resolved
1. Treasury wallet confirmed: AqqW7... with 1.25M FNDRY ✅
2. Review fee: 10% is correct, prod .env needs update from 500 to 1000 ✅
3. Add TREASURY_WALLET to prod .env explicitly ✅
4. Bounty types: Creator (USDC) via website, Platform (FNDRY) via GitHub ✅
5. No QR codes, just copy button ✅
6. Review fee: same send-to-address pattern ✅
7. Leaderboard: leave as-is for now, add USDC column later ✅
8. Tokenomics page: remove entirely ✅
9. How It Works: update to reflect USDC rewards ✅
10. Deploy after build + test to 192.241.139.206 ✅

## Execution Strategy
Sequential: Backend fixes first (Phase 1) -> Frontend refactor (Phase 2) -> Review -> QA -> Deploy
Reason: Frontend depends on the new treasury-info endpoint from backend.
