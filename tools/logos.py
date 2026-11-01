"""Bereitet Hersteller-Logos für die Knöpfe auf: Hintergrund freistellen, zuschneiden, verkleinern.
Aufruf: python3 tools/logos.py <quelle> <ziel.png> <modus>
Modi: weiss (weissen Hintergrund entfernen), kachel (als abgerundete Kachel), zuschnitt (Inhalt auf Farbfläche eng zuschneiden)."""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

MAX = 256  # Höhe bzw. Breite in Pixeln (reicht für die Knöpfe auf HiDPI-Bildschirmen)


def remove_white(im, thresh=60):
    im = im.convert('RGBA')
    w, h = im.size
    marker = (255, 0, 255, 0)
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if im.getpixel(xy)[3] and min(im.getpixel(xy)[:3]) > 230:
            ImageDraw.floodfill(im, xy, marker, thresh=thresh)
    px = im.load()
    transparent = Image.new('L', im.size, 0)
    tp = transparent.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == marker:
                px[x, y] = (0, 0, 0, 0)
                tp[x, y] = 255
    # Hellen Rand (Kantenglättung gegen Weiss) an den freigestellten Stellen abschwächen
    edge = transparent.filter(ImageFilter.MaxFilter(5))
    ep = edge.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and ep[x, y] and not tp[x, y]:
                light = min(r, g, b)
                if light > 170:
                    px[x, y] = (r, g, b, int(a * max(0, 255 - light) / 85))
    return im.crop(im.getbbox())


def rounded(im, radius_ratio=0.16):
    im = im.convert('RGBA')
    mask = Image.new('L', im.size, 0)
    r = int(min(im.size) * radius_ratio)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    im.putalpha(mask)
    return im


def tight_crop(im, margin=0.06):
    rgb = im.convert('RGB')
    bg = Image.new('RGB', rgb.size, rgb.getpixel((2, 2)))
    diff = ImageChops.difference(rgb, bg).convert('L').point(lambda v: 255 if v > 90 else 0)
    x0, y0, x1, y1 = diff.getbbox()
    m = int(max(x1 - x0, y1 - y0) * margin)
    return rgb.crop((max(0, x0 - m), max(0, y0 - m), min(rgb.width, x1 + m), min(rgb.height, y1 + m)))


def main(src, dst, mode):
    im = Image.open(src)
    if mode == 'weiss':
        im = remove_white(im)
    elif mode == 'kachel':
        im = rounded(im)
    elif mode == 'zuschnitt':
        im = rounded(tight_crop(im), 0.12)
    im.thumbnail((MAX * 3, MAX), Image.LANCZOS)  # Höhe begrenzen, breite Logos dürfen breiter sein
    im.save(dst, optimize=True)
    print(dst, im.size)


if __name__ == '__main__':
    main(*sys.argv[1:4])
