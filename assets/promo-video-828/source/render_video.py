from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw

from audio import render_audio
from draw_utils import (
    HEIGHT,
    WIDTH,
    build_background,
    centered_text,
    clamp,
    draw_arrow,
    draw_bottom_progress,
    draw_check,
    draw_code_lines,
    draw_coin,
    draw_logo,
    draw_multiline,
    draw_network,
    draw_panel,
    draw_pill,
    draw_scene_title,
    ease,
    fade_window,
    font,
    lerp,
)
from palette import COLORS, hex_to_rgb, with_alpha


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source"
FINAL = ROOT / "final"
STORYBOARD = ROOT / "storyboard"
VIDEO_PATH = FINAL / "solfoundry-promo-30s.mp4"
AUDIO_PATH = FINAL / "original-synth-bed.wav"
THUMBNAIL_PATH = FINAL / "thumbnail.png"
CONTACT_SHEET_PATH = STORYBOARD / "contact-sheet.png"


def load_spec() -> dict:
    with (SOURCE / "promo_spec.json").open("r", encoding="utf-8") as handle:
        return json.load(handle)


def scene_for_time(spec: dict, t: float) -> dict:
    for scene in spec["scenes"]:
        if scene["start"] <= t < scene["end"]:
            return scene
    return spec["scenes"][-1]


def draw_intro(draw: ImageDraw.ImageDraw, t: float, alpha: int) -> None:
    draw_logo(draw, 625, 330, scale=1.65, alpha=alpha)
    centered_text(draw, 640, "Bounties become shipped software", font(46, bold=True), with_alpha(COLORS["white"], alpha))
    centered_text(draw, 702, "Post. Fund. Review. Earn.", font(34), with_alpha(COLORS["muted"], int(alpha * 0.9)))
    for index in range(18):
        angle = index * math.tau / 18 + t * 0.85
        radius = 225 + (index % 4) * 24
        cx = 960 + math.cos(angle) * radius
        cy = 488 + math.sin(angle) * radius * 0.48
        color = [COLORS["green"], COLORS["violet"], COLORS["cyan"], COLORS["gold"]][index % 4]
        size = 4 + index % 4
        draw.ellipse([cx - size, cy - size, cx + size, cy + size], fill=with_alpha(color, int(alpha * 0.8)))


def draw_bounty(draw: ImageDraw.ImageDraw, t: float, scene: dict, alpha: int) -> None:
    p = ease((t - scene["start"]) / (scene["end"] - scene["start"]))
    card_x = int(220 + (1 - p) * -120)
    draw_panel(draw, (card_x, 348, card_x + 660, 760), alpha=int(alpha * 0.92))
    draw_pill(draw, (card_x + 44, 396), "#835 BOUNTY", COLORS["violet"], alpha)
    draw.text((card_x + 48, 484), "Build a sticker pack", font=font(56, bold=True), fill=with_alpha(COLORS["white"], alpha))
    draw_multiline(
        draw,
        (card_x + 52, 566),
        "Clear task, public reward, and a simple path for contributors to submit work.",
        font(30),
        with_alpha(COLORS["muted"], int(alpha * 0.95)),
        520,
        line_gap=13,
    )
    draw_code_lines(draw, (card_x, 620, card_x + 660, 750), ["scope.md", "assets/", "PR_SUBMISSION.md"], alpha)

    right_x = int(1050 + (1 - p) * 140)
    draw.rounded_rectangle([right_x, 410, right_x + 560, 690], radius=32, fill=(255, 255, 255, int(alpha * 0.07)), outline=with_alpha(COLORS["green"], int(alpha * 0.55)), width=3)
    centered_text(draw, 505, "Idea", font(42, bold=True), with_alpha(COLORS["white"], alpha), x_center=right_x + 140)
    draw_arrow(draw, (right_x + 240, 550), (right_x + 350, 550), COLORS["green"], int(alpha * 0.82))
    centered_text(draw, 505, "Open bounty", font(42, bold=True), with_alpha(COLORS["white"], alpha), x_center=right_x + 420)
    draw.text((right_x + 58, 610), "The work becomes concrete.", font=font(28), fill=with_alpha(COLORS["muted"], int(alpha * 0.95)))


