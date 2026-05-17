import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source"
OUTPUT_DIR = ROOT / "png"
SIZE = 512
SCALE = 3
W = SIZE * SCALE

FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/arial.ttf")


def sx(value):
    return int(round(value * SCALE))


def box(values):
    return tuple(sx(v) for v in values)


def color(hex_value, alpha=255):
    hex_value = hex_value.strip("#")
    return tuple(int(hex_value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def font(size, bold=True):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), sx(size))


def fit_font(text, max_width, start_size, min_size=16):
    size = start_size
    while size >= min_size:
        candidate = font(size)
        left, top, right, bottom = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox(
            (0, 0), text, font=candidate
        )
        if right - left <= sx(max_width):
            return candidate
        size -= 1
    return font(min_size)


def text_center(draw, y, text, fill, size=42, max_width=350):
    fnt = fit_font(text, max_width, size)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=fnt)
    x = (W - (right - left)) // 2
    draw.text((x, sx(y)), text, font=fnt, fill=fill)


def line_with_glow(img, points, fill, width=8, glow=18):
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    scaled_points = [(sx(x), sx(y)) for x, y in points]
    gd.line(scaled_points, fill=fill, width=sx(width * 2), joint="curve")
    img.alpha_composite(glow_layer.filter(ImageFilter.GaussianBlur(sx(glow))))
    ImageDraw.Draw(img).line(scaled_points, fill=fill, width=sx(width), joint="curve")


def draw_base(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])

    draw.rounded_rectangle(box((36, 48, 476, 456)), radius=sx(76), fill=(255, 255, 255, 245))
    draw.rounded_rectangle(box((50, 62, 462, 442)), radius=sx(66), fill=(7, 9, 18, 255))

    for i in range(220):
        t = i / 219
        r = int(9 + 10 * t)
        g = int(11 + 9 * t)
        b = int(24 + 24 * t)
        draw.line((sx(54), sx(68 + i), sx(458), sx(68 + i)), fill=(r, g, b, 255), width=sx(1))

    draw.rounded_rectangle(box((68, 82, 444, 424)), radius=sx(48), outline=accent, width=sx(4))
    draw.arc(box((82, 96, 430, 410)), start=205, end=340, fill=secondary, width=sx(4))
    draw.arc(box((82, 96, 430, 410)), start=28, end=148, fill=accent, width=sx(4))

    text_center(draw, 86, "SolFoundry", (235, 248, 255, 230), size=24, max_width=260)
    text_center(draw, 382, spec["caption"], (255, 255, 255, 255), size=42, max_width=330)


def draw_sparks(draw, center, accent, secondary):
    cx, cy = center
    for i, angle in enumerate([15, 63, 132, 205, 286]):
        rad = math.radians(angle)
        x = cx + math.cos(rad) * (85 + i * 5)
        y = cy + math.sin(rad) * (72 + i * 3)
        fill = accent if i % 2 == 0 else secondary
        draw.line(box((x - 10, y, x + 10, y)), fill=fill, width=sx(4))
        draw.line(box((x, y - 10, x, y + 10)), fill=fill, width=sx(4))


