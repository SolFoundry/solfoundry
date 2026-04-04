import { ActivityFeed } from "./components/ActivityFeed";

export function App() {
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
      <ActivityFeed
        endpoint="http://localhost:4000"
        initialUserId="akira"
      />
    </main>
  );
}
