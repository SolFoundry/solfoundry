from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from palette import COLORS, hex_to_rgb, mix, with_alpha


WIDTH = 1920
HEIGHT = 1080


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def lerp(a: float, b: float, amount: float) -> float:
    return a + (b - a) * amount


def fade_window(t: float, start: float, end: float, edge: float = 0.45) -> float:
    fade_in = clamp((t - start) / edge)
    fade_out = clamp((end - t) / edge)
    return min(ease(fade_in), ease(fade_out))


@lru_cache(maxsize=64)
def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        candidates = [
            Path("C:/Windows/Fonts/consolab.ttf" if bold else "C:/Windows/Fonts/consola.ttf"),
            Path("C:/Windows/Fonts/courbd.ttf" if bold else "C:/Windows/Fonts/cour.ttf"),
        ]
    else:
        candidates = [
            Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def text_box(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=face)
    return box[2] - box[0], box[3] - box[1]


def centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    face: ImageFont.ImageFont,
    fill: tuple[int, int, int, int] | str,
    x_center: int = WIDTH // 2,
) -> None:
    tw, th = text_box(draw, text, face)
    draw.text((x_center - tw / 2, y - th / 2), text, font=face, fill=fill)


def build_background() -> Image.Image:
    y = np.linspace(0, 1, HEIGHT, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, WIDTH, dtype=np.float32)[None, :]
    top = np.array(hex_to_rgb("#071015"), dtype=np.float32)
    bottom = np.array(hex_to_rgb("#10262A"), dtype=np.float32)
    base = top * (1 - y) + bottom * y

    glows = [
        (0.16, 0.14, "#9945FF", 0.35, 0.18),
        (0.86, 0.20, "#14F195", 0.26, 0.22),
        (0.58, 0.88, "#6EE7FF", 0.20, 0.20),
    ]
    rgb = np.broadcast_to(base[:, None, :], (HEIGHT, WIDTH, 3)).copy()
    for cx, cy, color, strength, radius in glows:
        dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        mask = np.clip(1 - dist / radius, 0, 1) ** 2
        rgb += np.array(hex_to_rgb(color), dtype=np.float32) * mask[..., None] * strength

    noise = ((np.sin(x * 90) + np.cos(y * 70)) * 2.0)[..., None]
    rgb = np.clip(rgb + noise, 0, 255).astype(np.uint8)
    bg = Image.fromarray(rgb, "RGB").convert("RGBA")
    draw = ImageDraw.Draw(bg, "RGBA")

    for gx in range(-200, WIDTH + 200, 120):
        draw.line([(gx, 0), (gx + 420, HEIGHT)], fill=(255, 255, 255, 9), width=1)
    for gy in range(120, HEIGHT, 120):
        draw.line([(0, gy), (WIDTH, gy)], fill=(255, 255, 255, 6), width=1)
    return bg


def draw_logo(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0, alpha: int = 255) -> None:
    g = with_alpha(COLORS["green"], alpha)
    v = with_alpha(COLORS["violet"], alpha)
    white = with_alpha(COLORS["white"], alpha)
    s = scale
    draw.rounded_rectangle([x, y, x + 82 * s, y + 82 * s], radius=int(18 * s), fill=(10, 16, 22, alpha), outline=(110, 231, 255, 45))
    draw.polygon(
        [
            (x + 18 * s, y + 58 * s),
            (x + 28 * s, y + 38 * s),
            (x + 57 * s, y + 38 * s),
            (x + 66 * s, y + 58 * s),
        ],
        fill=v,
    )
    draw.rounded_rectangle([x + 23 * s, y + 31 * s, x + 62 * s, y + 42 * s], radius=int(3 * s), fill=g)
    draw.polygon([(x + 23 * s, y + 36 * s), (x + 9 * s, y + 34 * s), (x + 11 * s, y + 40 * s), (x + 23 * s, y + 42 * s)], fill=v)
    draw.rounded_rectangle([x + 40 * s, y + 13 * s, x + 47 * s, y + 35 * s], radius=int(2 * s), fill=g)
    draw.rounded_rectangle([x + 32 * s, y + 8 * s, x + 55 * s, y + 20 * s], radius=int(4 * s), fill=v)
    for sx, sy, color, size in [(59, 27, g, 4), (65, 21, with_alpha(COLORS["gold"], alpha), 3), (69, 32, g, 2)]:
        draw.ellipse([x + (sx - size) * s, y + (sy - size) * s, x + (sx + size) * s, y + (sy + size) * s], fill=color)
    draw.text((x + 102 * s, y + 6 * s), "SolFoundry", font=font(int(44 * s), bold=True, mono=True), fill=white)
    draw.text((x + 104 * s, y + 55 * s), "THE AI FACTORY THAT BUILDS ITSELF", font=font(int(15 * s), mono=True), fill=with_alpha(COLORS["muted"], alpha))