def draw_escrow(draw: ImageDraw.ImageDraw, t: float, scene: dict, alpha: int) -> None:
    p = clamp((t - scene["start"]) / (scene["end"] - scene["start"]))
    sponsor = (430, 570)
    escrow = (960, 570)
    builder = (1490, 570)
    for cx, cy, label, color in [
        (*sponsor, "Sponsor", COLORS["violet"]),
        (*escrow, "Escrow", COLORS["green"]),
        (*builder, "Builder", COLORS["cyan"]),
    ]:
        draw.ellipse([cx - 98, cy - 98, cx + 98, cy + 98], fill=with_alpha(color, int(alpha * 0.13)), outline=with_alpha(color, alpha), width=5)
        centered_text(draw, cy + 142, label, font(34, bold=True), with_alpha(COLORS["white"], alpha), x_center=cx)
    draw_arrow(draw, (550, 570), (820, 570), COLORS["green"], int(alpha * 0.75))
    draw_arrow(draw, (1100, 570), (1370, 570), COLORS["cyan"], int(alpha * 0.75))
    for i in range(5):
        phase = (p * 1.55 + i * 0.18) % 1.0
        if phase < 0.58:
            x = int(lerp(560, 820, phase / 0.58))
        else:
            x = int(lerp(1100, 1370, (phase - 0.58) / 0.42))
        y = 570 + int(math.sin(t * 2.4 + i) * 22)
        draw_coin(draw, x, y, 36, int(alpha * (0.45 + phase * 0.45)))
    draw.rounded_rectangle([840, 448, 1080, 692], radius=42, fill=with_alpha(COLORS["green"], int(alpha * 0.12)), outline=with_alpha(COLORS["green"], alpha), width=4)
    draw.polygon([(960, 492), (1035, 525), (1014, 646), (960, 684), (906, 646), (885, 525)], fill=with_alpha(COLORS["green"], int(alpha * 0.22)), outline=with_alpha(COLORS["green"], alpha))
    centered_text(draw, 590, "FNDRY", font(42, bold=True, mono=True), with_alpha(COLORS["white"], alpha))


def draw_review(draw: ImageDraw.ImageDraw, t: float, scene: dict, alpha: int) -> None:
    p = ease((t - scene["start"]) / (scene["end"] - scene["start"]))
    draw_panel(draw, (185, 358, 770, 778), alpha=int(alpha * 0.88))
    draw.text((242, 420), "Submission", font=font(44, bold=True), fill=with_alpha(COLORS["white"], alpha))
    draw_code_lines(draw, (205, 482, 745, 740), ["tests pass", "assets included", "scope matched"], alpha)
    draw_network(draw, (1220, 565), t, alpha)
    draw_check(draw, 1450, 700, 74, int(alpha * p))
    draw.text((1040, 782), "AI-assisted review checks quality signals", font=font(31), fill=with_alpha(COLORS["muted"], int(alpha * 0.95)))


def draw_earn(draw: ImageDraw.ImageDraw, t: float, scene: dict, alpha: int) -> None:
    p = ease((t - scene["start"]) / (scene["end"] - scene["start"]))
    draw_panel(draw, (330, 342, 890, 790), alpha=int(alpha * 0.9))
    draw.ellipse([410, 430, 540, 560], fill=with_alpha(COLORS["cyan"], int(alpha * 0.25)), outline=with_alpha(COLORS["cyan"], alpha), width=4)
    draw.rounded_rectangle([385, 590, 565, 714], radius=48, fill=with_alpha(COLORS["cyan"], int(alpha * 0.18)), outline=with_alpha(COLORS["cyan"], int(alpha * 0.65)), width=3)
    draw.text((610, 440), "Contributor", font=font(42, bold=True), fill=with_alpha(COLORS["white"], alpha))
    draw.text((610, 504), "Merged work", font=font(32), fill=with_alpha(COLORS["muted"], int(alpha * 0.95)))
    draw_check(draw, 784, 646, 56, alpha)

    for i in range(12):
        local = (p + i * 0.083) % 1.0
        x = int(1040 + math.sin(local * math.tau + i) * 250)
        y = int(600 - local * 270 + math.cos(local * math.tau) * 38)
        draw_coin(draw, x, y, 34 + (i % 3) * 5, int(alpha * (0.28 + local * 0.64)))
    draw.rounded_rectangle([1060, 648, 1540, 778], radius=34, fill=with_alpha(COLORS["gold"], int(alpha * 0.13)), outline=with_alpha(COLORS["gold"], int(alpha * 0.8)), width=3)
    centered_text(draw, 706, "FNDRY reward", font(54, bold=True), with_alpha(COLORS["white"], alpha), x_center=1300)