def draw_anvil(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    line_with_glow(img, [(148, 260), (364, 260)], accent, 7, 12)
    draw.polygon([box((132, 248))[0:2], box((196, 206))[0:2], box((336, 206))[0:2], box((390, 248))[0:2], box((340, 306))[0:2], box((182, 306))[0:2]], fill=accent)
    draw.rounded_rectangle(box((176, 188, 342, 218)), radius=sx(9), fill=secondary)
    draw.polygon([box((176, 192))[0:2], box((112, 202))[0:2], box((174, 218))[0:2]], fill=accent)
    draw.rectangle(box((226, 304, 300, 332)), fill=accent)
    draw.rounded_rectangle(box((188, 330, 338, 350)), radius=sx(8), fill=secondary)
    draw.rounded_rectangle(box((248, 125, 268, 202)), radius=sx(8), fill=(255, 209, 102, 255))
    draw.rounded_rectangle(box((218, 116, 300, 148)), radius=sx(12), fill=secondary)
    draw_sparks(draw, (256, 220), accent, secondary)


def draw_code(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    line_with_glow(img, [(160, 188), (126, 226), (160, 264)], accent, 10, 12)
    line_with_glow(img, [(352, 188), (386, 226), (352, 264)], secondary, 10, 12)
    line_with_glow(img, [(282, 176), (230, 278)], (255, 255, 255, 255), 8, 10)
    draw.rounded_rectangle(box((176, 288, 336, 326)), radius=sx(12), fill=(255, 255, 255, 230))
    draw.text(box((196, 292))[0:2], "npm run ship", font=font(18), fill=(8, 12, 26, 255))


def draw_target(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    for radius, fill in [(116, accent), (82, (12, 16, 32, 255)), (54, secondary), (24, (255, 255, 255, 255))]:
        draw.ellipse(box((256 - radius, 224 - radius, 256 + radius, 224 + radius)), fill=fill)
    draw.line(box((256, 92, 256, 356)), fill=(255, 255, 255, 230), width=sx(5))
    draw.line(box((124, 224, 388, 224)), fill=(255, 255, 255, 230), width=sx(5))
    draw.rounded_rectangle(box((196, 310, 316, 344)), radius=sx(12), fill=(7, 9, 18, 255), outline=secondary, width=sx(4))
    draw.text(box((213, 315))[0:2], "+FNDRY", font=font(20), fill=secondary)


def draw_bug(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    draw.ellipse(box((188, 170, 324, 314)), fill=(12, 16, 32, 255), outline=accent, width=sx(8))
    draw.ellipse(box((220, 132, 292, 196)), fill=secondary)
    for y in [196, 232, 268]:
        draw.line(box((188, y, 136, y - 22)), fill=accent, width=sx(7))
        draw.line(box((324, y, 376, y - 22)), fill=accent, width=sx(7))
    draw.line(box((256, 188, 256, 308)), fill=(255, 255, 255, 180), width=sx(4))
    line_with_glow(img, [(320, 112), (230, 220)], secondary, 12, 12)
    draw.rounded_rectangle(box((310, 88, 390, 124)), radius=sx(10), fill=secondary)
    draw.rounded_rectangle(box((124, 324, 388, 352)), radius=sx(14), fill=(255, 255, 255, 235))


def draw_shield(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    points = [box((256, 116))[0:2], box((366, 160))[0:2], box((344, 298))[0:2], box((256, 350))[0:2], box((168, 298))[0:2], box((146, 160))[0:2]]
    draw.polygon(points, fill=(12, 16, 32, 255), outline=accent)
    draw.line(points + [points[0]], fill=accent, width=sx(8), joint="curve")
    line_with_glow(img, [(198, 238), (238, 278), (320, 190)], secondary, 14, 16)
    draw.rounded_rectangle(box((208, 318, 304, 344)), radius=sx(10), fill=secondary)
    draw.text(box((224, 322))[0:2], "PASS", font=font(16), fill=(7, 9, 18, 255))


def draw_coin(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    for offset in [52, 26, 0]:
        draw.ellipse(box((164, 156 - offset, 348, 282 - offset)), fill=(255, 177, 66, 255), outline=(255, 241, 186, 255), width=sx(6))
    draw.ellipse(box((188, 156, 324, 258)), fill=(255, 209, 102, 255), outline=accent, width=sx(6))
    text_center(draw, 185, "F", (8, 12, 26, 255), size=54, max_width=120)
    draw.rounded_rectangle(box((170, 292, 342, 330)), radius=sx(15), fill=(7, 9, 18, 255), outline=secondary, width=sx(4))
    draw.text(box((194, 300))[0:2], "REWARD", font=font(20), fill=secondary)


def draw_agent(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    draw.rounded_rectangle(box((158, 150, 354, 304)), radius=sx(38), fill=(12, 16, 32, 255), outline=accent, width=sx(8))
    draw.rectangle(box((244, 116, 268, 150)), fill=accent)
    draw.ellipse(box((236, 94, 276, 132)), fill=secondary)
    draw.rounded_rectangle(box((190, 194, 322, 246)), radius=sx(20), fill=(5, 8, 18, 255))
    draw.ellipse(box((206, 206, 238, 238)), fill=accent)
    draw.ellipse(box((274, 206, 306, 238)), fill=secondary)
    draw.line(box((214, 274, 298, 274)), fill=(255, 255, 255, 210), width=sx(5))
    for x, y in [(128, 192), (384, 192), (156, 330), (356, 330)]:
        draw.ellipse(box((x - 10, y - 10, x + 10, y + 10)), fill=secondary)
        draw.line(box((x, y, 256, 250)), fill=secondary, width=sx(3))


def draw_merge(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    line_with_glow(img, [(184, 130), (184, 270), (256, 326), (328, 270), (328, 130)], accent, 10, 16)
    for x, y in [(184, 130), (328, 130), (256, 326)]:
        draw.ellipse(box((x - 22, y - 22, x + 22, y + 22)), fill=(7, 9, 18, 255), outline=secondary, width=sx(7))
    line_with_glow(img, [(204, 232), (244, 272), (316, 190)], secondary, 13, 15)


def draw_rocket(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    draw.polygon([box((256, 92))[0:2], box((322, 250))[0:2], box((256, 312))[0:2], box((190, 250))[0:2]], fill=(255, 255, 255, 245), outline=accent)
    draw.line(box((256, 92, 322, 250)), fill=accent, width=sx(6))
    draw.line(box((256, 92, 190, 250)), fill=accent, width=sx(6))
    draw.ellipse(box((232, 164, 280, 212)), fill=secondary)
    draw.polygon([box((190, 250))[0:2], box((132, 298))[0:2], box((214, 292))[0:2]], fill=accent)
    draw.polygon([box((322, 250))[0:2], box((380, 298))[0:2], box((298, 292))[0:2]], fill=secondary)
    draw.polygon([box((236, 310))[0:2], box((256, 374))[0:2], box((276, 310))[0:2]], fill=(255, 209, 102, 255))
    draw_sparks(draw, (256, 260), accent, secondary)


def draw_loop(img, spec):
    draw = ImageDraw.Draw(img)
    accent = color(spec["accent"])
    secondary = color(spec["secondary"])
    draw.arc(box((130, 132, 382, 320)), start=34, end=318, fill=accent, width=sx(13))
    draw.arc(box((150, 166, 362, 354)), start=210, end=140, fill=secondary, width=sx(13))
    draw.polygon([box((356, 158))[0:2], box((410, 170))[0:2], box((376, 212))[0:2]], fill=accent)
    draw.polygon([box((156, 330))[0:2], box((102, 318))[0:2], box((136, 276))[0:2]], fill=secondary)
    draw.rounded_rectangle(box((198, 204, 314, 278)), radius=sx(18), fill=(7, 9, 18, 255), outline=(255, 255, 255, 230), width=sx(5))
    draw.text(box((218, 224))[0:2], "CI", font=font(34), fill=(255, 255, 255, 255))


MOTIFS = {
    "anvil": draw_anvil,
    "code": draw_code,
    "target": draw_target,
    "bug": draw_bug,
    "shield": draw_shield,
    "coin": draw_coin,
    "agent": draw_agent,
    "merge": draw_merge,
    "rocket": draw_rocket,
    "loop": draw_loop,
}


def render(spec, index):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    draw_base(img, spec)
    MOTIFS[spec["motif"]](img, spec)
    final = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    output_path = OUTPUT_DIR / f"{index:02d}-{spec['slug']}.png"
    final.save(output_path)
    return output_path


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    specs = json.loads((SOURCE_DIR / "sticker_specs.json").read_text(encoding="utf-8"))
    for index, spec in enumerate(specs, start=1):
        print(render(spec, index))


if __name__ == "__main__":
    main()
