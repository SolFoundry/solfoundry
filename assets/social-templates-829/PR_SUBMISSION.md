# PR Title

feat: add SolFoundry social media templates

# PR Body

Closes #829

## Summary

- Adds 5 reusable SolFoundry bounty announcement templates
- Exports each template as 1080x1080 feed PNG and 1200x675 Twitter/X card PNG
- Includes editable SVG source files for both formats
- Includes source JSON plus a reproducible renderer for future copy/palette updates

## Verification

- Generated all PNG exports with `assets/social-templates-829/source/render_templates.py`
- Verified 10 PNG exports exist across feed and Twitter/X card formats
- Verified expected dimensions: 1080x1080 and 1200x675
- Ran `git diff --check`

## Reward

FNDRY wallet: `<add public Solana wallet address before submit>`
