import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source"
PNG_DIR = ROOT / "png"
SVG_DIR = ROOT / "svg"

FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/arial.ttf")

FORMATS = {
    "feed": (1080, 1080),
    "twitter-card": (1200, 675),
}


def color(hex_value, alpha=255):
    hex_value = hex_value.strip("#")
    return tuple(int(hex_value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def font(size, bold=True):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size)


def fit_font(text, max_width, start_size, min_size=24):
    size = start_size
    scratch = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    while size >= min_size:
        candidate = font(size)
        left, top, right, bottom = scratch.textbbox((0, 0), text, font=candidate)
        if right - left <= max_width:
            return candidate
        size -= 2
    return font(min_size)


def draw_centered(draw, xy, text, fill, size, max_width):
    x, y = xy
    fnt = fit_font(text, max_width, size)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=fnt)
    draw.text((x - (right - left) / 2, y), text, font=fnt, fill=fill)


def rounded(draw, rect, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(rect, radius=radius, fill=fill, outline=outline, width=width)


def glow_line(img, points, fill, width):
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line(points, fill=fill, width=width * 4, joint="curve")
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(width * 2)))
    ImageDraw.Draw(img).line(points, fill=fill, width=width, joint="curve")


def draw_anvil_mark(draw, x, y, scale, accent, secondary):
    body = [
        (x - 58 * scale, y + 22 * scale),
        (x - 35 * scale, y - 22 * scale),
        (x + 42 * scale, y - 22 * scale),
        (x + 64 * scale, y + 22 * scale),
        (x + 38 * scale, y + 52 * scale),
        (x - 44 * scale, y + 52 * scale),
    ]
    draw.polygon(body, fill=accent)
    rounded(draw, (x - 42 * scale, y - 44 * scale, x + 48 * scale, y - 20 * scale), int(7 * scale), secondary)
    draw.polygon([(x - 42 * scale, y - 38 * scale), (x - 86 * scale, y - 30 * scale), (x - 42 * scale, y - 19 * scale)], fill=accent)
    rounded(draw, (x - 34 * scale, y + 54 * scale, x + 40 * scale, y + 72 * scale), int(6 * scale), secondary)


def draw_background(img, spec):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(8 + 10 * t)
        g = int(10 + 8 * t)
        b = int(22 + 34 * t)
        draw.line((0, y, w, y), fill=(r, g, b, 255))

    accent = color(spec["accent"], 210)
    secondary = color(spec["secondary"], 190)
    for i in range(7):
        angle = math.radians(i * 51)
        cx = int(w * 0.5 + math.cos(angle) * w * 0.33)
        cy = int(h * 0.47 + math.sin(angle) * h * 0.32)
        draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=accent if i % 2 == 0 else secondary)
        if i:
            prev_angle = math.radians((i - 1) * 51)
            px = int(w * 0.5 + math.cos(prev_angle) * w * 0.33)
            py = int(h * 0.47 + math.sin(prev_angle) * h * 0.32)
            draw.line((px, py, cx, cy), fill=(255, 255, 255, 38), width=2)

    glow_line(img, [(int(w * 0.07), int(h * 0.78)), (int(w * 0.32), int(h * 0.64)), (int(w * 0.56), int(h * 0.82)), (int(w * 0.92), int(h * 0.58))], color(spec["accent"], 170), 5)


