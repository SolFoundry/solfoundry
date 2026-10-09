const ACTIVITY_USER_ID_KEY = "solfoundry.activityFeed.userId";

export const resolveActivityEndpoint = (): string => {
  if (import.meta.env.VITE_WS_ENDPOINT) {
    return import.meta.env.VITE_WS_ENDPOINT;
  }

  const url = new URL(window.location.origin);
  url.port = import.meta.env.VITE_WS_PORT || "4000";
  return url.origin;
};

export const resolveActivityUserId = (): string => {
  if (import.meta.env.VITE_ACTIVITY_USER_ID) {
    return import.meta.env.VITE_ACTIVITY_USER_ID;
  }

  const existing = window.localStorage.getItem(ACTIVITY_USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const generated = `guest-${randomId}`;
  window.localStorage.setItem(ACTIVITY_USER_ID_KEY, generated);
  return generated;
};
