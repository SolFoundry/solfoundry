# SolFoundry 30-Second Promo Video

This package contains a reproducible 1080p promo video for bounty #828.

## Deliverables

- `final/solfoundry-promo-30s.mp4` - 30-second 1920x1080 MP4 with audio
- `final/thumbnail.png` - social preview thumbnail
- `storyboard/contact-sheet.png` - six-frame storyboard overview
- `source/` - Python renderer, visual spec, palette, and original audio generator

## Message Flow

1. SolFoundry turns ideas into public bounties.
2. Sponsors fund escrow.
3. AI-assisted review checks submissions.
4. Contributors earn FNDRY for useful work.

The music bed is generated from original synth tones in `source/audio.py`.

## Re-render

```bash
python assets/promo-video-828/source/render_video.py
```
