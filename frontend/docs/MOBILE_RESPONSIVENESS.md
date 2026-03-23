# Mobile responsiveness (SolFoundry frontend)

This document supports the **mobile responsiveness audit** bounty: what was implemented in code, how to verify it, and what you still attach in the PR (screenshots).

## Implemented behavior

| Area | Approach |
|------|----------|
| **Base text** | `html` uses `font-size: 16px` and `-webkit-text-size-adjust: 100%` in `src/index.css`. Main shell uses `text-base` where appropriate. |
| **Viewport / notches** | `index.html` viewport includes `viewport-fit=cover`. Header and main use `env(safe-area-inset-*)` so content clears the notch and home indicator. |
| **Navigation** | `SiteLayout` mobile drawer slides from the left with `cubic-bezier(0.32, 0.72, 0, 1)` and `duration-300`; overlay fades in. Nav links use at least **44×44px** tap targets. |
| **Modals** | Shared `Modal` is **edge-to-edge on small viewports** (`h-full`, `rounded-none`, `max-w-none`) and **centered with max-width from `sm` up**. Body scrolls inside the dialog. |
| **Agent marketplace** | Inline detail/hire overlays follow the same full-screen-on-mobile pattern. |
| **Tables** | Leaderboard and Markdown tables sit in **`overflow-x-auto`** wrappers with `touch-pan-x` / `overscroll-x-contain` and a **minimum table width** so narrow screens scroll horizontally instead of breaking layout. |
| **Touch targets** | Header actions, theme toggle, filter chips, footer links/social/copy, and primary CTAs use **`min-h-11` / `min-w-11`** (44px) where they are primary controls. |
| **Forms** | Search and text inputs use **`text-base`** (16px) to reduce iOS Safari zoom-on-focus. |
| **Images** | Raster avatars use `loading="lazy"`, `decoding="async"`, and `sizes`. The logo is a **single SVG** scaled by CSS (no `srcset`; documented in `SolFoundryLogoMark`). |

## Routes to capture for the PR (screenshots)

Use **iPhone SE**, **iPhone 14** (or similar), and **iPad** in devtools or devices, portrait and (where useful) landscape:

- `/bounties`, `/bounties/create`, `/bounties/:id` (any sample id)
- `/leaderboard`
- `/agents`, `/agents/:id`
- `/tokenomics`
- `/how-it-works`
- `/disputes`, `/disputes/:id`
- `/dashboard`, `/creator`
- `/contributor/:username` or `/profile/:username`
- Open **mobile nav**, **wallet / user menu**, **onboarding modal**, and any **in-page modal** (e.g. agent detail on marketplace)

Attach **before/after** pairs per page as required by the bounty.
**Iphone SE**
`/bounties`


## Manual test matrix

| Client | Checks |
|--------|--------|
| **Chrome** (Android or device mode) | No horizontal page scroll; tables scroll; modals fill width on phone. |
| **Safari iOS** | Safe areas; inputs don’t force zoom; drawer animation smooth. |
| **Firefox Android** | Same as Chrome for layout/scroll. |

## Automated tests

- `src/components/common/Modal.test.tsx` — open/close and mobile-first dialog classes.
- Existing layout and page tests should still pass; run `npm test` in `frontend/`.

## Maintenance

When adding a new **full-width table** or **modal**, reuse the same patterns: wrapper with `overflow-x-auto`, or shared `Modal` / full-screen `sm:` centered pattern.
