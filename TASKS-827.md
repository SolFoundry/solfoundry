# TASKS — SolFoundry bounty #827 loading skeletons

Goal: narrow frontend PR for issue #827: reusable shimmer skeletons for main data-loading states.

## In Progress
- [ ] T4. Push PR and log progress.

## Completed
- [x] Branch `feat/loading-skeletons` created from `upstream/main`.
- [x] T1. Add reusable skeleton primitives and page-specific skeletons.
      Result: added shared `Skeleton`, `BountyCardSkeleton`, `LeaderboardSkeleton`, and `ProfileSectionSkeleton` components.
- [x] T2. Replace spinner/plain loading states in bounties, featured bounties, leaderboard, and profile.
      Result: replaced bounty grid/featured cards/leaderboard/profile loading states with layout-matched shimmer skeletons.
- [x] T3. Add focused tests and run build.
      Verification: `cd frontend && npx vitest run src/__tests__/skeleton.test.tsx` PASS; `cd frontend && npm run build` PASS.