def draw_pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: str, alpha: int = 255) -> None:
    x, y = xy
    face = font(30, bold=True)
    tw, th = text_box(draw, text, face)
    draw.rounded_rectangle([x, y, x + tw + 42, y + th + 28], radius=24, fill=(*hex_to_rgb(color), int(alpha * 0.13)), outline=(*hex_to_rgb(color), int(alpha * 0.55)), width=2)
    draw.text((x + 21, y + 13), text, font=face, fill=with_alpha(color, alpha))


def draw_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], alpha: int = 225) -> None:
    draw.rounded_rectangle(box, radius=34, fill=(13, 24, 31, alpha), outline=(255, 255, 255, 34), width=2)


def draw_bottom_progress(draw: ImageDraw.ImageDraw, t: float, duration: float) -> None:
    x0, y0, x1, y1 = 420, 996, 1500, 1011
    draw.rounded_rectangle([x0, y0, x1, y1], radius=8, fill=(255, 255, 255, 22))
    progress = clamp(t / duration)
    fill_w = int((x1 - x0) * progress)
    draw.rounded_rectangle([x0, y0, x0 + fill_w, y1], radius=8, fill=hex_to_rgb(COLORS["green"]) + (210,))
    labels = ["POST", "ESCROW", "REVIEW", "EARN"]
    for i, label in enumerate(labels):
        lx = x0 + int((x1 - x0) * (i + 0.5) / 4)
        fill = with_alpha(COLORS["white"], 190 if progress > i / 4 else 80)
        centered_text(draw, 1042, label, font(18, bold=True, mono=True), fill, x_center=lx)


def draw_coin(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, alpha: int = 255) -> None:
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=with_alpha(COLORS["gold"], alpha), outline=(255, 255, 255, int(alpha * 0.45)), width=3)
    centered_text(draw, cy, "F", font(max(18, int(radius * 0.95)), bold=True, mono=True), (12, 19, 25, alpha), x_center=cx)


def draw_arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str, alpha: int = 180) -> None:
    sx, sy = start
    ex, ey = end
    draw.line([start, end], fill=with_alpha(color, alpha), width=6)
    angle = math.atan2(ey - sy, ex - sx)
    size = 18
    left = (ex - math.cos(angle - 0.55) * size, ey - math.sin(angle - 0.55) * size)
    right = (ex - math.cos(angle + 0.55) * size, ey - math.sin(angle + 0.55) * size)
    draw.polygon([end, left, right], fill=with_alpha(color, alpha))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if text_box(draw, trial, face)[0] <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_multiline(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, face: ImageFont.ImageFont, fill, max_width: int, line_gap: int = 12) -> None:
    x, y = xy
    for line in wrap_text(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=fill)
        y += text_box(draw, line, face)[1] + line_gap


def draw_scene_title(draw: ImageDraw.ImageDraw, headline: str, subline: str, alpha: int) -> None:
    centered_text(draw, 176, headline, font(74, bold=True), with_alpha(COLORS["white"], alpha))
    centered_text(draw, 244, subline, font(34), with_alpha(COLORS["muted"], int(alpha * 0.9)))


def draw_code_lines(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], labels: list[str], alpha: int) -> None:
    x0, y0, x1, _ = box
    y = y0 + 48
    for index, label in enumerate(labels):
        color = [COLORS["green"], COLORS["cyan"], COLORS["violet"], COLORS["gold"]][index % 4]
        draw.rounded_rectangle([x0 + 42, y, x0 + 90, y + 14], radius=7, fill=with_alpha(color, int(alpha * 0.75)))
        draw.rounded_rectangle([x0 + 108, y - 5, x1 - 48 - index * 32, y + 19], radius=10, fill=(255, 255, 255, int(alpha * 0.11)))
        draw.text((x0 + 44, y + 26), label, font=font(20, mono=True), fill=with_alpha(COLORS["muted"], int(alpha * 0.85)))
        y += 86


def draw_check(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, alpha: int) -> None:
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=with_alpha(COLORS["green"], int(alpha * 0.16)), outline=with_alpha(COLORS["green"], alpha), width=4)
    draw.line([(cx - radius * 0.38, cy), (cx - radius * 0.08, cy + radius * 0.30), (cx + radius * 0.45, cy - radius * 0.36)], fill=with_alpha(COLORS["green"], alpha), width=max(4, radius // 7))


def draw_network(draw: ImageDraw.ImageDraw, center: tuple[int, int], pulse: float, alpha: int) -> None:
    cx, cy = center
    points = []
    for i in range(9):
        angle = i * math.tau / 9 + pulse * 0.35
        radius = 120 + (i % 3) * 54
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    for i, p1 in enumerate(points):
        for j, p2 in enumerate(points):
            if i < j and (i + j) % 3 == 0:
                draw.line([p1, p2], fill=with_alpha(COLORS["cyan"], int(alpha * 0.20)), width=2)
    for index, (px, py) in enumerate(points):
        color = [COLORS["green"], COLORS["violet"], COLORS["cyan"]][index % 3]
        r = 17 + int(4 * math.sin(pulse * 2 + index))
        draw.ellipse([px - r, py - r, px + r, py + r], fill=with_alpha(color, int(alpha * 0.85)), outline=(255, 255, 255, int(alpha * 0.5)), width=2)
