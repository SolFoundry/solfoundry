from __future__ import annotations


COLORS = {
    "ink": "#071015",
    "panel": "#0E1820",
    "panel_2": "#14222C",
    "muted": "#8EA3AE",
    "white": "#F4FFF9",
    "green": "#14F195",
    "violet": "#9945FF",
    "cyan": "#6EE7FF",
    "gold": "#FFD166",
    "pink": "#FF4FD8",
    "red": "#FF6B6B",
}


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def with_alpha(value: str, alpha: int) -> tuple[int, int, int, int]:
    r, g, b = hex_to_rgb(value)
    return r, g, b, alpha


def mix(a: str, b: str, amount: float) -> tuple[int, int, int]:
    ar, ag, ab = hex_to_rgb(a)
    br, bg, bb = hex_to_rgb(b)
    amount = max(0.0, min(1.0, amount))
    return (
        round(ar + (br - ar) * amount),
        round(ag + (bg - ag) * amount),
        round(ab + (bb - ab) * amount),
    )
