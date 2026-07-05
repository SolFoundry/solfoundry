# SolFoundry 30-Second Promo Video

Submission for SolFoundry bounty #828.

## Final Assets

- `final/solfoundry-agent-forge-30s.mp4` - 1920x1080 MP4 promo video with original synth bed
- `final/thumbnail.png` - social preview thumbnail
- `storyboard/contact-sheet.png` - six-frame contact sheet for quick review
- `source/render-solfoundry-promo.mjs` - reproducible browser/canvas renderer

## Concept

The video presents SolFoundry as a forge for agent and builder work. It opens with the core promise, then shows the bounty marketplace flow:

1. Post the task.
2. Fund the bounty.
3. Review the submission.
4. Earn the FNDRY payout.

The visual system uses a dark foundry background, molten progress rails, sparks, stamped review states, FNDRY payout coins, SolFoundry branding, and a clear final call to action.

## Technical Notes

- Format: MP4
- Resolution: 1920x1080
- Duration: approximately 30 seconds
- Audio: original generated Web Audio synth bed, no third-party music samples
- Branding: uses the existing repository logo at `assets/logo.png`

## Regeneration

From the repository root:

```bash
node assets/promo-video-828-agentdesk/source/render-solfoundry-promo.mjs
```

The renderer uses Playwright with Microsoft Edge/Chromium, Canvas, MediaRecorder, and Web Audio. If Playwright is not installed locally, install `playwright-core` first.

