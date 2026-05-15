# SolFoundry Brand Guide

## 1. Brand Overview

**SolFoundry** is a decentralized bounty platform built on Solana that connects open-source contributors with funded development tasks. The brand communicates trust, speed, and community-driven innovation.

### Brand Values
- **Transparency** — All bounties, payouts, and contributions are on-chain and verifiable
- **Speed** — Built on Solana for fast, low-cost transactions
- **Community** — Empowering open-source contributors worldwide
- **Quality** — Rewarding meaningful contributions with fair compensation

### Brand Voice
- Professional yet approachable
- Technically precise without being jargon-heavy
- Encouraging and inclusive
- Action-oriented

---

## 2. Color Palette

### Primary Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **SolFoundry Green** | `#14F195` | rgb(20, 241, 149) | Primary actions, CTAs, active states, logo accent |
| **Deep Navy** | `#0F172A` | rgb(15, 23, 42) | Primary text, headings, dark backgrounds |
| **Pure White** | `#FFFFFF` | rgb(255, 255, 255) | Light backgrounds, card surfaces |

### Secondary Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **Solana Purple** | `#9945FF` | rgb(153, 69, 255) | Gradient accents, secondary CTAs |
| **Gradient Start** | `#14F195` | rgb(20, 241, 149) | Gradient backgrounds (start) |
| **Gradient End** | `#9945FF` | rgb(153, 69, 255) | Gradient backgrounds (end) |
| **Success** | `#22C55E` | rgb(34, 197, 94) | Completed bounties, positive states |
| **Warning** | `#F59E0B` | rgb(245, 158, 11) | Pending actions, countdown states |
| **Error** | `#EF4444` | rgb(239, 68, 68) | Failed transactions, errors |

### Neutral Colors

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **Gray 900** | `#111827` | rgb(17, 24, 39) | Dark mode background |
| **Gray 700** | `#374151` | rgb(55, 65, 81) | Borders, dividers (dark mode) |
| **Gray 400** | `#9CA3AF` | rgb(156, 163, 175) | Secondary text, disabled states |
| **Gray 200** | `#E5E7EB` | rgb(229, 231, 235) | Borders, dividers (light mode) |
| **Gray 50** | `#F9FAFB` | rgb(249, 250, 251) | Light mode background |

### Color Rules
- Always maintain a **4.5:1 minimum contrast ratio** for text on backgrounds (WCAG AA)
- The SolFoundry Green-to-Purple gradient is the brand signature — use it sparingly for impact
- Never use the gradient for body text or small UI elements
- Primary CTA buttons use **SolFoundry Green** (`#14F195`) with dark text (`#0F172A`)

---

## 3. Typography

### Primary Font: **Inter**

| Weight | Usage |
|--------|-------|
| **Regular (400)** | Body text, descriptions, labels |
| **Medium (500)** | Navigation, subheadings, button text |
| **Semi-Bold (600)** | Section headings, card titles |
| **Bold (700)** | Page titles, hero headings |

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Monospace Font: **JetBrains Mono**

Used for code snippets, wallet addresses, transaction hashes, and token amounts.

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

### Type Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| **Display** | 48px / 3rem | Bold (700) | 1.1 |
| **H1** | 36px / 2.25rem | Bold (700) | 1.2 |
| **H2** | 30px / 1.875rem | Semi-Bold (600) | 1.25 |
| **H3** | 24px / 1.5rem | Semi-Bold (600) | 1.3 |
| **H4** | 20px / 1.25rem | Medium (500) | 1.35 |
| **Body Large** | 18px / 1.125rem | Regular (400) | 1.5 |
| **Body** | 16px / 1rem | Regular (400) | 1.5 |
| **Small** | 14px / 0.875rem | Regular (400) | 1.5 |
| **Caption** | 12px / 0.75rem | Medium (500) | 1.4 |

---

## 4. Logo

### Logo Variants

1. **Full Logo** — Icon + wordmark "SolFoundry"
   - Use for: headers, about pages, presentations
2. **Icon Only** — The foundry/emblem mark
   - Use for: favicons, app icons, avatars, small UI elements
3. **Wordmark Only** — "SolFoundry" text
   - Use for: constrained spaces where icon doesn't fit

### Logo Colors
- **On light backgrounds**: Green gradient icon + Deep Navy text
- **On dark backgrounds**: Green gradient icon + White text
- **Monochrome**: Single color (context-dependent)

### Clearspace
- Minimum clearspace around the logo is **1x the height of the icon**
- The logo must never touch or overlap other elements within this space

### Logo Restrictions
- Do not stretch, skew, or rotate the logo
- Do not change the logo colors to non-brand colors
- Do not add drop shadows, glows, or other effects
- Do not place the logo on busy/patterned backgrounds without a solid container
- Do not recreate or modify the logo
- Minimum size: 24px height for the icon, 120px width for the full logo

---

## 5. Imagery Guidelines

### Photography Style
- Clean, well-lit images of code screens, collaborative workspaces
- Abstract representations of blockchain/networks (not literal crypto coin imagery)
- Diverse representation of contributors

### Illustration Style
- Geometric, isometric style with brand colors
- Clean lines with subtle gradients (green-to-purple)
- Consistent stroke weight (2px)

### Iconography
- Use Lucide Icons as the primary icon set
- Stroke-based, 2px weight
- 24x24 default grid, scalable to 16x16 or 32x32

---

## 6. UI Components

### Buttons

| Type | Background | Text | Border |
|------|-----------|------|--------|
| **Primary** | `#14F195` | `#0F172A` | None |
| **Secondary** | Transparent | `#14F195` | `#14F195` |
| **Ghost** | Transparent | `#9CA3AF` | None |
| **Danger** | `#EF4444` | `#FFFFFF` | None |

### Border Radius
- Buttons, inputs: `8px`
- Cards, modals: `12px`
- Avatar: `50%` (circle) or `8px` (rounded square)
- Tags, badges: `9999px` (pill)

### Spacing
- Base unit: `4px`
- Common values: `4, 8, 12, 16, 24, 32, 48, 64, 96`

---

## 7. Tone of Voice

### Do
- "Complete bounties and earn rewards"
- "Your contribution is verified on-chain"
- "Join the community"

### Do Not
- "Get rich quick with crypto bounties"
- "We guarantee returns"
- Excessive exclamation marks or hyperbole

### Writing Conventions
- Use sentence case for headings (not Title Case)
- Use the Oxford comma
- Write "SolFoundry" as one word with a capital S and F
- Use `$FNDRY` for token references
- Write "Solana" not "SOL" when referring to the blockchain

---

## 8. Design Principles

1. **Clarity first** — Every element should have a clear purpose
2. **Consistent interaction** — Similar elements behave similarly across all pages
3. **Progressive disclosure** — Show essential info first, details on demand
4. **Mobile-first** — Design for small screens, enhance for desktop
5. **Accessible by default** — WCAG 2.1 AA compliance for all components

---

*This brand guide is a living document. For questions or updates, open an issue or PR.*
