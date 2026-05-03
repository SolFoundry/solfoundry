# TASKS — SolFoundry bounty #823 search bar

Goal: narrow frontend PR for issue #823: add a usable bounties-page search bar without touching backend, wallet, payout, or auth flows.

## In Progress
- [ ] T3. Push PR and log progress.

## Completed
- [x] Branch `feat/bounty-search-bar` created from `upstream/main`.
- [x] T1. Add local bounty search helper and search input to BountyGrid.
      Result: added search input with clear button and local matching across title, description, org/repo, category, tier, token, and skills.
- [x] T2. Add focused tests and run build.
      Verification: `cd frontend && npx vitest run src/__tests__/bounty-search.test.ts` PASS; `cd frontend && npm run build` PASS.
