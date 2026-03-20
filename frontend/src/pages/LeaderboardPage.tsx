/**
 * Route entry point for /leaderboard.
 * Re-exports the composed LeaderboardPage component so the router
 * can lazy-load a single chunk for this route.
 * @module pages/LeaderboardPage
 */
export { LeaderboardPage as default } from '../components/leaderboard';
