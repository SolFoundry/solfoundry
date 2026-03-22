/**
 * Route entry point for /staking — $FNDRY Staking Dashboard.
 *
 * Lazy-loaded page that renders the full staking interface including
 * staked amount display, rewards, tier visualization, history, and
 * stake/unstake modals with wallet transaction signing.
 *
 * @module pages/StakingPage
 */
import { StakingDashboard } from '../components/staking';

/**
 * StakingPage — Top-level route component for the staking interface.
 * Delegates all rendering to StakingDashboard which handles wallet
 * connection state, data fetching, and transaction flows.
 */
export default function StakingPage() {
  return <StakingDashboard />;
}
