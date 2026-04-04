import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AppealRecord,
  DashboardPayload,
  ResolveAppealInput,
  ReviewRecord,
} from "@shared/types";

const initialDashboard: DashboardPayload = {
  reviews: [],
  appeals: [],
  reviewers: [],
  analytics: {
    totalAppeals: 0,
    openAppeals: 0,
    resolvedAppeals: 0,
    overturnRate: 0,
    averageResolutionHours: 0,
    byOutcome: [],
    byPriority: [],
  },
};

export function App() {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [selectedReviewId, setSelectedReviewId] = useState<string>("");
  const [appealForm, setAppealForm] = useState({
    appellant: "Submission Owner",
    priority: "high",
    reason: "",
  });
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, ResolveAppealInput>>({});
  const [error, setError] = useState<string>("");

  async function loadDashboard() {
    const response = await fetch("/api/dashboard");
    const payload = (await response.json()) as DashboardPayload;
    setDashboard(payload);
    if (!selectedReviewId && payload.reviews[0]) {
      setSelectedReviewId(payload.reviews[0].id);
    }
  }

  useEffect(() => {
    void loadDashboard().catch(() => setError("Failed to load dashboard data."));
  }, []);

  const selectedReview = useMemo(
    () => dashboard.reviews.find((review) => review.id === selectedReviewId) ?? dashboard.reviews[0],
    [dashboard.reviews, selectedReviewId],
  );

  async function submitAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedReview) {
      return;
    }
    const response = await fetch("/api/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: selectedReview.id,
        appellant: appealForm.appellant,
        reason: appealForm.reason,
        priority: appealForm.priority,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setError(payload.message ?? "Appeal creation failed.");
      return;
    }

    setAppealForm((current) => ({ ...current, reason: "" }));
    await loadDashboard();
  }

  async function assignAppeal(appealId: string, reviewerId: string) {
    setError("");
    await fetch(`/api/appeals/${appealId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewerId,
        note: `Assigned to reviewer ${reviewerId} from reviewer dashboard.`,
      }),
    });
    await loadDashboard();
  }

  async function resolveAppeal(appeal: AppealRecord) {
    const draft = resolutionDrafts[appeal.id];
    if (!draft?.summary || !draft.actor || !draft.outcome) {
      setError("Resolution requires actor, outcome, and summary.");
      return;
    }

    setError("");
    await fetch(`/api/appeals/${appeal.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    await loadDashboard();
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SolFoundry Review Ops</p>
          <h1>Multi-LLM Review Dashboard</h1>
          <p className="lede">
            Compare Claude, Codex, and Gemini decisions, expose disagreement hotspots,
            and route disputed submissions through a human appeal workflow.
          </p>
        </div>
        <div className="hero-grid">
          <StatCard label="Tracked Reviews" value={dashboard.reviews.length.toString()} />
          <StatCard label="Open Appeals" value={dashboard.analytics.openAppeals.toString()} />
          <StatCard label="Overturn Rate" value={`${dashboard.analytics.overturnRate}%`} />
          <StatCard
            label="Avg. Resolution"
            value={`${dashboard.analytics.averageResolutionHours}h`}
          />
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="layout-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Submission Queue</h2>
            <span>{dashboard.reviews.length} active records</span>
          </div>
          <div className="review-list">
            {dashboard.reviews.map((review) => (
              <button
                key={review.id}
                className={`review-card ${selectedReview?.id === review.id ? "is-active" : ""}`}
                onClick={() => setSelectedReviewId(review.id)}
              >
                <div className="review-card-top">
                  <div>
                    <strong>{review.submissionTitle}</strong>
                    <p>{review.submitter}</p>
                  </div>
                  <span className={`badge badge-${review.consensus.agreementLevel}`}>
                    {review.consensus.agreementLevel} consensus
                  </span>
                </div>
                <div className="mini-bars">
                  {review.llmReviews.map((llm) => (
                    <div key={llm.model}>
                      <label>{llm.model}</label>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${llm.score}%` }} />
                      </div>
                      <span>{llm.score}</span>
                    </div>
                  ))}
                </div>
                <div className="review-footer">
                  <span>{review.disagreement.headline}</span>
                  {review.currentAppeal ? (
                    <span className="badge badge-outline">{review.currentAppeal.status}</span>
                  ) : (
                    <span className="badge badge-outline">no appeal</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedReview ? (
          <div className="detail-stack">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>{selectedReview.submissionTitle}</h2>
                  <span>
                    {selectedReview.category} · submitted by {selectedReview.submitter}
                  </span>
                </div>
                <ConsensusDial review={selectedReview} />
              </div>

              <div className="score-grid">
                {selectedReview.llmReviews.map((review) => (
                  <article key={review.model} className="score-card">
                    <div className="score-header">
                      <h3>{review.model}</h3>
                      <span>{review.recommendation}</span>
                    </div>
                    <div className="score-value">{review.score}</div>
                    <p>{review.reasoning}</p>
                    <div className="dimension-list">
                      {review.dimensions.map((dimension) => (
                        <div key={dimension.key}>
                          <label>{dimension.label}</label>
                          <div className="bar-track compact">
                            <div className="bar-fill" style={{ width: `${dimension.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <section className="disagreement-panel">
                <div>
                  <p className="eyebrow">Disagreement Analysis</p>
                  <h3>{selectedReview.disagreement.headline}</h3>
                </div>
                <div className={`severity severity-${selectedReview.disagreement.severity}`}>
                  {selectedReview.disagreement.severity} severity
                </div>
                <p>{selectedReview.disagreement.summary}</p>
                <div className="chip-row">
                  {selectedReview.disagreement.hotspots.map((hotspot) => (
                    <span key={hotspot} className="chip">
                      {hotspot}
                    </span>
                  ))}
                </div>
                <p className="resolution-note">{selectedReview.disagreement.suggestedResolution}</p>
              </section>
            </section>

            <section className="panel two-column">
              <div>
                <div className="panel-header">
                  <h2>Model Reasoning</h2>
                  <span>Strengths and concerns</span>
                </div>
                <div className="reasoning-grid">
                  {selectedReview.llmReviews.map((review) => (
                    <article key={review.model} className="reasoning-card">
                      <h3>{review.model}</h3>
                      <p>{review.reasoning}</p>
                      <strong>Strengths</strong>
                      <ul>
                        {review.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <strong>Concerns</strong>
                      <ul>
                        {review.concerns.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <div className="panel-header">
                  <h2>Submit Appeal</h2>
                  <span>Escalate disputed outcomes</span>
                </div>
                <form className="appeal-form" onSubmit={submitAppeal}>
                  <label>
                    Appellant
                    <input
                      value={appealForm.appellant}
                      onChange={(event) =>
                        setAppealForm((current) => ({
                          ...current,
                          appellant: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Priority
                    <select
                      value={appealForm.priority}
                      onChange={(event) =>
                        setAppealForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <textarea
                      rows={6}
                      value={appealForm.reason}
                      placeholder="Explain the disputed score, omitted evidence, or inconsistent reasoning."
                      onChange={(event) =>
                        setAppealForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="primary-button">
                    Submit Appeal
                  </button>
                </form>

                {selectedReview.currentAppeal ? (
                  <div className="appeal-history">
                    <div className="panel-header">
                      <h3>Appeal Timeline</h3>
                      <span>{selectedReview.currentAppeal.status}</span>
                    </div>
                    {selectedReview.currentAppeal.history.map((event) => (
                      <div key={event.id} className="timeline-item">
                        <strong>{event.type}</strong>
                        <p>{event.note}</p>
                        <span>
                          {new Date(event.timestamp).toLocaleString()} · {event.actor}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Human Reviewer Dashboard</h2>
                <span>Assignment and appeal resolution</span>
              </div>
              <div className="reviewer-grid">
                {dashboard.reviewers.map((reviewer) => (
                  <article key={reviewer.id} className="reviewer-card">
                    <h3>{reviewer.name}</h3>
                    <p>{reviewer.specialty}</p>
                    <strong>
                      {reviewer.activeAppeals}/{reviewer.capacity} active
                    </strong>
                  </article>
                ))}
              </div>
              <div className="appeal-table">
                {dashboard.appeals.map((appeal) => (
                  <article key={appeal.id} className="appeal-row">
                    <div>
                      <strong>{appeal.id}</strong>
                      <p>{appeal.reason}</p>
                    </div>
                    <div>
                      <label>Reviewer</label>
                      <select
                        value={appeal.assignedReviewerId ?? ""}
                        onChange={(event) => assignAppeal(appeal.id, event.target.value)}
                        disabled={appeal.status === "resolved"}
                      >
                        <option value="">Select reviewer</option>
                        {dashboard.reviewers.map((reviewer) => (
                          <option key={reviewer.id} value={reviewer.id}>
                            {reviewer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="resolution-controls">
                      <select
                        value={resolutionDrafts[appeal.id]?.outcome ?? "partial"}
                        onChange={(event) =>
                          setResolutionDrafts((current) => ({
                            ...current,
                            [appeal.id]: {
                              outcome: event.target.value as ResolveAppealInput["outcome"],
                              actor: current[appeal.id]?.actor ?? "Human Reviewer",
                              summary: current[appeal.id]?.summary ?? "",
                            },
                          }))
                        }
                        disabled={appeal.status === "resolved"}
                      >
                        <option value="partial">Partial</option>
                        <option value="upheld">Upheld</option>
                        <option value="overturned">Overturned</option>
                      </select>
                      <input
                        value={resolutionDrafts[appeal.id]?.actor ?? "Human Reviewer"}
                        onChange={(event) =>
                          setResolutionDrafts((current) => ({
                            ...current,
                            [appeal.id]: {
                              outcome: current[appeal.id]?.outcome ?? "partial",
                              actor: event.target.value,
                              summary: current[appeal.id]?.summary ?? "",
                            },
                          }))
                        }
                        disabled={appeal.status === "resolved"}
                        placeholder="Reviewer name"
                      />
                      <textarea
                        rows={3}
                        value={resolutionDrafts[appeal.id]?.summary ?? ""}
                        onChange={(event) =>
                          setResolutionDrafts((current) => ({
                            ...current,
                            [appeal.id]: {
                              outcome: current[appeal.id]?.outcome ?? "partial",
                              actor: current[appeal.id]?.actor ?? "Human Reviewer",
                              summary: event.target.value,
                            },
                          }))
                        }
                        disabled={appeal.status === "resolved"}
                        placeholder="Resolution summary and rationale"
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => resolveAppeal(appeal)}
                        disabled={appeal.status === "resolved"}
                      >
                        {appeal.status === "resolved" ? "Resolved" : "Resolve Appeal"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ConsensusDial({ review }: { review: ReviewRecord }) {
  return (
    <div className="consensus-dial">
      <span>Consensus</span>
      <strong>{review.consensus.consensusScore}</strong>
      <p>{review.consensus.primaryRecommendation}</p>
    </div>
  );
}
