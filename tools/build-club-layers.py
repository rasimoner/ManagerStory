#!/usr/bin/env python3
"""Builds the club-identity layers for the press room, locker room and stadium.

Each scene ships as:
  <scene>-club-a.webp      alpha mask of the surfaces that carry the PRIMARY colour
  <scene>-club-b.webp      alpha mask of the surfaces that carry the SECONDARY colour
  <scene>-club-shade.webp  black/white alpha layer that restores light and texture on those surfaces
plus, for press/locker, a colour-neutral base photo (<scene>-club-base.webp).

No club colour is baked in. The game paints --club-primary / --club-secondary
through the masks at runtime (CSS mask-image, plain alpha compositing).

usage: build-club-layers.py <press.png> <locker.png> [--preview DIR]
"""
import sys, os, colorsys
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'dist', 'assets', 'atmosphere')


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hsv(rgb):
    r, g, b = [rgb[..., i] for i in range(3)]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2 + rc - bc, 4 + gc - rc))
    h = (h / 6.0) % 1.0
    return h * 360.0, s, mx


def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im).astype('float32') / 255.0


def save_rgba(path, rgb_val, alpha, lossless=True):
    h, w = alpha.shape
    arr = np.zeros((h, w, 4), 'uint8')
    arr[..., :3] = rgb_val if np.ndim(rgb_val) == 3 else int(rgb_val)
    arr[..., 3] = (np.clip(alpha, 0, 1) * 255).astype('uint8')
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', lossless=lossless, quality=90, method=6)


def shade_layer(L, wa, wb):
    """Black/white overlay that gives the flat club colour the original light and texture."""
    u = np.maximum(wa, wb)
    l0 = []
    for w in (wa, wb):
        sel = w > 0.9
        l0.append(float(np.median(L[sel])) if sel.any() else 0.5)
    ref = np.where(wa >= wb, max(l0[0], 1e-3), max(l0[1], 1e-3))
    r = np.where(u > 0.02, L / ref, 1.0)
    dark = np.clip(1 - r, 0, 0.82)
    bright = np.clip((r - 1) * 0.55, 0, 0.45)
    a = np.where(r < 1, dark, bright) * u
    val = np.where(r < 1, 0, 255).astype('uint8')
    return np.repeat(val[..., None], 3, -1), a


def photo_scene(name, src, crop=None, seam=False, min_blob=False):
    im = Image.open(src).convert('RGB')
    if crop:
        im = im.crop(crop)
    if im.width != 1536:
        im = im.resize((1536, round(im.height * 1536 / im.width)), Image.LANCZOS)
    rgb = np.asarray(im).astype('float32') / 255.0
    h, s, v = hsv(rgb)
    L = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # primary = saturated yellow/gold surfaces, secondary = saturated red/burgundy surfaces
    wa = smooth(s, 0.5, 0.72) * smooth(h, *((22, 28) if seam else (33, 36))) * (1 - smooth(h, 64, 74)) * smooth(v, 0.4, 0.55)
    red = np.where(h > 100, smooth(h, 338, 344), 1 - smooth(h, *((23, 29) if seam else (10, 15))))
    wb = smooth(s, 0.4, 0.58) * red * smooth(v, 0.16, 0.28)
    wa, wb = blur(wa, 0.8), blur(wb, 0.8)
    # fill bright, washed-out light pools that sit inside a painted surface
    wa = np.maximum(wa, smooth(blur(wa, 7), 0.55, 0.9) * (s < 0.75) * (v > 0.55))
    wb = np.maximum(wb, smooth(blur(wb, 7), 0.55, 0.9) * (s < 0.75) * (v > 0.55))
    if min_blob:  # drop small warm highlights (hooks, lamps) that are not painted surfaces
        wa = wa * smooth(blur(wa, 4), 0.45, 0.7)
        wb = wb * smooth(blur(wb, 4), 0.45, 0.7)
    wa = np.clip(wa * 1.15, 0, 1)
    wb = np.clip(wb * 1.15, 0, 1)
    u = np.maximum(wa, wb)[..., None]
    neutral = rgb * (1 - u) + L[..., None] * u
    Image.fromarray((neutral * 255).astype('uint8')).save(os.path.join(OUT, f'{name}-club-base.webp'), 'WEBP', quality=84, method=6)
    save_rgba(os.path.join(OUT, f'{name}-club-a.webp'), 0, wa)
    save_rgba(os.path.join(OUT, f'{name}-club-b.webp'), 0, wb)
    val, a = shade_layer(L, wa, wb)
    save_rgba(os.path.join(OUT, f'{name}-club-shade.webp'), val, a)
    return neutral, wa, wb, val, a


