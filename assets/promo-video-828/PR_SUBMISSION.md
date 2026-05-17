# PR Title

feat: add 30-second SolFoundry promo video

# PR Body

Closes #828

## Summary

- Adds a 30-second 1080p MP4 promo video for SolFoundry.
- Covers the required value proposition: post bounty, fund escrow, AI review, and earn FNDRY.
- Includes SolFoundry branding, social-ready thumbnail, storyboard contact sheet, and an original generated synth music bed.
- Includes a reproducible Python renderer so the video can be updated later.

## Files

- `assets/promo-video-828/final/solfoundry-promo-30s.mp4`
- `assets/promo-video-828/final/thumbnail.png`
- `assets/promo-video-828/storyboard/contact-sheet.png`
- `assets/promo-video-828/source/`

## Verification

- Rendered with `python assets/promo-video-828/source/render_video.py`
- Validated MP4 output as 1920x1080, approximately 30 seconds
- Ran `git diff --check`

## Reward Wallet

FNDRY/Solana wallet: `3BAGU3K8mn9avJJC3okFaT2BSeeaxHdvhMZWpWkYrYuW`
