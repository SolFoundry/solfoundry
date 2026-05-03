# TASKS — SolFoundry bounty #833 mobile responsive polish

Goal: narrow frontend PR for issue #833: fix obvious small-screen wrapping/overflow risks without touching backend, wallet, payout, or auth flows.

## In Progress
- [ ] T3. Push PR and log progress.

## Completed
- [x] Branch `feat/mobile-responsive-polish` created from `upstream/main`.
- [x] T1. Apply responsive polish to bounty cards, leaderboard table, and bounty publish controls.
      Result: bounty cards wrap skills/reward/meta cleanly; leaderboard table is horizontally scrollable on narrow screens; bounty publish payment/action controls stack on mobile.
- [x] T2. Add focused regression checks and run build.
      Verification: first build attempt failed because upstream shared `lib/animations`/`lib/utils` files were missing on fresh branch; restored them. `cd frontend && npx vitest run src/__tests__/mobile-polish.test.ts` PASS; `cd frontend && npm run build` PASS.