def stadium_scene():
    """The stadium base is an empty, colour-neutral stand. Club surfaces are added as
    believable physical elements only: supporter blocks in the seating bowls and the
    pitch-side advertising boards. Pitch, roof, floodlights and sky stay untouched."""
    im = Image.open(os.path.join(OUT, 'stadium-base.webp')).convert('RGB')
    W, H = im.size
    rgb = np.asarray(im).astype('float32') / 255.0
    L = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    h, s, v = hsv(rgb)
    yy, xx = np.mgrid[0:H, 0:W]
    rng = np.random.default_rng(73)

    # seating bowls (rows, full-res) -- dark seat pixels only; aisles, lights, roof are excluded
    upper = (yy > 176) & (yy < 272)
    lower = (yy > 296) & (yy < 344)
    seat = (L < 0.40) & (s < 0.5)
    seat = blur(seat.astype('float32'), 1.2)
    seat = smooth(seat, 0.55, 0.9)

    # supporter sections: alternating primary / secondary blocks that differ per tier
    def sections(offset, width):
        idx = ((xx + offset) // width).astype(int)
        return idx % 2

    secA_up = sections(0, 118)
    secA_lo = sections(59, 96)
    blocks = np.where(upper, secA_up, secA_lo)  # 0 -> primary, 1 -> secondary
    # crowd texture: dense small blobs (people/shirts/flags) so the seats read as a crowd
    noise = rng.random((H, W)).astype('float32')
    crowd = blur(noise, 1.1)
    crowd = smooth(crowd, 0.47, 0.60)
    bowl = np.where(upper | lower, 1.0, 0.0) * seat
    fill = bowl * crowd * 0.9
    wa = fill * (blocks == 0)
    wb = fill * (blocks == 1)

    # pitch-side advertising boards along the stand wall
    board_rows = (yy >= 344) & (yy <= 357)
    goal = (xx > 872) & (xx < 980)
    seg = ((xx // 84) % 2)
    board = board_rows & ~goal
    softrow = smooth(1 - np.abs(yy - 350.5) / 7.0, 0.05, 0.5)
    wa = np.maximum(wa, board * (seg == 0) * softrow * 0.95)
    wb = np.maximum(wb, board * (seg == 1) * softrow * 0.95)
    wa = np.clip(wa, 0, 1).astype('float32')
    wb = np.clip(wb, 0, 1).astype('float32')

    save_rgba(os.path.join(OUT, 'stadium-club-a.webp'), 0, wa)
    save_rgba(os.path.join(OUT, 'stadium-club-b.webp'), 0, wb)
    # shade: crowd keeps some depth; boards stay fairly flat and lit
    u = np.maximum(wa, wb)
    lum_noise = blur(rng.random((H, W)).astype('float32'), 2.0)
    dark = np.clip(0.28 + (0.5 - lum_noise) * 0.9 + (0.32 - np.clip(L, 0, .32)) * 0.6, 0.05, 0.7)
    val = np.zeros((H, W, 3), 'uint8')
    save_rgba(os.path.join(OUT, 'stadium-club-shade.webp'), val, dark * u)
    return rgb, wa, wb, val, dark * u


def composite(base, wa, wb, val, a, pa, pb):
    """Same alpha maths the browser performs: base -> primary -> secondary -> shade."""
    out = base.copy()
    for w, c in ((wa, pa), (wb, pb)):
        col = np.array(c, 'float32') / 255.0
        out = out * (1 - w[..., None]) + col * w[..., None]
    v = val.astype('float32') / 255.0
    return out * (1 - a[..., None]) + v * a[..., None]


def hexrgb(hx):
    hx = hx.lstrip('#')
    if len(hx) == 3:
        hx = ''.join(c * 2 for c in hx)
    return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))


if __name__ == '__main__':
    press_src, locker_src = sys.argv[1], sys.argv[2]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    scenes = {
        'press': photo_scene('press', press_src, seam=True),
        'locker': photo_scene('locker', locker_src, crop=(10, 0, 1536, 676), min_blob=True),
        'stadium': stadium_scene(),
    }
    if prev:
        os.makedirs(prev, exist_ok=True)
        clubs = {'AnadoluHisari': ('#f3c623', '#b3132b'), 'Kiyispor': ('#0b7285', '#ffdd57'),
                 'MarmaraA': ('#1746a2', '#ff7a00'), 'Kadikoy': ('#6a1b9a', '#f7d117'), 'Neutral': ('#55646b', '#d8dedc')}
        for scene, (base, wa, wb, val, a) in scenes.items():
            for cname, (p, s2) in clubs.items():
                img = composite(base, wa, wb, val, a, hexrgb(p), hexrgb(s2))
                Image.fromarray((np.clip(img, 0, 1) * 255).astype('uint8')).save(os.path.join(prev, f'{scene}_{cname}.png'))
