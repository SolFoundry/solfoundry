# TASKS — SolFoundry bounty #838 comments thread

Goal: deliver a narrow first PR for issue #838: bounty detail discussion UI + typed API client, without overbuilding real-time/moderation backend in the first slice.

## In Progress
- [ ] T5. Build validation and PR submission.

## Pending

## Completed
- [x] Branch `feat/bounty-comments-thread` created from `upstream/main`.
- [x] T1. Orient existing bounty detail/API structure and choose minimal integration.
      Result: comments belong on `frontend/src/components/bounty/BountyDetail.tsx`; API calls use shared `apiClient`; React Query is already available.
- [x] T2. Add typed comment API/data model.
      Result: added `src/types/comment.ts`, `src/api/comments.ts`, and `src/hooks/useBountyComments.ts` for list/create flows with polling as a lightweight real-time first slice.
- [x] T3. Add BountyComments UI with nested replies, loading/error/empty states, and sign-in gate.
      Result: added `BountyComments` with root threads, one-level replies, reply form, auth gate, moderation note/status, and API error/loading/empty states.
- [x] T4. Integrate on bounty detail page.
      Result: discussion section appears before solution submission. Restored missing shared frontend `lib/animations` and `lib/utils` modules needed by existing imports.
      Verification: `cd frontend && npm run build` PASS.
