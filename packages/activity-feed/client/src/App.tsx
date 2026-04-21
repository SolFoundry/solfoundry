import { ActivityFeed } from "./components/ActivityFeed";

export function App() {
  const endpoint = import.meta.env.VITE_WS_ENDPOINT || "http://localhost:4000";
  const initialUserId = import.meta.env.VITE_ACTIVITY_USER_ID || "anonymous";

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
      <ActivityFeed endpoint={endpoint} initialUserId={initialUserId} />
    </main>
  );
}
