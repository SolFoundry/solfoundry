# TASKS — SolFoundry bounty #859 analytics dashboard

Goal: deliver a narrow, reviewable first PR for SolFoundry issue #859 without broad backend rewrites.

## In Progress

No pending tasks for issue #859 PR slice.

## Pending

## Completed
- [x] Forked/cloned `SolFoundry/solfoundry` to `Nuval999/solfoundry` and created branch `feat/bounty-analytics-dashboard`.
- [x] T1. Orient frontend data/routes and identify lowest-risk analytics integration.
      Result: frontend is Vite/React with lazy routes in `src/App.tsx`, shared `PageLayout`, existing `useBounties` and `useLeaderboard` hooks, and Recharts already installed.
- [x] T2. Add typed analytics helper using existing bounty/leaderboard data shapes.
      Result: added `src/types/analytics.ts` and `src/api/analytics.ts` to derive metrics, chart points, token totals, and CSV from existing API data.
- [x] T3. Add Analytics dashboard route/page with KPI cards and charts.
      Result: added `/analytics` lazy route, navbar link, KPI cards, and two Recharts bar charts.
- [x] T4. Add CSV export and empty/loading/error states.
      Result: dashboard includes CSV export plus loading, API error, and empty data states. Also restored missing shared frontend `lib/animations` and `lib/utils` modules required by the existing app.
      Verification: `cd frontend && npm run build` PASS.
- [x] T5. Build/test validation and PR submission.
      Result: added focused analytics metrics tests, pushed branch `feat/bounty-analytics-dashboard`, and opened PR.
      Verification: `cd frontend && npx vitest run src/__tests__/analytics-metrics.test.ts` PASS; `cd frontend && npm run build` PASS. Full `npm test` is blocked by existing missing test imports such as `components/bounties/Pagination` unrelated to this slice.
