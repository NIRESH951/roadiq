"""Procedural demo illustrations for seeded records.

These are NOT photographs and NOT model output. Each image carries a visible
"DEMO ILLUSTRATION" label. Live records use the real uploaded photo instead.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 640, 400


def _save(img: Image.Image, path: Path) -> None:
    """Write the illustration, unless the folder is read-only (e.g. on Vercel) and the shipped copy already exists.
    The detection box is computed while drawing, so it is identical either way."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path, quality=80, optimize=True)
    except OSError:
        if not path.is_file():
            raise


def _rng(key: str) -> random.Random:
    return random.Random(sum((i + 1) * ord(c) for i, c in enumerate(key)))


def _asphalt(rng: random.Random) -> Image.Image:
    base = Image.new("RGB", (W, H), (60, 61, 66))
    noise = Image.effect_noise((W, H), 28).convert("RGB")
    img = Image.blend(base, noise, 0.16)
    d = ImageDraw.Draw(img)
    for _ in range(3200):
        x, y = rng.randrange(W), rng.randrange(H)
        c = rng.randint(72, 128)
        d.point((x, y), fill=(c, c, c + 3))
    lane_x = int(W * 0.12)
    for y0 in range(-30, H, 100):
        d.rectangle([lane_x, y0, lane_x + 11, y0 + 55], fill=(214, 212, 200))
    return img.filter(ImageFilter.GaussianBlur(0.7))


def _label(img: Image.Image, text: str) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    try:
        font = ImageFont.load_default(size=15)
    except TypeError:  # Pillow < 10.1
        font = ImageFont.load_default()
    d.rectangle([0, H - 30, W, H], fill=(5, 12, 26, 200))
    d.text((12, H - 24), text, fill=(150, 220, 255, 255), font=font)


def _pothole(d: ImageDraw.ImageDraw, rng: random.Random, cx: float, cy: float, sev: float):
    r = 34 + 70 * sev
    pts = []
    for k in range(18):
        a = 2 * math.pi * k / 18
        rr = r * rng.uniform(0.78, 1.15)
        pts.append((cx + rr * math.cos(a), cy + 0.62 * rr * math.sin(a)))
    d.polygon(pts, fill=(30, 29, 32), outline=(104, 102, 100), width=4)
    inner = [(cx + (x - cx) * 0.62, cy + (y - cy) * 0.62) for x, y in pts]
    d.polygon(inner, fill=(44, 50, 60))
    for _ in range(40):
        gx, gy = cx + rng.uniform(-r * 0.6, r * 0.6), cy + rng.uniform(-r * 0.3, r * 0.3)
        g = rng.randint(70, 110)
        d.ellipse([gx, gy, gx + 3, gy + 2], fill=(g, g, g))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs) - 6, min(ys) - 6, max(xs) + 6, max(ys) + 6


def _crack_line(d, rng, start, end, steps, width):
    pts = [start]
    for s in range(1, steps):
        f = s / steps
        x = start[0] + (end[0] - start[0]) * f + rng.uniform(-9, 9)
        y = start[1] + (end[1] - start[1]) * f + rng.uniform(-9, 9)
        pts.append((x, y))
    pts.append(end)
    d.line(pts, fill=(22, 22, 24), width=width, joint="curve")
    return pts


def _bbox(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs) - 8, min(ys) - 8, max(xs) + 8, max(ys) + 8


def _longitudinal(d, rng, cx, cy, sev):
    length = 140 + 200 * sev
    pts = _crack_line(d, rng, (cx, cy - length / 2), (cx + rng.uniform(-30, 30), cy + length / 2), 14, 4)
    for _ in range(3):
        p = rng.choice(pts[2:-2])
        pts += _crack_line(d, rng, p, (p[0] + rng.uniform(-40, 40), p[1] + rng.uniform(10, 40)), 4, 2)
    return _bbox(pts)


def _transverse(d, rng, cx, cy, sev):
    length = 180 + 220 * sev
    pts = _crack_line(d, rng, (cx - length / 2, cy), (cx + length / 2, cy + rng.uniform(-25, 25)), 16, 4)
    for _ in range(3):
        p = rng.choice(pts[2:-2])
        pts += _crack_line(d, rng, p, (p[0] + rng.uniform(10, 40), p[1] + rng.uniform(-35, 35)), 4, 2)
    return _bbox(pts)


def _alligator(d, rng, cx, cy, sev):
    w, h = 150 + 140 * sev, 90 + 90 * sev
    cols, rows = 6, 4
    grid = [[(cx - w / 2 + w * i / cols + rng.uniform(-8, 8), cy - h / 2 + h * j / rows + rng.uniform(-8, 8))
             for i in range(cols + 1)] for j in range(rows + 1)]
    for j in range(rows + 1):
        d.line(grid[j], fill=(24, 24, 26), width=3)
    for i in range(cols + 1):
        d.line([grid[j][i] for j in range(rows + 1)], fill=(24, 24, 26), width=3)
    pts = [p for row in grid for p in row]
    return _bbox(pts)


DRAWERS = {
    "pothole": _pothole,
    "longitudinal_crack": _longitudinal,
    "transverse_crack": _transverse,
    "alligator_crack": _alligator,
}


def _centre(rng: random.Random) -> tuple[float, float]:
    return rng.uniform(W * 0.38, W * 0.66), rng.uniform(H * 0.4, H * 0.58)


def render_defect(defect_id: str, damage_type: str, severity: float, out_dir: Path) -> list[float]:
    """Draw an illustrative image; return the normalised [x, y, w, h] box of the drawn damage."""
    rng = _rng(defect_id)
    img = _asphalt(rng)
    d = ImageDraw.Draw(img)
    cx, cy = _centre(rng)
    x0, y0, x1, y1 = DRAWERS[damage_type](d, rng, cx, cy, severity)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H - 32, y1)
    _label(img, f"DEMO ILLUSTRATION · {defect_id} · not a real photograph")
    _save(img, out_dir / f"{defect_id}.jpg")
    return [round(x0 / W, 4), round(y0 / H, 4), round((x1 - x0) / W, 4), round((y1 - y0) / H, 4)]


def render_repair(repair_id: str, defect_id: str, bbox: list[float], out_dir: Path) -> None:
    """Same scene as the defect illustration, with a patch drawn over the damage box."""
    rng = _rng(defect_id)
    img = _asphalt(rng)
    d = ImageDraw.Draw(img)
    x, y, w, h = bbox
    px0, py0, px1, py1 = x * W - 10, y * H - 10, (x + w) * W + 10, (y + h) * H + 10
    d.rectangle([px0, py0, px1, py1], fill=(40, 41, 45), outline=(88, 88, 90), width=3)
    _label(img, f"DEMO ILLUSTRATION · {repair_id} after repair · not a real photograph")
    _save(img, out_dir / f"{repair_id}.jpg")
