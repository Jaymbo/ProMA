#!/usr/bin/env python3
"""Erzeugt PWA-Icons (192/512, any + maskable) aus einem Map-Pin-Design."""
from PIL import Image, ImageDraw
import math
import os

STATIC = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(STATIC, exist_ok=True)

BLUE = (26, 115, 232)  # theme_color #1a73e8


def draw_icon(size: int, inner_scale: float) -> Image.Image:
    """inner_scale < 1 = kleineres Motiv (maskable safe zone)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Runder blauer Hintergrund
    d.ellipse([0, 0, size - 1, size - 1], fill=BLUE)

    s = size * inner_scale
    cx, cy = size / 2, size / 2
    pin_w = s * 0.62          # Breite des Pins
    pin_h = s * 0.80          # Gesamthöhe (Kreis + Spitze)
    head_r = pin_w / 2        # Radius des Pin-Kopfes
    head_cy = cy - pin_h / 2 + head_r  # Zentrum des Kopfes

    # Pin-Silhouette: Kreis + Dreieck-Spitze (etwas überlappend, nahtlos weiß)
    overlap = head_r * 0.12
    d.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r], fill="white")
    tip_y = cy + pin_h / 2
    d.polygon(
        [
            (cx - head_r * 0.78, head_cy + head_r * 0.62 - overlap),
            (cx + head_r * 0.78, head_cy + head_r * 0.62 - overlap),
            (cx, tip_y),
        ],
        fill="white",
    )

    # Loch im Pin-Kopf (blau, mit Außenfarbe für Transparenz-Anmutung)
    hole_r = head_r * 0.42
    d.ellipse(
        [cx - hole_r, head_cy - hole_r, cx + hole_r, head_cy + hole_r], fill=BLUE
    )
    return img


for size in (192, 512):
    # "any": Motiv füllt die Kante etwas mehr
    draw_icon(size, 0.82).save(os.path.join(STATIC, f"icon-{size}.png"))
    # "maskable": Safe-Zone (Motiv max. ~66% des Randes)
    draw_icon(size, 0.62).save(os.path.join(STATIC, f"icon-{size}-maskable.png"))

# favicon.svg: gleiche Optik als Vektor
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="256" fill="#1a73e8"/>
  <circle cx="256" cy="211" r="99" fill="#fff"/>
  <path d="M 178 272 L 334 272 L 256 415 Z" fill="#fff"/>
  <circle cx="256" cy="211" r="42" fill="#1a73e8"/>
</svg>
'''
with open(os.path.join(STATIC, "favicon.svg"), "w") as f:
    f.write(svg)

print("Icons erstellt:", os.listdir(STATIC))
