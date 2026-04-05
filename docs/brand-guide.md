# SolFoundry Brand Guide

> The visual identity system for the decentralized bounty marketplace.

---

## 1. Brand Essence

### Mission
SolFoundry connects skilled contributors with open-source projects through transparent, AI-reviewed bounty contracts.

### Core Values
- **Transparency** 鈥?Every bounty, review, and payout is on-chain
- **Quality** 鈥?AI-assisted code review ensures high standards
- **Community** 鈥?Contributors grow together through tier progression
- **Innovation** 鈥?FNDRY token powers a new model for open-source

### Brand Personality
- **Technical but approachable** 鈥?We speak developer, not corporate
- **Bold but not aggressive** 鈥?Confident colors, clean typography
- **Premium but not exclusive** 鈥?High-quality design for everyone

---

## 2. Logo

### Primary Logo
The SolFoundry logo combines:
- **Anvil** 鈥?Symbol of creation, craftsmanship, and the "foundry"
- **Gradient** 鈥?Emerald 鈫?Purple 鈫?Magenta representing the journey from idea to execution
- **Wordmark** 鈥?"SolFoundry" in Orbitron font

### Logo Variations

| Version | Usage |
|---------|-------|
| Full (logo + wordmark) | Headers, marketing, presentations |
| Logo only | Favicons, app icons, small spaces |
| Wordmark only | Footer, text-only contexts |
| Monochrome (white) | Dark backgrounds, watermarks |
| Monochrome (black) | Light backgrounds, print |

### Clear Space
Maintain minimum clear space equal to the height of the "S" in the wordmark around all sides of the logo.

### Do's and Don'ts

鉁?**Do:**
- Use logo on high-contrast backgrounds
- Maintain aspect ratio
- Use provided SVG/PNG files

鉂?**Don't:**
- Stretch or distort the logo
- Change logo colors outside brand palette
- Add effects (shadows, glows, outlines)
- Rotate the logo
- Place on busy backgrounds that reduce legibility

---

## 3. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Emerald** | `#00E676` | 0, 230, 118 | Primary actions, success, money, CTAs |
| **Emerald Light** | `#69F0AE` | 105, 240, 174 | Hover states, highlights |
| **Purple** | `#7C3AED` | 124, 58, 237 | Solana branding, secondary actions |
| **Purple Light** | `#A78BFA` | 167, 139, 250 | Hover states, gradients |
| **Magenta** | `#E040FB` | 224, 64, 251 | AI/review elements, accent |

### Background Colors (Forge Scale)

| Name | Hex | Usage |
|------|-----|-------|
| **Forge 950** | `#050505` | Main background |
| **Forge 900** | `#0A0A0F` | Cards, panels |
| **Forge 850** | `#0F0F18` | Elevated surfaces |
| **Forge 800** | `#16161F` | Inputs, code blocks |
| **Forge 700** | `#1E1E2A` | Borders, dividers |
| **Forge 600** | `#2A2A3A` | Disabled, muted |

### Text Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Primary** | `#F0F0F5` | Headlines, body text |
| **Secondary** | `#A0A0B8` | Subheadings, labels |
| **Muted** | `#5C5C78` | Placeholders, hints |
| **Inverse** | `#050505` | Text on light backgrounds |

### Status Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#00E676` | Completed, approved |
| **Warning** | `#FFB300` | Pending, attention needed |
| **Error** | `#FF5252` | Failed, rejected |
| **Info** | `#40C4FF` | Informational, tips |

### Tier Badge Colors

| Tier | Hex | Usage |
|------|-----|-------|
| **T1** | `#00E676` | Entry-level bounties |
| **T2** | `#40C4FF` | Intermediate bounties |
| **T3** | `#7C3AED` | Advanced bounties |

### Gradient Definitions

```
Navbar Gradient:   linear-gradient(90deg, #00E676, #7C3AED, #E040FB)
Hero Gradient:     radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15), rgba(224,64,251,0.08), transparent)
Footer Gradient:   linear-gradient(90deg, #E040FB, #7C3AED, #00E676)
```

---

## 4. Typography

### Font Families

| Name | Font | Usage |
|------|------|-------|
| **Display** | Orbitron | Logo, hero headlines, tier badges |
| **Sans** | Inter | Body text, UI elements, navigation |
| **Mono** | JetBrains Mono | Code, wallet addresses, numbers |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Labels, navigation |
| Semibold | 600 | Subheadings |
| Bold | 700 | Headlines, CTAs |

### Type Scale

| Element | Size | Weight | Font |
|---------|------|--------|------|
| H1 (Hero) | 48px / 3rem | 700 | Display |
| H2 (Page) | 32px / 2rem | 700 | Sans |
| H3 (Section) | 24px / 1.5rem | 600 | Sans |
| H4 (Card) | 18px / 1.125rem | 600 | Sans |
| Body | 16px / 1rem | 400 | Sans |
| Small | 14px / 0.875rem | 400 | Sans |
| Caption | 12px / 0.75rem | 400 | Sans |
| Code | 14px | 400 | Mono |

### Line Height

- Headlines: 1.2
- Body text: 1.6
- UI elements: 1.5

---

## 5. Spacing

### Base Unit
4px 鈥?All spacing values are multiples of 4.

### Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, tight spacing |
| sm | 8px | Inline elements, badge padding |
| md | 16px | Card padding, section gaps |
| lg | 24px | Page sections |
| xl | 32px | Major sections |
| 2xl | 48px | Page margins |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Badges, small buttons |
| md | 8px | Cards, inputs |
| lg | 12px | Large cards, modals |
| xl | 16px | Feature sections |
| full | 9999px | Pills, avatars |

---

## 6. Components

### Buttons

**Primary (Emerald)**
- Background: `#00E676`
- Text: `#050505`
- Hover: `#69F0AE`
- Border radius: 8px
- Padding: 12px 24px

**Secondary (Ghost)**
- Background: transparent
- Border: 1px solid `#1E1E2E`
- Text: `#F0F0F5`
- Hover background: `#16161F`

**Tier Buttons**
- T1: Emerald border
- T2: Info blue border
- T3: Purple border

### Cards

- Background: `#0A0A0F`
- Border: 1px solid `#1E1E2E`
- Border radius: 12px
- Padding: 16-24px
- Hover: Border color `#2E2E42`

### Badges

**Tier Badges**
- T1: Emerald text, emerald background (8% opacity)
- T2: Info blue text, blue background
- T3: Purple text, purple background

**Status Badges**
- Open: Emerald
- In Review: Magenta
- Completed: Muted gray
- Cancelled: Error red

### Inputs

- Background: `#16161F`
- Border: 1px solid `#1E1E2E`
- Focus border: `#00E676`
- Placeholder: `#5C5C78`
- Border radius: 8px

---

## 7. Imagery

### Style Guidelines

**Photography**
- Use high-contrast, dark-themed images
- Avoid overly bright or saturated photos
- Prefer technical/developer contexts

**Illustrations**
- Use gradient accents from brand palette
- Maintain dark backgrounds
- Keep linework minimal and clean

**Icons**
- Use Lucide React icon library
- Stroke width: 2px
- Size: 16px (inline), 20px (buttons), 24px (features)

### Do's and Don'ts

鉁?**Do:**
- Use dark backgrounds for images
- Apply brand color overlays
- Maintain consistent icon style

鉂?**Don't:**
- Use clipart or stock watermarks
- Apply heavy filters or effects
- Mix illustration styles

---

## 8. Tone of Voice

### Principles

**Clear, not clever**
- Write for scanning, not reading
- One idea per sentence
- Active voice, present tense

**Technical, not jargon-heavy**
- Use developer terminology correctly
- Explain complex concepts simply
- Link to documentation when needed

**Confident, not arrogant**
- "Submit your solution" not "Please submit"
- "Earn FNDRY" not "You can earn"
- Direct calls to action

### Examples

| Context | 鉁?Good | 鉂?Bad |
|---------|---------|--------|
| CTA | "Submit PR" | "Click here to submit your pull request" |
| Error | "Connection failed. Check your wallet." | "Oops! Something went wrong :(" |
| Success | "Bounty submitted for review" | "Congratulations! Your bounty has been successfully submitted!" |
| Empty | "No bounties yet. Create one 鈫? | "There are currently no bounties available in the system." |

---

## 9. Animation

### Principles

- **Purposeful** 鈥?Every animation guides attention or provides feedback
- **Fast** 鈥?150-300ms for UI transitions
- **Smooth** 鈥?Use ease-out for entrances, ease-in for exits

### Defined Animations

| Name | Duration | Usage |
|------|----------|-------|
| Fade in | 200ms | Page transitions, modals |
| Slide up | 300ms | Toast notifications |
| Shimmer | 2s (loop) | Loading skeletons |
| Pulse glow | 3s (loop) | Status indicators |

### Reduced Motion
Respect `prefers-reduced-motion` media query for accessibility.

---

## 10. Accessibility

### Color Contrast
- All text meets WCAG AA contrast ratios
- Primary text on Forge 950: 14.8:1
- Muted text on Forge 950: 4.8:1

### Focus States
- All interactive elements have visible focus rings
- Focus color: Emerald
- Never remove focus outlines

### Screen Readers
- Use semantic HTML
- Provide alt text for images
- Label form inputs

---

## 11. Assets

### Logo Files
- `/assets/logo/solfoundry-full.svg` 鈥?Full logo + wordmark
- `/assets/logo/solfoundry-icon.svg` 鈥?Icon only
- `/assets/logo/solfoundry-wordmark.svg` 鈥?Wordmark only
- `/assets/logo/solfoundry-white.svg` 鈥?Monochrome white

### Favicon
- `/public/favicon.ico` 鈥?32x32
- `/public/apple-touch-icon.png` 鈥?180x180

### Social
- `/assets/social/og-image.png` 鈥?1200x630 for Open Graph
- `/assets/social/twitter-image.png` 鈥?1200x600 for Twitter

---

## Quick Reference

```
/* Primary Colors */
--emerald: #00E676;
--purple: #7C3AED;
--magenta: #E040FB;

/* Backgrounds */
--forge-950: #050505;
--forge-900: #0A0A0F;
--forge-800: #16161F;

/* Text */
--text-primary: #F0F0F5;
--text-secondary: #A0A0B8;
--text-muted: #5C5C78;

/* Fonts */
--font-display: 'Orbitron';
--font-sans: 'Inter';
--font-mono: 'JetBrains Mono';
```

---

*Brand Guide v1.0 鈥?SolFoundry 2024*