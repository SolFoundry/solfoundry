import { ActivityFeed } from "./components/ActivityFeed";
import { resolveActivityEndpoint, resolveActivityUserId } from "./config";

export function App() {
  const endpoint = resolveActivityEndpoint();
  const initialUserId = resolveActivityUserId();
  const authToken = import.meta.env.VITE_WS_AUTH_TOKEN;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">SolFoundry</p>
        <h1>Real-time activity feed</h1>
        <p className="lede">
          Track bounty posts, submissions, review outcomes, and leaderboard movement with live delivery,
          resilient reconnection, and an HTTP polling fallback.
        </p>
      </section>
      <ActivityFeed authToken={authToken} endpoint={endpoint} initialUserId={initialUserId} />
    </main>
  );
}
