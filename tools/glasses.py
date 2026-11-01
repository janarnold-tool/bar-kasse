"""Erzeugt die Glas-Symbole für Getränke ohne Hersteller-Logo (public/logos/*.svg).
Gleiche Bildsprache für alle: Glasform zeigt die Art, Füllfarbe das Getränk."""
import os

GLASS = '#e9eef5'  # Glaskontur, hell, gut sichtbar auf den dunklen Knöpfen
OUT = 'public/logos'


def svg(body, defs='', view='8 3 48 55'):
    # Enger Bildausschnitt, damit die Gläser im Knopf etwa so gross wirken wie die Logos
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"><defs>{defs}</defs>{body}</svg>\n'


def zero_badge():
    return ('<circle cx="46" cy="13" r="9.5" fill="#2e9e52" stroke="#14161c" stroke-width="2"/>'
            '<text x="46" y="17" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" '
            'text-anchor="middle" fill="#fff">0%</text>')


def wine(fill, extra=''):
    # Weinglas: Kelch, Stiel, Fuss
    return (f'<path d="M20 8 H44 C45 22 42 33 32 35 C22 33 19 22 20 8 Z" fill="none" stroke="{GLASS}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<path d="M21.2 18 H42.8 C42 27 39 32.4 32 33.4 C25 32.4 22 27 21.2 18 Z" fill="{fill}"/>'
            f'<path d="M32 35 V52 M22 55 H42" stroke="{GLASS}" stroke-width="2.5" stroke-linecap="round"/>' + extra)


def highball(fill, extra=''):
    return (f'<path d="M19 8 L22 56 H42 L45 8" fill="none" stroke="{GLASS}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<path d="M20.4 22 L22.9 54 H41.1 L43.6 22 Z" fill="{fill}"/>' + extra)


def tumbler(fill, extra=''):
    return (f'<path d="M15 16 L18 54 H46 L49 16" fill="none" stroke="{GLASS}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<path d="M16.3 28 L18.9 52 H45.1 L47.7 28 Z" fill="{fill}"/>' + extra)


def shot(fill, x=0, y=0, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<path d="M22 20 L25 52 H39 L42 20" fill="none" stroke="{GLASS}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<path d="M23.3 28 L25.9 50 H38.1 L40.7 28 Z" fill="{fill}"/></g>')


def bubbles(xs):
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" opacity=".9"/>' for x, y, r in xs)


LEAF = '<path d="M42 30 C49 23 54 24 54 24 C54 24 53 33 44 34 Z" fill="#3fae4f" stroke="#1d6b2a" stroke-width="1"/>'
LIME = '<circle cx="45" cy="12" r="8" fill="#9ccc3a" stroke="#4f7a12" stroke-width="1.5"/><path d="M45 4 V20 M37 12 H53 M39.5 6.5 L50.5 17.5 M50.5 6.5 L39.5 17.5" stroke="#e6f5c4" stroke-width="1"/>'
BOLT = '<path d="M35 26 L26 41 H32 L29 52 L39 36 H33 L36 26 Z" fill="#ffd400" stroke="#14161c" stroke-width="1.2" stroke-linejoin="round"/>'

ICONS = {
    'wasser-laut.svg': svg(tumbler('#7cc4f2', bubbles([(26, 46, 2.4), (33, 39, 1.8), (39, 47, 2.1), (29, 34, 1.5), (37, 32, 1.4), (42, 40, 1.6)]))),
    'wasser-still.svg': svg(tumbler('#7cc4f2')),
    'weisswein.svg': svg(wine('#f2dc7a')),
    'aperol-spritz.svg': svg(wine('#ff6a13', '<circle cx="44" cy="12" r="7" fill="#ff9a2e" stroke="#c44d00" stroke-width="1.5"/>')),
    'wildberry-lillet.svg': svg(wine('#c2185b', '<circle cx="40" cy="12" r="4" fill="#5b2a86"/><circle cx="47" cy="10" r="4" fill="#d81b60"/><circle cx="45" cy="17" r="4" fill="#3f51b5"/>')),
    'hugo.svg': svg(wine('#d6eda6', LEAF)),
    'hugo-alkoholfrei.svg': svg(wine('#d6eda6', LEAF) + zero_badge()),
    'gin-tonic.svg': svg(highball('#d3ecff', bubbles([(28, 46, 1.6), (35, 40, 1.4), (31, 32, 1.2)]) + LIME)),
    'turbo-tony.svg': svg(highball('#a8641c', BOLT)),
    'virgin-sunrise.svg': svg(highball('url(#sunrise)') + zero_badge(),
                              '<linearGradient id="sunrise" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb000"/><stop offset=".6" stop-color="#ff6d00"/><stop offset="1" stop-color="#d81b2a"/></linearGradient>'),
    'bluesblaster.svg': svg(shot('#2f6fe4', -12.8, -19.4, 1.4)),
    'shotbrettli.svg': svg(
        '<rect x="2" y="47" width="60" height="9" rx="2.5" fill="#b07a44" stroke="#6b4423" stroke-width="1.5"/>'
        + ''.join(shot(c, x, 8, 0.62) for x, c in zip([-12, 0, 12, 24, 36], ['#2f6fe4', '#c2185b', '#2f6fe4', '#c2185b', '#2f6fe4'])),
        view='0 12 64 46'),
}

for name, content in ICONS.items():
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(content)
print(len(ICONS), 'Symbole geschrieben')
