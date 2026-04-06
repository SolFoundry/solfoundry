# SolFoundry Brand Guide

> **Version:** 1.0 | **Status:** Active | **Owner:** SolFoundry
>
> This guide defines the SolFoundry brand identity for internal teams, contributors, and partners.
> For design assets (logos, templates), see the companion [`/content/social-media-templates/`](https://github.com/SolFoundry/solfoundry/tree/main/content/social-media-templates) directory.

---

## Table of Contents

1. [Brand Essence](#1-brand-essence)
2. [Logo](#2-logo)
3. [Color Palette](#3-color-palette)
4. [Typography](#4-typography)
5. [Iconography](#5-iconography)
6. [Tone of Voice](#6-tone-of-voice)
7. [Design Principles](#7-design-principles)
8. [Imagery & Photography](#8-imagery--photography)
9. [Tier System](#9-tier-system)
10. [Do's & Don'ts](#10-dos--donts)

---

## 1. Brand Essence

### Brand Promise
SolFoundry is where Solana developers earn, learn, and build the open web. We are the forge where ideas become working code, and code becomes value.

### Mission
Democratize software development by connecting skilled builders with funded opportunities — no gatekeepers, no friction.

### Values
| Value | Meaning |
|-------|---------|
| **Open** | Public by default; all processes visible on-chain |
| **Fast** | Like Solana — instant, cheap, scalable |
| **Trust** | Escrow-protected payments, transparent reviews |
| **Craft** | Quality code, quality interactions |

### Brand Personality
- **Confident, not arrogant** — we know what we're building
- **Direct, not blunt** — clear communication without noise
- **Technical, not cold** — we speak builder, but we don't exclude newcomers
- **Ambitious, not hype** — we ship real things, not promises

---

## 2. Logo

### Wordmark
The **SOLFOUNDRY** wordmark is the primary logo. Use it in full at every reasonable opportunity.

**Primary variant:** White wordmark on dark backgrounds (`forge-900` or darker)
**Secondary variant:** Emerald (`#00E676`) wordmark on light/white backgrounds

### Symbol Mark (Forge Icon ⚒)
The forge anvil/hammer symbol is used in contexts where the full wordmark won't fit:
- Favicons, app icons
- Social media avatars (when used alone)
- Inline iconography (max 32×32px)
- Footer credits

### Clearspace
Minimum clearspace around the logo = **height of the "S"** on all sides. No other elements (text, imagery, borders) may intrude into this zone.

### Logo Don'ts
- ❌ Do not stretch, skew, or rotate the logo
- ❌ Do not change the wordmark font
- ❌ Do not apply a drop shadow to the logo
- ❌ Do not place the logo on a busy photographic background without a clear zone
- ❌ Do not use the logo in a sentence or as body text
- ❌ Do not recreate the logo from scratch — always use the official asset

### Usage Examples
| Context | Recommended Variant |
|---------|-------------------|
| Dark website header | White wordmark |
| White/dark card backgrounds | Emerald wordmark or white |
| Social media banner | White wordmark + tagline |
| Print / PDF report | White or black wordmark |
| Monochrome use (fax, B&W print) | Black wordmark |

---

## 3. Color Palette

### Primary Brand Colors

#### Emerald — Signature Color
The cornerstone of SolFoundry's identity. Use for primary CTAs, active states, positive indicators, and key highlights.

```
#00E676  — Emerald (DEFAULT / Primary)
#69F0AE  — Emerald Light (hover states, gradients)
```

#### Purple — Secondary / Depth
Used for secondary accents, category labels, and gradient blends.

```
#7C3AED  — Purple (DEFAULT)
#A78BFA  — Purple Light
```

#### Magenta — Highlight / Energy
Used sparingly for callouts, special events, or energy moments.

```
#E040FB  — Magenta (DEFAULT)
#EA80FC  — Magenta Light
```

### Neutrals — Forge Scale
All UI backgrounds, cards, borders, and surfaces use the Forge scale.

| Token | Hex | Usage |
|-------|-----|-------|
| `forge-950` | `#050505` | Deepest background (app root) |
| `forge-900` | `#0A0A0F` | Primary background |
| `forge-850` | `#0F0F18` | Card/surface background |
| `forge-800` | `#16161F` | Elevated surfaces |
| `forge-700` | `#1E1E2A` | Borders, dividers |
| `forge-600` | `#2A2A3A` | Muted backgrounds |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#F0F0F5` | Headlines, primary content |
| `text-secondary` | `#A0A0B8` | Body text, descriptions |
| `text-muted` | `#5C5C78` | Captions, placeholders, timestamps |

### Border / Dividers

| Token | Hex | Usage |
|-------|-----|-------|
| `border` | `#1E1E2E` | Default borders |
| `border-hover` | `#2E2E42` | Hover state borders |
| `border-active` | `#3E3E56` | Active/focus borders |

### Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `status-success` | `#00E676` | Completed, paid, active |
| `status-warning` | `#FFB300` | Pending, review, attention |
| `status-error` | `#FF5252` | Failed, rejected, error |
| `status-info` | `#40C4FF` | Informational, neutral notices |

### Tier Colors

| Tier | Hex | Usage |
|------|-----|-------|
| T1 | `#00E676` | Open race, entry-level bounties |
| T2 | `#40C4FF` | Intermediate complexity |
| T3 | `#7C3AED` | Advanced, high-value bounties |

### Gradient Presets

```css
/* Navbar / Footer gradient */
background: linear-gradient(90deg, #00E676, #7C3AED, #E040FB);

/* Hero background */
background: radial-gradient(ellipse at 50% 0%,
  rgba(124,58,237,0.15) 0%,
  rgba(224,64,251,0.08) 40%,
  transparent 70%);

/* Grid overlay */
background-image:
  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
background-size: 40px 40px;
```

### Color Accessibility
- All text/background combinations meet **WCAG AA** contrast ratio (4.5:1 for body text)
- Emerald `#00E676` on `forge-900` `#0A0A0F` → ratio ≈ 10.5:1 ✅
- `text-primary` `#F0F0F5` on `forge-850` `#0F0F18` → ratio ≈ 14:1 ✅
- Avoid using `text-muted` for body text longer than 2 lines

---

## 4. Typography

### Type Scale

| Role | Font | Size | Weight | Line Height |
|------|------|------|--------|-------------|
| Display / Hero | Orbitron | 48–72px | 700–900 | 1.1 |
| H1 / Page Title | Orbitron | 32–40px | 700 | 1.2 |
| H2 / Section | Inter | 24–28px | 600 | 1.3 |
| H3 / Subsection | Inter | 18–20px | 600 | 1.4 |
| Body | Inter | 15–16px | 400 | 1.6 |
| Small / Caption | Inter | 13–14px | 400 | 1.5 |
| Mono / Code | JetBrains Mono | 13–15px | 400–500 | 1.6 |
| Label / Badge | Inter | 11–13px | 600–700 | 1.0 |

### Font Families

```css
font-display: 'Orbitron', sans-serif;   /* Logo, display headings only */
font-sans:    'Inter', system-ui, sans-serif;  /* All body copy */
font-mono:    'JetBrains Mono', 'Fira Code', monospace;  /* Code, addresses, hashes */
```

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
```

### Type Rules

1. **Orbitron** is reserved for display use only — never use it for body text
2. **Inter** is the default body font — readable at 15–16px minimum
3. **JetBrains Mono** for wallet addresses, commit hashes, transaction IDs
4. Avoid custom font stacks on user-generated content (stick to `system-ui` fallback)
5. Letter-spacing: uppercase labels may use `letter-spacing: 2px` for a technical feel

---

## 5. Iconography

### Primary Icon Library
**Lucide React** — consistent 24px stroke icons throughout the product.

Key icons used across the product:
- `⚒` / Anvil emoji for the forge brand (informal contexts only)
- `Search`, `Filter`, `SortAsc` for bounty listing
- `Clock`, `Timer` for deadlines
- `GitPullRequest`, `GitMerge` for PR lifecycle
- `Coins`, `DollarSign` for payouts
- `CheckCircle`, `XCircle` for completion states
- `Shield`, `Lock` for security / escrow

### Icon Usage Rules
- Size: **20px** default, **16px** compact, **24px** feature
- Stroke weight: **1.5px** standard, **2px** emphasis
- Color: inherits `currentColor` — use `text-emerald` for active, `text-muted` for inactive
- Never mix icon styles (e.g., don't combine outlined and filled in the same component)

---

## 6. Tone of Voice

### How We Speak

| Situation | Do | Don't |
|-----------|---|-------|
| Onboarding a new builder | "Start earning now" | "Get started today!" |
| Announcing a payout | "Bounty paid — $500 released" | "Exciting news! We just paid out..." |
| Describing a bounty | "Build X that does Y" | "Revolutionary solution to Y using cutting-edge X" |
| Error state | "Payment failed. Try again." | "Oops! Something went wrong :((" |
| Announcing a new feature | "New: Bounty analytics dashboard" | "Introducing our amazing new dashboard feature!" |

### Voice Attributes

**Clear** — Say what you mean. Technical terms are fine (we're talking to builders), but explain when necessary.

**Direct** — Short sentences. Active voice. No corporate softening ("please note that...").

**Confident** — "The best bounties on Solana." Not "We think we might have some of the best bounties." Don't use "hopefully" or "try to."

**Human** — We use some humor, especially on social. We're not a bank. But we don't force it.

### Boilerplate Copy

> **One-liner:** SolFoundry is where Solana builders earn, learn, and ship — funded bounties, no gatekeepers.
>
> **Short description:** A bounty platform on Solana connecting skilled developers with funded projects. Payments are escrowed and instant.
>
> **Full description:** SolFoundry is a decentralized bounty marketplace built on Solana. Developers discover, claim, and complete bounties — from bug fixes to full features — with payments protected by smart contract escrow. No middlemen, no complicated payment negotiations.

---

## 7. Design Principles

### 1. Forge Aesthetic
Dark-first. Every surface lives in the forge scale. Use emerald as the signature accent — sparingly, with intention.

### 2. Depth Through Subtlety
Don't rely on flat colors alone. Use glow effects (`emerald glow: rgba(0,230,118,0.15)`), gradient overlays, and subtle grid patterns to create depth without noise.

### 3. Signal Over Decoration
Every visual element should communicate something. If it doesn't, remove it. Avoid decorative borders, ornamental icons, or "flavor" graphics that don't add information.

### 4. Motion With Purpose
Animations should communicate state changes (loading, success, transition) — not just entertain. Use `ease-out` for entrances, `ease-in` for exits. Keep duration under 300ms for UI transitions.

### 5. Responsive First
The platform must work on mobile wallets, tablets, and desktop. Mobile is not an afterthought. If it doesn't work on mobile, it doesn't work.

### 6. Trust Through Clarity
Escrow status, payment status, review status — always visible, always clear. Use status colors consistently (green = good, amber = pending, red = problem).

---

## 8. Imagery & Photography

### Style
- **Dark, moody, technical** — server rooms, code editors, terminal windows, circuit boards
- **Real people, technical settings** — avoid generic stock photos of "happy businesspeople shaking hands"
- **Solana-adjacent** — purple/or teal color grading, blockchain visuals, network diagrams
- **Avoid**: bright white backgrounds, clip art, dated tech imagery

### User-Generated Content
- Show real code, real PRs, real avatars from the platform
- Use placeholder avatars that match the brand aesthetic (gradient circles with initials)

### Badges & Achievement Icons
- Minimalist, flat, monochrome with brand color tint
- Max 48×48px
- No drop shadows, no 3D effects

---

## 9. Tier System

Every bounty carries a tier designation. This is core to the brand and must appear consistently.

### Tier Badges

| Tier | Label | Color | Hex | Meaning |
|------|-------|-------|-----|---------|
| T1 | Open Race | Emerald | `#00E676` | Anyone can submit; winner takes the prize |
| T2 | Assigned | Cyan | `#40C4FF` | Maintainer selects the best submission |
| T3 | Invitational | Purple | `#7C3AED` | Invite-only; high-value |

### Tier Visual Rules
- Always use the tier color (hex above) — never swap tiers between colors
- Tier badge shape: pill/rounded-rectangle with the tier code (e.g., "T1")
- Never use tier colors for non-tier purposes

---

## 10. Do's & Don'ts

### Logo
- ✅ Use the official logo asset file
- ✅ Maintain clearspace
- ✅ Use on dark backgrounds for best contrast
- ❌ Don't recreate the logo in Figma/sketch from scratch
- ❌ Don't use on very busy backgrounds without a clear zone

### Color
- ✅ Use the full forge scale for dark themes
- ✅ Use emerald for primary CTAs and active states
- ✅ Use status colors consistently
- ❌ Don't use magenta as a primary background (it's too loud)
- ❌ Don't use status colors for decorative purposes

### Typography
- ✅ Use Orbitron for display/hero headings only
- ✅ Use Inter for all body copy
- ✅ Use JetBrains Mono for addresses and hashes
- ❌ Don't use Orbitron for long paragraphs
- ❌ Don't mix more than 2 font weights in the same text hierarchy

### Copy
- ✅ Be direct and technical — we speak to builders
- ✅ Use active voice
- ✅ Use "you" and "your" — we're on the builder's side
- ❌ Don't overhype: avoid "revolutionary", "game-changing", "best ever"
- ❌ Don't use corporate filler: "leverage", "synergy", "best-in-class"

### Social Media
- ✅ Use the social templates in `/content/social-media-templates/`
- ✅ Match the dark theme aesthetic
- ✅ Use tier colors for bounty announcements
- ❌ Don't post with light-theme screenshots of the platform
- ❌ Don't use the platform to spam unrelated communities

---

## Appendix: CSS Variables Reference

```css
:root {
  /* Brand */
  --color-emerald: #00E676;
  --color-emerald-light: #69F0AE;
  --color-purple: #7C3AED;
  --color-purple-light: #A78BFA;
  --color-magenta: #E040FB;
  --color-magenta-light: #EA80FC;

  /* Forge Scale */
  --forge-950: #050505;
  --forge-900: #0A0A0F;
  --forge-850: #0F0F18;
  --forge-800: #16161F;
  --forge-700: #1E1E2A;
  --forge-600: #2A2A3A;

  /* Text */
  --text-primary: #F0F0F5;
  --text-secondary: #A0A0B8;
  --text-muted: #5C5C78;

  /* Borders */
  --border: #1E1E2E;
  --border-hover: #2E2E42;
  --border-active: #3E3E56;

  /* Status */
  --status-success: #00E676;
  --status-warning: #FFB300;
  --status-error: #FF5252;
  --status-info: #40C4FF;

  /* Tier */
  --tier-t1: #00E676;
  --tier-t2: #40C4FF;
  --tier-t3: #7C3AED;

  /* Fonts */
  --font-display: 'Orbitron', sans-serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

---

*Last updated: 2026-04-06 | Content/social-media-templates companion deliverable: [PR #942](https://github.com/SolFoundry/solfoundry/pull/942)*
