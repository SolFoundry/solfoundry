# SolFoundry Social Media Templates

5 reusable social media templates for announcing bounties on X/Twitter. Matches SolFoundry brand: dark theme, emerald/magenta accents, forge aesthetic.

## Deliverables

### Format Variants
- **Feed posts** — `t{N}_feed.svg` / `t{N}_feed.png` (1080×1080px) — square format for X/Twitter feed
- **Twitter cards** — `t{N}_card.svg` / `t{N}_card.png` (1200×675px) — landscape for link preview cards

### Template Themes
| # | Feed (1080×1080) | Card (1200×675) | Tier |
|---|-----------------|-----------------|------|
| 1 | NEW BOUNTY ALERT | Emerald gradient | T1 |
| 2 | FLASH BOUNTY | Purple gradient | T2 |
| 3 | COMMUNITY PICKS | Cyan gradient | T1 |
| 4 | HOT BOUNTY | Gold gradient | T3 |
| 5 | LAST CALL | Magenta gradient | T2 |

## Editing Templates

### Option 1 — Edit SVG directly (recommended)
Open any `.svg` file in:
- **Figma** (import SVG)
- **Canva** (import as custom size)
- **Inkscape** (free, open source)
- **Adobe Illustrator**

### Option 2 — Regenerate with Python
```bash
pip install svgwrite cairosvg pillow
python gen_templates.py
```
Edit the `templates` list in `gen_templates.py` to customize title, reward, and tier.

### Option 3 — Edit PNG in Canva
Upload `t{N}_feed.png` to [Canva](https://canva.com) → select "Use custom dimensions" → edit text overlays.

## Design System

### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0d0d0f` | Page background |
| Surface | `#1a1a1f` | Card backgrounds |
| Emerald | `#10b981` | Primary accent, T1 badges, CTAs |
| Magenta | `#ec4899` | Secondary accent |
| Muted | `#6b7280` | Placeholder text, secondary text |
| Border | `#2a2a35` | Subtle borders |
| T2 Purple | `#8b5cf6` | T2 tier badge |
| T3 Gold | `#f59e0b` | T3 tier badge |

### Typography
- **Primary font**: Inter (Google Fonts) or Arial fallback
- **Title text**: 26px bold
- **Reward amount**: 40–48px bold, emerald
- **Labels**: 12–14px, uppercase, letter-spacing 2–3px
- **CTA text**: 14–15px bold, uppercase

### Layout
- Rounded corners: 16px for cards, 8px for inner elements
- Padding: 40px outer margin
- Gradient accent bars at top and bottom (emerald → cyan)

## Acceptance Criteria
- [x] 5 templates delivered in PNG + SVG source format
- [x] Match SolFoundry brand guidelines (dark theme, emerald/magenta accents)
- [x] Editable for future bounty announcements (SVG + Python script)
- [x] 1080×1080 feed format + 1200×675 card format
- [x] Placeholder zones for bounty title, reward amount, description

## File Structure
```
content/social-media-templates/
├── README.md           ← This file
├── gen_templates.py    ← Python generator script
├── t1_feed.svg/png     ← Template 1: Feed (1080×1080)
├── t1_card.svg/png     ← Template 1: Card (1200×675)
├── t2_feed.svg/png
├── t2_card.svg/png
├── t3_feed.svg/png
├── t3_card.svg/png
├── t4_feed.svg/png
├── t4_card.svg/png
├── t5_feed.svg/png
└── t5_card.svg/png
```

## Notes
- SVG files are fully vector — infinitely scalable
- Text placeholders use `[ BOUNTY TITLE ]` / `[ Describe the bounty ]` format
- SolFoundry logo placeholder is the "SOLFOUNDRY" wordmark text — replace with official logo asset
- Gradient bars use emerald (#10b981) → cyan (#06b6d4) linear gradient
