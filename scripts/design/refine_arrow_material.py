"""Refine touchdown geometry and unify the existing ink material.

Requires Pillow. Coordinates refer to the original 750 x 680 artwork.
The source remains intact so this treatment is repeatable, not cumulative.
"""
from pathlib import Path
from math import exp
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = Image.open(ROOT / 'public/vector-brush-arrow-soft-join.png').convert('RGBA')
assert source.size == (750, 680)

def field(x, y, cx, cy, sx, sy, slope=0):
    dx = x - cx
    dy = y - cy - slope * dx
    return exp(-0.5 * ((dx / sx) ** 2 + (dy / sy) ** 2))

# A local inverse warp compresses the rounded shoulder into a dragged ink
# landing. The touchdown centre and the entire loop remain in place.
mesh = []
def original_position(x, y):
    landing = field(x, y, 62, 620, 47, 38)
    sy = y + (y - 620) * .43 * landing
    sy += 5 * field(x, y, 92, 608, 33, 22)
    # Shorten the long right wing slightly: it should finish like a brush
    # lifting, rather than mirror the broad, horizontal left wing.
    sy += 12 * field(x, y, 671, 156, 15, 25)
    return x, sy
for top in range(0, 680, 5):
    for left in range(0, 750, 5):
        right, bottom = min(left + 5, 750), min(top + 5, 680)
        quad = sum((original_position(x, y) for x, y in
                    [(left, top), (left, bottom), (right, bottom), (right, top)]), ())
        mesh.append(((left, top, right, bottom), quad))
source = source.transform(source.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
pixels = source.load()
light_mask = Image.new('RGBA', source.size)
light_pixels = light_mask.load()
for y in range(source.height):
    for x in range(source.width):
        r, g, b, alpha = pixels[x, y]
        if not alpha:
            continue
        # Retain dense touchdown ink and release it into the dry connection.
        relief = 0.36 * field(x, y, 76, 605, 36, 13, -0.22)
        relief += 0.16 * field(x, y, 38, 612, 17, 19)
        relief += 0.13 * field(x, y, 104, 630, 35, 11, -0.28)
        # A little more pigment within the existing dry transition makes the
        # landing lead into the loop. Transparent gaps stay transparent.
        join = 0.17 * field(x, y, 210, 577, 75, 14, -0.36)
        join += 0.12 * field(x, y, 62, 632, 28, 10, -0.15)
        amount = alpha * (1 - relief) + join * alpha * (1 - alpha / 255)
        # Suppress the original central specular trough in the opaque tip.
        # Smoothstep leaves sparse dry edges alone; no invented hair texture.
        tip = field(x, y, 649, 120, 98, 122)
        interior = max(0, min(1, (alpha - 45) / 155))
        interior = interior * interior * (3 - 2 * interior)
        amount += (242 - amount) * .88 * tip * interior
        ink_alpha = round(max(0, min(255, amount)))
        # The source's smooth RGB highlight reads as polished metal. Compress
        # that highlight locally while preserving original pigment variation
        # and all transparent grain. No synthetic scratches or repeated noise.
        landing = field(x, y, 61, 619, 46, 24)
        matte = min(.9, .9 * tip + .65 * landing)
        r, g, b = [round(c * (1 - matte) + (43 + c * .23) * matte) for c in (r, g, b)]
        pixels[x, y] = (r, g, b, ink_alpha)
        # Match the light to actual pigment. Dry gaps remain open; sparse ink
        # receives less light, and the arrowhead quietly releases the glow.
        density = (ink_alpha / 255) ** 1.55
        tip_release = 1 - 0.32 * field(x, y, 686, 63, 53, 77)
        light_pixels[x, y] = (255, 255, 255, round(255 * density * tip_release))
source.save(ROOT / 'public/vector-brush-arrow-ink-depth.png', optimize=True)
light_mask.save(ROOT / 'public/vector-brush-arrow-light-mask.png', optimize=True)