def render_png(spec, fmt, size):
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 255))
    draw_background(img, spec)
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])

    pad = int(min(w, h) * 0.065)
    rounded(draw, (pad, pad, w - pad, h - pad), int(min(w, h) * 0.055), (255, 255, 255, 235))
    rounded(draw, (pad + 10, pad + 10, w - pad - 10, h - pad - 10), int(min(w, h) * 0.047), (8, 10, 22, 248), accent, 3)

    draw_anvil_mark(draw, pad + 105, pad + 92, 0.85, accent, secondary)
    draw.text((pad + 178, pad + 50), "SolFoundry", font=font(34), fill=(238, 250, 255, 245))
    draw.text((pad + 178, pad + 90), "Bounty announcement template", font=font(20, False), fill=(170, 186, 205, 240))

    pill_w = 260 if fmt == "feed" else 300
    rounded(draw, (w - pad - pill_w, pad + 44, w - pad - 28, pad + 92), 24, accent)
    draw_centered(draw, (w - pad - pill_w / 2 - 14, pad + 52), spec["tier"], (8, 10, 22, 255), 22, pill_w - 40)

    content_x = pad + 70
    title_y = int(h * (0.29 if fmt == "feed" else 0.30))
    draw.text((content_x, title_y), spec["eyebrow"], font=font(30), fill=accent)
    draw.text((content_x, title_y + 48), spec["title"], font=fit_font(spec["title"], int(w * 0.72), 78 if fmt == "feed" else 68), fill=(255, 255, 255, 255))

    box_top = int(h * (0.61 if fmt == "feed" else 0.62))
    box_height = int(h * 0.18)
    rounded(draw, (content_x, box_top, w - pad - 70, box_top + box_height), 24, (13, 18, 34, 245), secondary, 3)
    draw.text((content_x + 34, box_top + 28), "REWARD", font=font(22), fill=(170, 186, 205, 255))
    draw.text((content_x + 34, box_top + 62), spec["reward"], font=fit_font(spec["reward"], int(w * 0.47), 52), fill=secondary)
    draw.text((w - pad - 280, box_top + 44), "Apply on GitHub", font=font(26), fill=(255, 255, 255, 245))
    draw.text((w - pad - 280, box_top + 82), "Open race | Builder friendly", font=font(20, False), fill=(170, 186, 205, 240))

    footer_y = h - pad - 72
    draw.text((content_x, footer_y), "Replace title, reward, and tier for future bounty posts.", font=font(22, False), fill=(194, 208, 224, 245))
    rounded(draw, (w - pad - 210, footer_y - 8, w - pad - 48, footer_y + 42), 22, (255, 255, 255, 235))
    draw_centered(draw, (w - pad - 129, footer_y), "$FNDRY", (8, 10, 22, 255), 24, 140)

    out = PNG_DIR / fmt / f"{spec['slug']}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out


def render_svg(spec, fmt, size):
    w, h = size
    svg = f"""<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070914"/>
      <stop offset="100%" stop-color="#161b35"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{spec['accent']}"/>
      <stop offset="100%" stop-color="{spec['secondary']}"/>
    </linearGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#bg)"/>
  <rect x="70" y="70" width="{w - 140}" height="{h - 140}" rx="56" fill="#080A16" stroke="{spec['accent']}" stroke-width="4"/>
  <text x="140" y="145" fill="#eefaff" font-size="36" font-family="Arial" font-weight="700">SolFoundry</text>
  <text x="140" y="{int(h * 0.36)}" fill="{spec['accent']}" font-size="34" font-family="Arial" font-weight="700">{spec['eyebrow']}</text>
  <text x="140" y="{int(h * 0.47)}" fill="#ffffff" font-size="70" font-family="Arial" font-weight="700">{spec['title']}</text>
  <rect x="140" y="{int(h * 0.62)}" width="{w - 280}" height="{int(h * 0.17)}" rx="28" fill="#0D1222" stroke="{spec['secondary']}" stroke-width="4"/>
  <text x="180" y="{int(h * 0.68)}" fill="#aab6c8" font-size="24" font-family="Arial" font-weight="700">REWARD</text>
  <text x="180" y="{int(h * 0.75)}" fill="{spec['secondary']}" font-size="48" font-family="Arial" font-weight="700">{spec['reward']}</text>
  <text x="{w - 360}" y="{int(h * 0.70)}" fill="#ffffff" font-size="28" font-family="Arial" font-weight="700">{spec['tier']}</text>
  <text x="140" y="{h - 110}" fill="#c2d0e0" font-size="24" font-family="Arial">Editable SVG source: replace title, reward, and tier text.</text>
</svg>
"""
    out = SVG_DIR / fmt / f"{spec['slug']}.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    return out


def build_contact_sheet(files):
    thumbs = []
    for file in files:
        im = Image.open(file)
        im.thumbnail((260, 180))
        thumbs.append((file, im.copy()))
    sheet = Image.new("RGBA", (5 * 300, 2 * 230), (18, 22, 32, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (file, im) in enumerate(thumbs[:10]):
        x = (i % 5) * 300 + 20
        y = (i // 5) * 230 + 18
        sheet.alpha_composite(im, (x, y))
        draw.text((x, y + 184), file.parent.name + "/" + file.stem, fill=(235, 248, 255, 255))
    sheet.save(ROOT / "preview-contact-sheet.png")


def main():
    specs = json.loads((SOURCE_DIR / "template_specs.json").read_text(encoding="utf-8"))
    png_files = []
    for spec in specs:
        for fmt, size in FORMATS.items():
            png_files.append(render_png(spec, fmt, size))
            render_svg(spec, fmt, size)
    build_contact_sheet(png_files)
    for file in png_files:
        print(file)


if __name__ == "__main__":
    main()