def draw_close(draw: ImageDraw.ImageDraw, t: float, scene: dict, alpha: int) -> None:
    steps = [
        ("Post bounty", COLORS["violet"]),
        ("Fund escrow", COLORS["green"]),
        ("AI review", COLORS["cyan"]),
        ("Earn FNDRY", COLORS["gold"]),
    ]
    x = 260
    y = 470
    for index, (label, color) in enumerate(steps):
        box = (x + index * 365, y, x + index * 365 + 290, y + 154)
        draw.rounded_rectangle(box, radius=30, fill=with_alpha(color, int(alpha * 0.13)), outline=with_alpha(color, int(alpha * 0.74)), width=3)
        centered_text(draw, y + 78, label, font(31, bold=True), with_alpha(COLORS["white"], alpha), x_center=box[0] + 145)
        if index < len(steps) - 1:
            draw_arrow(draw, (box[2] + 24, y + 78), (box[2] + 84, y + 78), color, int(alpha * 0.82))
    draw_logo(draw, 708, 706, scale=1.05, alpha=alpha)
    centered_text(draw, 894, "Build in public. Reward useful work.", font(38), with_alpha(COLORS["muted"], int(alpha * 0.95)))


def render_frame(t: float, spec: dict, background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image, "RGBA")
    scene = scene_for_time(spec, t)
    alpha = int(255 * fade_window(t, scene["start"], scene["end"]))

    draw_logo(draw, 78, 64, scale=0.74, alpha=210)
    draw_bottom_progress(draw, t, spec["duration_seconds"])
    draw_scene_title(draw, scene["headline"], scene["subline"], alpha)

    scene_index = spec["scenes"].index(scene)
    if scene_index == 0:
        draw_intro(draw, t, alpha)
    elif scene_index == 1:
        draw_bounty(draw, t, scene, alpha)
    elif scene_index == 2:
        draw_escrow(draw, t, scene, alpha)
    elif scene_index == 3:
        draw_review(draw, t, scene, alpha)
    elif scene_index == 4:
        draw_earn(draw, t, scene, alpha)
    else:
        draw_close(draw, t, scene, alpha)

    return image.convert("RGB")


def render_contact_sheet(spec: dict, background: Image.Image) -> None:
    times = [1.5, 5.7, 10.7, 16.7, 22.5, 28.0]
    thumbs = []
    for t in times:
        frame = render_frame(t, spec, background)
        thumbs.append(frame.resize((480, 270), Image.Resampling.LANCZOS))

    sheet = Image.new("RGB", (1500, 720), hex_to_rgb(COLORS["ink"]))
    draw = ImageDraw.Draw(sheet)
    draw.text((30, 24), "SolFoundry 30-second promo storyboard", font=font(32, bold=True), fill=hex_to_rgb(COLORS["white"]))
    for index, thumb in enumerate(thumbs):
        x = 30 + (index % 3) * 490
        y = 116 + (index // 3) * 300
        sheet.paste(thumb, (x, y))
        draw.text((x, y - 35), f"{times[index]:04.1f}s", font=font(25, bold=True, mono=True), fill=hex_to_rgb(COLORS["green"]))
    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET_PATH)


def render_video(spec: dict, background: Image.Image) -> None:
    FINAL.mkdir(parents=True, exist_ok=True)
    render_audio(AUDIO_PATH, duration=spec["duration_seconds"])

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(spec["fps"]),
        "-i",
        "-",
        "-i",
        str(AUDIO_PATH),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        str(VIDEO_PATH),
    ]

    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total_frames = int(spec["duration_seconds"] * spec["fps"])
    for index in range(total_frames):
        t = index / spec["fps"]
        frame = render_frame(t, spec, background)
        if index == int(28.0 * spec["fps"]):
            frame.save(THUMBNAIL_PATH)
        process.stdin.write(np.asarray(frame, dtype=np.uint8).tobytes())
        if index % spec["fps"] == 0:
            print(f"rendered {index // spec['fps']:02d}s / {spec['duration_seconds']}s", flush=True)
    process.stdin.close()
    code = process.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg exited with {code}")


def main() -> int:
    spec = load_spec()
    if spec["width"] != WIDTH or spec["height"] != HEIGHT:
        raise ValueError("Spec dimensions must match renderer dimensions.")
    background = build_background()
    render_contact_sheet(spec, background)
    render_video(spec, background)
    print(f"wrote {VIDEO_PATH}")
    print(f"wrote {THUMBNAIL_PATH}")
    print(f"wrote {CONTACT_SHEET_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
