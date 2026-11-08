"""Bato app icon + splash generator.

The Bato mark is a retro outdoor badge: a teal circle with a striped orange sun setting behind
two cream peaks, and a winding road (बाटो = "the path") leading into them, on a cream background.

Run from mobile/:   uv run --with resvg-py python assets/brand/make_icons.py
Writes the SVG sources to assets/brand/ and the PNGs that app.json uses to assets/images/.
Then rebuild the native app:  npx expo run:android
"""

from pathlib import Path

import resvg_py

HERE = Path(__file__).resolve().parent
IMAGES = HERE.parent / "images"

CREAM = "#F6EAD3"
CREAM_SHADE = "#E2CDA6"
TEAL = "#1F6F78"
TEAL_DARK = "#174F55"
ORANGE = "#F28C38"

# The badge is drawn on a 1024 canvas around (512, 512) with outer radius 370.
BADGE_RADIUS = 370
WINDOW = '<circle cx="512" cy="512" r="330"/>'
SUN = '<circle cx="512" cy="600" r="200"/>'
# Retro sunset stripes, visible in the valley between the peaks.
SUN_STRIPES = [(500, 7), (528, 10), (556, 13)]
PEAKS = "150,700 380,450 500,580 640,410 880,700"
PEAK_SHADES = ["640,410 880,700 740,700 680,520", "380,450 500,580 440,700 400,560"]
GROUND = '<rect x="150" y="696" width="730" height="220"/>'
ROAD = "M 450 900 C 600 830, 420 770, 540 700"


def badge(mono: bool = False) -> str:
    """The badge at its design size (outer radius 370, centred on 512, 512)."""
    if mono:
        # Android 13 themed icon: one colour + alpha. A solid disc with the inner ring line,
        # the peaks and the road cut out, and the sun at half strength.
        return f"""
          <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <rect width="1024" height="1024" fill="white"/>
            <circle cx="512" cy="512" r="342" fill="none" stroke="black" stroke-width="12"/>
            <g clip-path="url(#window)">
              <circle cx="512" cy="600" r="200" fill="#808080"/>
              <polygon points="{PEAKS}" fill="black"/>
              <g fill="white">{GROUND}</g>
              <path d="{ROAD}" fill="none" stroke="black" stroke-width="26" stroke-linecap="round"/>
            </g>
          </mask>
          <circle cx="512" cy="512" r="{BADGE_RADIUS}" fill="#FFFFFF" mask="url(#cut)"/>
        """
    stripes = "".join(
        f'<rect x="300" y="{y}" width="424" height="{h}" fill="{TEAL}"/>' for y, h in SUN_STRIPES
    )
    shades = "".join(f'<polygon points="{p}" fill="{CREAM_SHADE}"/>' for p in PEAK_SHADES)
    return f"""
      <circle cx="512" cy="512" r="{BADGE_RADIUS}" fill="{TEAL}"/>
      <circle cx="512" cy="512" r="342" fill="none" stroke="{CREAM}" stroke-width="10"/>
      <g clip-path="url(#window)">
        <g fill="{ORANGE}">{SUN}</g>{stripes}
        <polygon points="{PEAKS}" fill="{CREAM}"/>{shades}
        <g fill="{TEAL_DARK}">{GROUND}</g>
        <path d="{ROAD}" fill="none" stroke="{CREAM}" stroke-width="24" stroke-linecap="round"/>
      </g>
    """


def mark(radius: float, mono: bool = False) -> str:
    """The badge scaled so its outer edge has the given radius (px on the 1024 canvas)."""
    s = radius / BADGE_RADIUS
    return f'<g transform="translate(512 512) scale({s}) translate(-512 -512)">{badge(mono)}</g>'


def svg(content: str, background: str | None = None) -> str:
    bg = f'<rect width="1024" height="1024" fill="{background}"/>' if background else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
        f'<defs><clipPath id="window">{WINDOW}</clipPath></defs>{bg}{content}</svg>'
    )


# Android adaptive icons: 108dp canvas, only the centre 66dp circle (r = 0.305) is always visible.
ADAPTIVE_SAFE = 0.295 * 1024
# Android 12+ splash: the image is masked to a circle of radius 1/3 of its width.
SPLASH_SAFE = 0.32 * 1024

SOURCES = {
    # iOS + generic icon: full-bleed square, no transparency (iOS rounds the corners itself).
    "icon": svg(mark(BADGE_RADIUS), background=CREAM),
    "android-icon-foreground": svg(mark(ADAPTIVE_SAFE)),
    "android-icon-background": svg("", background=CREAM),
    "android-icon-monochrome": svg(mark(ADAPTIVE_SAFE, mono=True)),
    "splash-icon": svg(mark(SPLASH_SAFE)),
}

SIZES = {
    "icon": [("icon.png", 1024), ("favicon.png", 48)],
    "android-icon-foreground": [("android-icon-foreground.png", 1024)],
    "android-icon-background": [("android-icon-background.png", 1024)],
    "android-icon-monochrome": [("android-icon-monochrome.png", 1024)],
    "splash-icon": [("splash-icon.png", 1024)],
}


def main() -> None:
    for name, source in SOURCES.items():
        (HERE / f"{name}.svg").write_text(source)
        for filename, size in SIZES[name]:
            png = resvg_py.svg_to_bytes(svg_string=source, width=size, height=size)
            (IMAGES / filename).write_bytes(bytes(png))
            print(f"wrote assets/images/{filename} ({size}x{size})")


if __name__ == "__main__":
    main()
