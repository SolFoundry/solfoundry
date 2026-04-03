# Code Review: Tokenomics Refactor (Phase 1 + Phase 2)

**Reviewer:** code-reviewer agent
**Date:** 2026-03-30
**Verdict:** FAIL -- 3 critical issues must be resolved before deploy

---

## Critical Issues

### C1. Missing backend endpoint: `POST /api/bounties/{bountyId}/verify-review-fee`

**Files:**
- `frontend/src/components/escrow/SendToAddress.tsx` line 97
- `backend/app/api/bounties.py` (all routes searched -- endpoint does not exist)

The `SendToAddress` component calls `POST /api/bounties/${bountyId}/verify-review-fee` when `type === 'review-fee'`, but this endpoint does not exist anywhere in the backend. The backend's review fee verification is embedded inline in the `POST /{bounty_id}/submissions` handler (bounties.py lines 490-526), not exposed as a separate endpoint.

The frontend flow expects: pay review fee -> verify via dedicated endpoint -> then submit PR. The backend flow expects: submit PR with `review_fee_signature` field included in the submission body, and it verifies inline.

**Impact:** The review fee verification flow is completely broken. Users will get a 404 when clicking "Verify Payment" in the SubmissionForm.

**Fix:** Either (a) create a new `POST /api/bounties/{bounty_id}/verify-review-fee` endpoint that accepts `{ signature: str }` and verifies the FNDRY payment on-chain, returning success/failure, or (b) change the frontend to skip the separate verify call and pass the signature directly into the submission payload instead.

---

### C2. Frontend/backend response shape mismatch on `GET /api/treasury/deposit-info`

**Files:**
- `frontend/src/components/BountyCreationWizard.tsx` lines 792-802 (`DepositInfo` interface)
- `backend/app/api/treasury.py` lines 45-52 (`DepositInfoResponse` model)

The frontend `DepositInfo` interface expects:
- `wallet_address` -- backend returns `treasury_wallet`
- `total_amount` -- backend returns `amount_required`

The frontend reads `depositInfo.wallet_address` (line 987) and `depositInfo.total_amount` (line 989), which will both be `undefined` since the backend sends `treasury_wallet` and `amount_required`.

**Impact:** The SendToAddress component in the bounty creation wizard will display `undefined` for the treasury wallet and 0/NaN for the amount.

**Fix:** Align the field names. Either update the frontend interface to match the backend (`treasury_wallet`, `amount_required`), or update the backend response model to use the names the frontend expects.

---

### C3. Frontend/backend response shape mismatch on `GET /api/bounties/{bountyId}/review-fee-deposit`

**Files:**
- `frontend/src/components/bounties/SubmissionForm.tsx` lines 16-23 (`ReviewFeeDepositInfo` interface)
- `backend/app/api/treasury.py` lines 55-63 (`ReviewFeeDepositResponse` model)

The frontend expects fields that do not exist in the backend response:
- `wallet_address` -- backend returns `treasury_wallet`
- `required` (boolean) -- backend does NOT include this field
- `bounty_reward_usdc` -- backend does NOT include this field

The frontend reads `info.required` (line 57) to decide whether to show the fee UI, `feeDepositInfo.wallet_address` (line 155) to pass to SendToAddress, and `feeDepositInfo.bounty_reward_usdc` (line 149) in the fee explanation text.

**Impact:** The SubmissionForm will never correctly determine if a review fee is required (the `required` field will be `undefined`, so `!info.required` is truthy -- it will always skip the fee for USDC bounties). The wallet address will be `undefined`.

**Fix:** Either add `required: bool` and `bounty_reward_usdc: float` fields to `ReviewFeeDepositResponse` in the backend, or update the frontend to infer `required` from `fndry_amount > 0` and use `treasury_wallet` instead of `wallet_address`.

---

## Medium Issues

### M1. `SendToAddress` does not send `token` field in escrow fund request

**Files:**
- `frontend/src/components/escrow/SendToAddress.tsx` line 89-92
- `backend/app/models/escrow.py` lines 168-172

The funding flow sends `{ bounty_id, signature, amount }` but the `EscrowFundRequest` model defaults `token` to `"FNDRY"`. Since creator bounties are USDC-funded, the escrow will be recorded as FNDRY instead of USDC.

**Fix:** Include `token` in the POST body: `{ bounty_id: bountyId, signature: trimmed, amount, token }`. The `token` prop is already available on the SendToAddress component.

---

### M2. Review fee replay prevention uses in-memory set

**File:** `backend/app/services/review_fee_service.py` lines 123, 147

`_used_review_fee_signatures` is a Python `set()` in process memory. On server restart (deploy, crash, or multi-worker setup), all tracked signatures are lost. A previously-used signature could be replayed.

The escrow funding path has proper DB-level duplicate checking (via `fund_tx_hash` unique constraint). The review fee path does not.

**Fix:** Store used review fee signatures in PostgreSQL (or at minimum Redis) with a unique constraint, similar to how `fund_tx_hash` works for escrow funding.

---

### M3. `stepTitles` array has 8 entries for 7 steps

**File:** `frontend/src/components/BountyCreationWizard.tsx` lines 1031-1040

