const MESSAGE_KEY = 'sf_oauth_message';
const KIND_KEY = 'sf_oauth_message_kind';

export type OAuthFlashKind = 'error' | 'success' | 'info';

export function setOAuthFlashMessage(message: string, kind: OAuthFlashKind): void {
  try {
    sessionStorage.setItem(MESSAGE_KEY, message);
    sessionStorage.setItem(KIND_KEY, kind);
  } catch {
    /* ignore */
  }
}

export function consumeOAuthFlash(): { message: string; kind: OAuthFlashKind } | null {
  try {
    const message = sessionStorage.getItem(MESSAGE_KEY);
    const kind = sessionStorage.getItem(KIND_KEY) as OAuthFlashKind | null;
    sessionStorage.removeItem(MESSAGE_KEY);
    sessionStorage.removeItem(KIND_KEY);
    if (!message || !kind) return null;
    if (kind !== 'error' && kind !== 'success' && kind !== 'info') return null;
    return { message, kind };
  } catch {
    return null;
  }
}
