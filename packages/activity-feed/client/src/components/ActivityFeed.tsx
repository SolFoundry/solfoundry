import { ChangeEvent } from "react";
import { ACTIVITY_TYPES, ActivityType } from "@solfoundry/activity-shared";
import { useActivityFeed } from "../hooks/useActivityFeed";

interface ActivityFeedProps {
  endpoint: string;
  initialUserId: string;
}

const statusLabel: Record<string, string> = {
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  polling: "Polling fallback",
  disconnected: "Disconnected",
  error: "Error",
};

export function ActivityFeed({ endpoint, initialUserId }: ActivityFeedProps) {
  const {
    activities,
    error,
    lastUpdatedAt,
    retryConnection,
    status,
    subscription,
    updateSubscription,
  } = useActivityFeed({ endpoint, initialUserId });

  const toggleType = (type: ActivityType) => {
    updateSubscription((current) => {
      const exists = current.filter.types.includes(type);
      return {
        ...current,
        filter: {
          ...current.filter,
          types: exists
            ? current.filter.types.filter((value) => value !== type)
            : [...current.filter.types, type],
        },
      };
    });
  };

  const updateCommaSeparated = (
    key: "userIds" | "bountyIds",
    event: ChangeEvent<HTMLInputElement>
  ) => {
    updateSubscription((current) => ({
      ...current,
      filter: {
        ...current.filter,
        [key]: event.target.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    }));
  };

  const toggleMutedType = (type: ActivityType) => {
    updateSubscription((current) => {
      const exists = current.notifications.mutedTypes.includes(type);
      return {
        ...current,
        notifications: {
          ...current.notifications,
          mutedTypes: exists
            ? current.notifications.mutedTypes.filter((value) => value !== type)
            : [...current.notifications.mutedTypes, type],
        },
      };
    });
  };

  return (
    <section className="feed-card">
      <header className="feed-header">
        <div>
          <p className={`status status-${status}`}>{statusLabel[status]}</p>
          <h2>Activity stream</h2>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={retryConnection} type="button">
            Retry live sync
          </button>
          <p className="timestamp">
            {lastUpdatedAt ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : "Waiting for updates"}
          </p>
        </div>
      </header>

      <section className="controls">
        <div className="panel">
          <h3>Notification preferences</h3>
          <label className="switch">
            <input
              checked={subscription.notifications.enabled}
              onChange={(event) =>
                updateSubscription((current) => ({
                  ...current,
                  notifications: {
                    ...current.notifications,
                    enabled: event.target.checked,
                  },
                }))
              }
              type="checkbox"
            />
            Enable in-app notifications
          </label>
          <label className="switch">
            <input
              checked={subscription.notifications.inAppOnly}
              onChange={(event) =>
                updateSubscription((current) => ({
                  ...current,
                  notifications: {
                    ...current.notifications,
                    inAppOnly: event.target.checked,
                  },
                }))
              }
              type="checkbox"
            />
            Keep notifications in app only
          </label>
          <div>
            <p className="subtle-label">Muted activity types</p>
            <div className="chip-grid">
              {ACTIVITY_TYPES.map((type) => {
                const muted = subscription.notifications.mutedTypes.includes(type);
                return (
                  <button
                    className={`chip ${muted ? "" : "chip-active"}`}
                    key={`mute-${type}`}
                    onClick={() => toggleMutedType(type)}
                    type="button"
                  >
                    {muted ? `Unmute ${type.replaceAll("_", " ")}` : `Mute ${type.replaceAll("_", " ")}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Filter stream</h3>
          <div className="chip-grid">
            {ACTIVITY_TYPES.map((type) => {
              const active = subscription.filter.types.includes(type);
              return (
                <button
                  className={`chip ${active ? "chip-active" : ""}`}
                  key={type}
                  onClick={() => toggleType(type)}
                  type="button"
                >
                  {type.replaceAll("_", " ")}
                </button>
              );
            })}
          </div>
          <label>
            User IDs
            <input
              className="text-input"
              onChange={(event) => updateCommaSeparated("userIds", event)}
              placeholder="u-1, u-2"
              type="text"
              value={subscription.filter.userIds.join(", ")}
            />
          </label>
          <label>
            Bounty IDs
            <input
              className="text-input"
              onChange={(event) => updateCommaSeparated("bountyIds", event)}
              placeholder="b-100, b-220"
              type="text"
              value={subscription.filter.bountyIds.join(", ")}
            />
          </label>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <ol aria-atomic="true" aria-live="polite" className="activity-list" role="log">
        {activities.map((activity) => (
          <li className="activity-item" key={activity.id}>
            <div className="activity-meta">
              <span>{activity.type.replaceAll("_", " ")}</span>
              <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString()}</time>
            </div>
            <h3>{activity.metadata.title}</h3>
            <p>{activity.metadata.message}</p>
            <p className="activity-footer">
              <strong>{activity.actor.displayName}</strong> @{activity.actor.handle}
              {activity.metadata.bountyTitle ? ` · ${activity.metadata.bountyTitle}` : ""}
            </p>
          </li>
        ))}
        {!activities.length ? <li className="activity-item empty">No matching activity yet.</li> : null}
      </ol>
    </section>
  );
}