`totalSteps` is set to 7, but `stepTitles` has 8 entries (including both "Preview" and "Fund & Publish"). This is a minor off-by-one that could cause UI inconsistencies in step indicators.

**Fix:** Either set `totalSteps = 8` or remove one title entry. Verify the step navigation logic matches.

---

### M4. FAQ tier rewards still reference FNDRY amounts

**File:** `frontend/src/components/how-it-works/HowItWorksPage.tsx` lines 121-123

The "What are the bounty tiers?" FAQ answer still says "Tier 1 offers 50,000-150,000 $FNDRY", "Tier 2 offers 150,000-500,000 $FNDRY", etc. Since creator bounties are now USDC-funded, these FNDRY amounts are misleading. The amounts may refer to platform bounties only, but that distinction is not made in the text.

**Fix:** Update the tier FAQ to reflect USDC amounts for creator bounties and clarify that FNDRY amounts apply only to platform bounties, or remove specific amounts since they vary.

---

## Low Issues

### L1. No input validation on signature field in SendToAddress

**File:** `frontend/src/components/escrow/SendToAddress.tsx` lines 78-83

The frontend only checks that the signature is non-empty after trimming. It does not validate that the input looks like a valid Solana transaction signature (base-58, 64-88 chars). The backend does validate (via `EscrowFundRequest.validate_signature`), but an early frontend check would provide better UX and avoid unnecessary API calls.

**Fix:** Add a regex check for base-58 characters and length validation before calling the API.

---

### L2. Deprecated EscrowDepositModal still renders a visible modal

**File:** `frontend/src/components/escrow/EscrowDepositModal.tsx` lines 26-34

The deprecated stub still renders a visible modal dialog with a deprecation notice when `isOpen` is true. This could confuse users if any code path still opens it. It should either render nothing (`return null`) unconditionally, or the `onClose`/`onConfirm` props should be wired to the close button.

**Fix:** Either always return `null` regardless of `isOpen`, or add a close button that calls `onClose`.

---

### L3. `BountyCreationWizard` hardcodes 5% fee calculation

**File:** `frontend/src/components/BountyCreationWizard.tsx` lines 920-926

The Step 7 summary calculates `formData.rewardAmount * 0.05` and `formData.rewardAmount * 1.05` inline, hardcoding 5%. The backend uses `FEE_BASIS_POINTS` which is configurable. If the fee changes on the backend, the frontend summary will be wrong (though the actual deposit info fetched from the backend will be correct).

**Fix:** Use the fee breakdown from `depositInfo` once available instead of hardcoding.

---

### L4. `HowItWorksPage` FAQ accordion uses array index as key

**File:** `frontend/src/components/how-it-works/HowItWorksPage.tsx` line 350

`key={index}` for FAQ items. Since the list is static this has no functional impact, but it would cause issues if items were ever reordered dynamically.

---

### L5. `apiClient` params passing convention

**File:** `frontend/src/components/BountyCreationWizard.tsx` line 830-832

The call `apiClient('/api/treasury/deposit-info', { params: { bounty_id: id } })` passes query params via a `params` object. Verify that `apiClient` actually supports this convention (converting `params` to URL query parameters). If `apiClient` is a thin `fetch` wrapper, `params` may be silently ignored, and the bounty_id would never reach the backend.

**Fix:** Verify apiClient supports `params` or manually construct the URL: `/api/treasury/deposit-info?bounty_id=${id}`.

---

## What Passes

- **Treasury wallet consistency:** All files now correctly reference `AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1` (solana_indexer.py, treasury.py, .env.example, solana_client.py).
- **`useFndryBalance` removed from funding path:** No remaining calls in BountyCreationWizard or SubmissionForm. Only remains in staking (out of scope) and old FundBountyFlow (unreachable from new flow).
- **`review_fee_verified` bug fix:** The bounty_service.py correctly takes an explicit `review_fee_verified: bool = False` parameter, and the API route passes `True` only after successful on-chain verification.
- **Escrow funding replay prevention:** Proper DB unique constraint on `fund_tx_hash` in escrow_service.py.
- **Signature validation on funding path:** `EscrowFundRequest` has Pydantic field validators for base-58 format and length.
- **Tokenomics route removed:** Clean removal from App.tsx, Sidebar.tsx, DashboardPage.tsx.
- **Content updates:** Footer, How It Works hero, Step 5, and FAQ items correctly updated for USDC messaging.
- **SendToAddress component:** Well-structured with proper TypeScript types, status states, error handling, copy fallback, and accessible UI.
- **Treasury router registration:** Correctly added in main.py with `/api` prefix.
- **.env.example:** All new variables documented with sensible defaults.

---

## Summary

| Severity | Count | Blocking? |
|----------|-------|-----------|
| Critical | 3 | Yes |
| Medium | 4 | No (but should fix before prod) |
| Low | 5 | No |

The three critical issues (C1, C2, C3) are all frontend/backend contract mismatches that will cause runtime failures. C1 means the review fee flow is completely non-functional. C2 and C3 mean the deposit info displays will show `undefined` values. These must be fixed before any deploy or QA testing.
