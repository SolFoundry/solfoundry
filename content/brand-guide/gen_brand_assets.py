#!/usr/bin/env python3
"""Generate brand guide visual assets."""

import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/home/aa/.openclaw/workspace/content/brand-guide"
os.makedirs(OUT, exist_ok=True)

# ── Brand Colors ────────────────────────────────────────────────────────────
COLORS = {
    "Emerald":          ("#00E676", "#050505"),
    "Emerald Light":    ("#69F0AE", "#050505"),
    "Purple":           ("#7C3AED", "#F0F0F5"),
    "Purple Light":     ("#A78BFA", "#050505"),
    "Magenta":          ("#E040FB", "#050505"),
    "Magenta Light":    ("#EA80FC", "#050505"),
    "Forge 950":        ("#050505", "#F0F0F5"),
    "Forge 900":        ("#0A0A0F", "#F0F0F5"),
    "Forge 850":        ("#0F0F18", "#F0F0F5"),
    "Forge 800":        ("#16161F", "#F0F0F5"),
    "Forge 700":        ("#1E1E2A", "#F0F0F5"),
    "Forge 600":        ("#2A2A3A", "#F0F0F5"),
    "Text Primary":     ("#F0F0F5", "#0A0A0F"),
    "Text Secondary":   ("#A0A0B8", "#0A0A0F"),
    "Text Muted":       ("#5C5C78", "#0A0A0F"),
    "T1 (Emerald)":     ("#00E676", "#050505"),
    "T2 (Cyan)":        ("#40C4FF", "#050505"),
    "T3 (Purple)":      ("#7C3AED", "#F0F0F5"),
}

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_color_palette(outfile, width=1200, swatch_h=140):
    """Full-width color palette swatch."""
    n = len(COLORS)
    img = Image.new("RGB", (width, n * swatch_h + 60), hex_to_rgb("#0A0A0F"))
    d = ImageDraw.Draw(img)

    font_size = max(14, min(20, 900 // max(len(k) for k in COLORS)))
    try:
        fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        fnt_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", max(11, font_size - 3))
    except Exception:
        fnt = ImageFont.load_default()
        fnt_sm = fnt

    y = 0
    for name, (fg_hex, _) in COLORS.items():
        bg = hex_to_rgb(fg_hex)
        d.rectangle([0, y, width, y + swatch_h], fill=bg)

        # Color name + hex code
        d.text((20, y + 12), name, font=fnt, fill=(255, 255, 255, 200) if bg[0] < 180 else (0, 0, 0, 200))
        d.text((20, y + 42), fg_hex.upper(), font=fnt_sm, fill=(255, 255, 255, 130) if bg[0] < 180 else (0, 0, 0, 130))

        # Contrast indicator
        r, g, b = bg
        luma = 0.299*r + 0.587*g + 0.114*b
        label = "dark text" if luma > 128 else "light text"
        d.text((width - 160, y + swatch_h // 2 - 8), label, font=fnt_sm, fill=(200, 200, 200))

        y += swatch_h

    # Header
    d.rectangle([0, 0, width, 55], fill=hex_to_rgb("#0F0F18"))
    d.text((20, 16), "SOLFOUNDRY — Brand Color Palette", font=fnt, fill=hex_to_rgb("#00E676"))

    img.save(outfile, "PNG", optimize=True)
    sz = os.path.getsize(outfile)
    print(f"Palette: {outfile} ({sz//1024}KB)")

def draw_type_specimen(outfile, width=1200):
    """Typography specimen sheet."""
    img = Image.new("RGB", (width, 700), hex_to_rgb("#0A0A0F"))
    d = ImageDraw.Draw(img)

    try:
        # Try to find usable fonts
        import subprocess
        result = subprocess.run(["fc-list", ":family=Inter"], capture_output=True, text=True)
        inter_paths = result.stdout.strip().split("\n")
        inter_path = inter_paths[0].split(":")[0] if inter_paths else None

        result2 = subprocess.run(["fc-list", ":family=Orbitron"], capture_output=True, text=True)
        orbit_paths = result2.stdout.strip().split("\n")
        orbit_path = orbit_paths[0].split(":")[0] if orbit_paths else None

        result3 = subprocess.run(["fc-list", ":family=JetBrains"], capture_output=True, text=True)
        mono_paths = result3.stdout.strip().split("\n")
        mono_path = mono_paths[0].split(":")[0] if mono_paths else None
    except Exception:
        inter_path = orbit_path = mono_path = None

    def font(path, size):
        if path:
            try: return ImageFont.truetype(path, size)
            except: pass
        return ImageFont.load_default()

    fnt_head = font(orbit_path, 36)
    fnt_title = font(inter_path, 26) if inter_path else font(None, 24)
    fnt_body = font(inter_path, 18) if inter_path else font(None, 16)
    fnt_sm = font(inter_path, 14) if inter_path else font(None, 13)
    fnt_mono = font(mono_path, 16) if mono_path else font(None, 14)

    # Header
    d.rectangle([0, 0, width, 55], fill=hex_to_rgb("#0F0F18"))
    d.text((20, 16), "TYPOGRAPHY SPECIMEN", font=fnt_head, fill=hex_to_rgb("#00E676"))

    y = 75

    # Orbitron specimen
    d.text((20, y), "Orbitron — Display / Hero", font=fnt_sm, fill=hex_to_rgb("#A0A0B8"))
    y += 32
    d.text((20, y), "BUILD THE OPEN WEB", font=fnt_head, fill=hex_to_rgb("#F0F0F5"))
    y += 56
    d.text((20, y), "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 !@#$%", font=fnt_body, fill=hex_to_rgb("#A0A0B8"))
    y += 45

    # Divider
    d.line([(20, y), (width-20, y)], fill=hex_to_rgb("#1E1E2A"), width=1)
    y += 20

    # Inter specimen
    d.text((20, y), "Inter — Body / UI", font=fnt_sm, fill=hex_to_rgb("#A0A0B8"))
    y += 32
    d.text((20, y), "SolFoundry is where builders ship, earn, and grow.", font=fnt_title, fill=hex_to_rgb("#F0F0F5"))
    y += 38
    sample = "The quick brown fox jumps over the lazy dog. 0123456789"
    d.text((20, y), sample, font=fnt_body, fill=hex_to_rgb("#A0A0B8"))
    y += 30
    d.text((20, y), sample.upper(), font=fnt_sm, fill=hex_to_rgb("#5C5C78"))
    y += 45

    d.line([(20, y), (width-20, y)], fill=hex_to_rgb("#1E1E2A"), width=1)
    y += 20

    # JetBrains Mono specimen
    d.text((20, y), "JetBrains Mono — Code / Addresses", font=fnt_sm, fill=hex_to_rgb("#A0A0B8"))
    y += 32
    mono_sample = "7UqBdYyy9LG59Un6yzjAW8HPcTC4J63B9cZxBHWhhBHPXK7Y  0x1a2b...9f3c  tx: 4jKY93..."
    d.text((20, y), mono_sample, font=fnt_mono, fill=hex_to_rgb("#00E676"))
    y += 30
    code_sample = "const bounty = await api.getBounty({ id: '#827' });"
    d.text((20, y), code_sample, font=fnt_mono, fill=hex_to_rgb("#A78BFA"))

    img.save(outfile, "PNG", optimize=True)
    sz = os.path.getsize(outfile)
    print(f"Typography: {outfile} ({sz//1024}KB)")

def draw_tier_badges(outfile, width=800):
    """Tier badge showcase."""
    img = Image.new("RGB", (width, 300), hex_to_rgb("#0A0A0F"))
    d = ImageDraw.Draw(img)

    tiers = [
        ("T1", "#00E676", "Open Race"),
        ("T2", "#40C4FF", "Assigned"),
        ("T3", "#7C3AED", "Invitational"),
    ]

    x = 40
    for label, color, desc in tiers:
        c = hex_to_rgb(color)
        # Badge
        d.rounded_rectangle([x, 40, x+100, 100], radius=50, fill=c)
        fnt = ImageFont.load_default()
        try:
            fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        except:
            pass
        d.text((x+50, 56), label, font=fnt, fill=(0, 0, 0), anchor="mm")
        # Label below
        fnt_sm = ImageFont.load_default()
        d.text((x+50, 120), desc, font=fnt_sm, fill=hex_to_rgb("#A0A0B8"), anchor="mm")
        # Hex
        d.text((x+50, 145), color, font=fnt_sm, fill=hex_to_rgb("#5C5C78"), anchor="mm")
        x += 160

    # Header
    d.rectangle([0, 0, width, 35], fill=hex_to_rgb("#0F0F18"))
    d.text((20, 10), "TIER BADGES", font=ImageFont.load_default(), fill=hex_to_rgb("#00E676"))

    img.save(outfile, "PNG", optimize=True)
    sz = os.path.getsize(outfile)
    print(f"Tier badges: {outfile} ({sz//1024}KB)")


if __name__ == "__main__":
    draw_color_palette(f"{OUT}/color-palette.png")
    draw_type_specimen(f"{OUT}/typography-specimen.png")
    draw_tier_badges(f"{OUT}/tier-badges.png")
    print("All brand assets generated.")
