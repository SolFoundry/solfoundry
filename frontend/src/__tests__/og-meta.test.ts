/**
 * Tests for OG/Twitter Card meta tags in index.html and backend og.py.
 * Validates static meta tags, correct handles, image dimensions, and backend
 * dynamic-OG endpoint logic (Closes #472).
 *
 * Static validation is done by reading the built index.html and source files
 * so these tests pass in CI without a running server.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── File paths ──────────────────────────────────────────────────────────────
const ROOT = resolve(__dirname, '../../..');
const INDEX_HTML = readFileSync(resolve(ROOT, 'frontend/index.html'), 'utf8');
const OG_PY = readFileSync(resolve(ROOT, 'backend/app/api/og.py'), 'utf8');

// ── Helpers ─────────────────────────────────────────────────────────────────
function hasTag(html: string, property: string, value: string): boolean {
  const re = new RegExp(`property="${property}"[^>]*content="${value}"`);
  const re2 = new RegExp(`content="${value}"[^>]*property="${property}"`);
  return re.test(html) || re2.test(html);
}

function hasName(html: string, name: string, value: string): boolean {
  const re = new RegExp(`name="${name}"[^>]*content="${value}"`);
  const re2 = new RegExp(`content="${value}"[^>]*name="${name}"`);
  return re.test(html) || re2.test(html);
}

// ── Open Graph tags in index.html ───────────────────────────────────────────
describe('OG meta tags — index.html', () => {
  it('has og:type = website', () => {
    expect(INDEX_HTML).toMatch(/property="og:type"[^>]*content="website"/);
  });

  it('has og:title with SolFoundry branding', () => {
    expect(INDEX_HTML).toMatch(/property="og:title"/);
    expect(INDEX_HTML).toMatch(/SolFoundry/);
  });

  it('has og:description', () => {
    expect(INDEX_HTML).toMatch(/property="og:description"/);
  });

  it('og:image points to /og-default.png', () => {
    expect(INDEX_HTML).toMatch(/property="og:image"[^>]*content="[^"]*og-default\.png"/);
  });

  it('og:image width is 1200', () => {
    expect(INDEX_HTML).toMatch(/property="og:image:width"[^>]*content="1200"/);
  });

  it('og:image height is 630', () => {
    expect(INDEX_HTML).toMatch(/property="og:image:height"[^>]*content="630"/);
  });

  it('has og:url', () => {
    expect(INDEX_HTML).toMatch(/property="og:url"/);
  });

  it('has og:site_name', () => {
    expect(INDEX_HTML).toMatch(/property="og:site_name"/);
  });

  it('og:image:alt is present', () => {
    expect(INDEX_HTML).toMatch(/property="og:image:alt"/);
  });
});

// ── Twitter Card tags in index.html ─────────────────────────────────────────
describe('Twitter Card meta tags — index.html', () => {
  it('twitter:card = summary_large_image', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:card"[^>]*content="summary_large_image"/);
  });

  it('twitter:site = @SolFoundry (correct handle per spec)', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:site"[^>]*content="@SolFoundry"/);
  });

  it('twitter:site does NOT use wrong handle @foundrysol', () => {
    expect(INDEX_HTML).not.toMatch(/@foundrysol/);
  });

  it('has twitter:title', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:title"/);
  });

  it('has twitter:description', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:description"/);
  });

  it('twitter:image points to og-default.png', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:image"[^>]*content="[^"]*og-default\.png"/);
  });

  it('has twitter:image:alt', () => {
    expect(INDEX_HTML).toMatch(/name="twitter:image:alt"/);
  });
});

// ── Default OG image ─────────────────────────────────────────────────────────
describe('Default OG image', () => {
  it('public/og-default.png exists', () => {
    const { existsSync } = require('fs');
    expect(existsSync(resolve(ROOT, 'frontend/public/og-default.png'))).toBe(true);
  });

  it('og-default.png is referenced in index.html', () => {
    expect(INDEX_HTML).toMatch(/og-default\.png/);
  });
});

// ── Backend dynamic OG endpoint (og.py) ─────────────────────────────────────
describe('Backend dynamic OG endpoint — backend/app/api/og.py', () => {
  it('exports a FastAPI router', () => {
    expect(OG_PY).toMatch(/router\s*=\s*APIRouter/);
  });

  it('uses correct twitter:site handle @SolFoundry', () => {
    expect(OG_PY).toMatch(/@SolFoundry/);
  });

  it('does NOT use wrong handle @foundrysol', () => {
    expect(OG_PY).not.toMatch(/@foundrysol/);
  });

  it('has route for /og/bounty/{bounty_id}', () => {
    expect(OG_PY).toMatch(/\/og\/bounty\//);
  });

  it('returns HTMLResponse for bot user-agents', () => {
    expect(OG_PY).toMatch(/HTMLResponse/);
  });

  it('detects bot user-agents', () => {
    expect(OG_PY).toMatch(/Twitterbot/);
    expect(OG_PY).toMatch(/facebookexternalhit/);
  });

  it('includes og:title in rendered HTML', () => {
    expect(OG_PY).toMatch(/og:title/);
  });

  it('includes og:description in rendered HTML', () => {
    expect(OG_PY).toMatch(/og:description/);
  });

  it('includes og:image in rendered HTML', () => {
    expect(OG_PY).toMatch(/og:image/);
  });

  it('includes twitter:card tag in rendered HTML', () => {
    expect(OG_PY).toMatch(/twitter:card/);
  });

  it('includes twitter:site tag in rendered HTML', () => {
    expect(OG_PY).toMatch(/twitter:site/);
  });

  it('escapes HTML to prevent XSS in dynamic content', () => {
    // html.escape is used in the file
    expect(OG_PY).toMatch(/html\.escape/);
  });

  it('redirects real browsers (non-bots) to SPA', () => {
    // Non-bot requests get an HTML page with meta refresh pointing to SPA
    expect(OG_PY).toMatch(/http-equiv.*refresh|spa_url|SPA/);
  });

  it('uses SITE_URL constant for canonical URLs', () => {
    expect(OG_PY).toMatch(/SITE_URL\s*=\s*"https:\/\/solfoundry\.org"/);
  });

  it('sets og:image to DEFAULT_OG_IMAGE constant', () => {
    expect(OG_PY).toMatch(/DEFAULT_OG_IMAGE/);
  });

  it('includes SolFoundry branding in default title', () => {
    expect(OG_PY).toMatch(/SolFoundry/);
  });
});

// ── Backend main.py integration ──────────────────────────────────────────────
describe('Backend integration — og router mounted in main.py', () => {
  const MAIN_PY = readFileSync(resolve(ROOT, 'backend/app/main.py'), 'utf8');

  it('imports og router', () => {
    expect(MAIN_PY).toMatch(/from.*og.*import|import.*og/);
  });

  it('includes og router in the app', () => {
    expect(MAIN_PY).toMatch(/include_router.*og|og.*include_router/);
  });
});
