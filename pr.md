<!-- What does this PR do? Which bounty issue does it close? -->
<!-- REQUIRED: Include "Closes #N" where N is the bounty issue number -->

Closes #821

## Solana Wallet for Payout
<!-- REQUIRED: Paste your Solana wallet address below to receive $FNDRY bounty -->

`C8rjajopFeKDHqE8KG3RvEit6YPm1YBpUFG7io3x7z6b`

## Type of Change
<!-- Check all that apply -->

- [x] 🐛 Bug fix (non-breaking change which fixes an issue)
- [x] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [x] 📝 Documentation update
- [x] 🎨 Style/UI update
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [x] ✅ Test addition/update

## What this PR does

- **Fixes GitHub OAuth returning 404** when no API was present: `backend/` was gitignored, so `/api/auth/github/authorize` never hit FastAPI. The in-tree **FastAPI backend** is restored and wired for OAuth + JWT.
- **Fixes authorize URL for SPAs**: `GET /api/auth/github/authorize?format=json` returns `{ authorize_url }` so `fetch` does not follow a redirect to GitHub HTML; plain `GET` (e.g. `<a href>`) still **302** redirects to GitHub.
- **Implements end-to-end OAuth**: signed OAuth `state`, code exchange, GitHub user + email resolution, stable SolFoundry user id (`uuid5` from GitHub id), **access + refresh JWTs**, `POST /refresh`, `GET /me`.
- **Frontend**: `apiClient` uses `credentials: 'include'`; **OAuth flash messages** (`lib/oauthFlash.ts`) and a dismissible **`role="alert"`** banner on **HomePage** after callback; restores **`lib/animations.ts`** and **`lib/utils.ts`** for motion + formatting helpers.
- **Repo hygiene**: stop ignoring **`backend/`**; narrow `.gitignore` **`lib/`** → **`/lib/`** so **`frontend/src/lib`** is not excluded.
- **Config**: `.env.example` and `docker-compose.dev.yml` gain `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `CORS_ORIGINS`.

## Checklist
<!-- Go over all the following points, and put an `x` in all the boxes that apply -->

- [x] Code is clean and follows the issue spec exactly
- [x] One PR per bounty (no multiple bounties in one PR)
- [x] Tests included for new functionality
- [ ] All existing tests pass *(run CI / `pytest` in `backend`, `npm test` / `npm run build` in `frontend`)*
- [x] No `console.log` or debugging code left behind
- [x] No hardcoded secrets or API keys

## Testing
<!-- Describe how you tested this change -->

- [x] Manual testing performed  
  - GitHub OAuth App callback: `http://localhost:5173/auth/github/callback` aligned with `OAUTH_REDIRECT_URI`.  
  - `uvicorn` on `:8000`, Vite dev with `/api` proxy; sign-in → GitHub → callback → JWTs + navbar user/avatar.
- [x] Unit tests added/updated  
  - `backend/tests/`: health, authorize redirect vs `format=json`, token exchange (mocked GitHub HTTP), refresh, `/me`, invalid state.
- [ ] Integration tests added/updated *(not added; optional follow-up)*

**Commands**

```bash
cd backend && pip install -r requirements.txt pytest && pytest tests/ -v
cd frontend && npm run build
```

## Screenshots (if applicable)
<!-- Add screenshots to help explain your changes -->

_Add screenshots of: (1) GitHub authorize redirect, (2) home banner after successful sign-in, (3) navbar with GitHub avatar/username._

## Additional Notes

- **GitHub OAuth App** “Authorization callback URL” must **exactly** match `OAUTH_REDIRECT_URI` (scheme, host, port, path).
- Teams that previously used a **private-only** `backend/` mirror should use this tree or adjust their workflow; CI expects `backend/` to exist for Ruff/pytest.
- **Production**: reverse proxy must forward `/api` to the FastAPI service; set `CORS_ORIGINS` to the real SPA origin(s).

---

<!-- CI Pipeline will automatically run:
- Linting (ESLint, Ruff, Clippy)
- Type checking (tsc)
- Unit tests (pytest, vitest)
- Build checks (next build, cargo build)
- Anchor tests (if contracts changed)
-->
