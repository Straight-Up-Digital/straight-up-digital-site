from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "brand-kit"
SVG_DIR = KIT / "masters"
PNG_DIR = KIT / "exports"
PUBLIC_BRAND = ROOT / "public" / "brand"
SCALE = 3

BG = "#080B0A"
SURFACE = "#101512"
SURFACE_2 = "#151B17"
LIME = "#B6FF36"
LIME_DARK = "#8EDB28"
WHITE = "#F5F7F4"
MUTED = "#A5ADA6"
LINE = "#28312B"

# Hand-authored angular S/forward-motion device. Coordinates are in a 180 x 160 viewBox.
TOP_RIBBON = [(15, 36), (42, 9), (119, 9), (153, 42), (132, 63), (112, 43), (59, 43), (43, 59), (43, 70), (78, 94), (56, 116), (15, 87)]
BOTTOM_RIBBON = [(165, 90), (165, 119), (137, 149), (58, 149), (24, 115), (46, 94), (65, 113), (122, 113), (138, 97), (138, 85), (101, 61), (123, 40)]
ARROW = [(21, 96), (91, 53), (78, 41), (157, 24), (140, 103), (125, 87), (44, 132)]

FONT_DIR = Path(r"C:\Windows\Fonts")
FONT_CANDIDATES = [
    (FONT_DIR / "Montserrat-Bold.ttf", FONT_DIR / "Montserrat-Regular.ttf"),
    (FONT_DIR / "montserrat-bold.ttf", FONT_DIR / "montserrat-regular.ttf"),
    (FONT_DIR / "arialbd.ttf", FONT_DIR / "arial.ttf"),
]
BOLD_FONT_PATH, REGULAR_FONT_PATH = next(
    ((bold, regular) for bold, regular in FONT_CANDIDATES if bold.exists() and regular.exists()),
    (FONT_DIR / "arialbd.ttf", FONT_DIR / "arial.ttf"),
)


def points(values: list[tuple[int, int]], x: float, y: float, size: float) -> str:
    scale = size / 160
    return " ".join(f"{x + px * scale:.2f},{y + py * scale:.2f}" for px, py in values)


def symbol_svg(background: str | None = None, mono: str | None = None) -> str:
    b = f'<rect width="180" height="160" rx="26" fill="{background}"/>' if background else ""
    if mono:
        top = bottom = arrow = mono
    else:
        top, bottom, arrow = "url(#metal)", "url(#metal)", "url(#lime)"
    defs = "" if mono else '''<defs>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F5F7F4"/><stop offset="1" stop-color="#A5ADA6"/>
      </linearGradient>
      <linearGradient id="lime" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#8EDB28"/><stop offset="1" stop-color="#B6FF36"/>
      </linearGradient>
    </defs>'''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="160" viewBox="0 0 180 160" role="img" aria-labelledby="title desc">
<title id="title">Straight Up Digital abstract S mark</title><desc id="desc">Angular silver S ribbons crossed by an upward lime signal stroke.</desc>{defs}{b}
<g stroke-linejoin="round"><polygon points="{points(TOP_RIBBON, 0, 0, 160)}" fill="{top}"/><polygon points="{points(BOTTOM_RIBBON, 0, 0, 160)}" fill="{bottom}"/><polygon points="{points(ARROW, 0, 0, 160)}" fill="{arrow}"/></g>
</svg>'''


def logo_svg(layout: str = "horizontal", variant: str = "light") -> str:
    if variant == "dark":
        bg, word, accent, icon_mono = "none", "#080B0A", "#4B7900", "#080B0A"
    elif variant == "mono-white":
        bg, word, accent, icon_mono = "none", "#F5F7F4", "#F5F7F4", "#F5F7F4"
    elif variant == "mono-dark":
        bg, word, accent, icon_mono = "none", "#080B0A", "#080B0A", "#080B0A"
    else:
        bg, word, accent, icon_mono = "none", "#F5F7F4", "#B6FF36", None
    icon = symbol_svg(mono=icon_mono)[symbol_svg(mono=icon_mono).find("<g"):symbol_svg(mono=icon_mono).find("</svg>")]
    defs = "" if icon_mono else '''<defs>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5F7F4"/><stop offset="1" stop-color="#A5ADA6"/></linearGradient>
      <linearGradient id="lime" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8EDB28"/><stop offset="1" stop-color="#B6FF36"/></linearGradient>
    </defs>'''
    if layout == "stacked":
        width, height = 520, 400
        scale = 1.38
        icon_group = f'<g transform="translate(170 20) scale({scale})">{icon}</g>'
        first = '<text x="260" y="300" text-anchor="middle" font-size="40" font-weight="700" letter-spacing="7">STRAIGHT UP</text>'
        second = f'<text x="260" y="350" text-anchor="middle" font-size="36" font-weight="700" letter-spacing="9" fill="{accent}">DIGITAL</text>'
    else:
        width, height = 720, 180
        icon_group = f'<g transform="translate(8 10) scale(1.0)">{icon}</g>'
        first = '<text x="205" y="77" font-size="37" font-weight="700" letter-spacing="5">STRAIGHT UP</text>'
        second = f'<text x="205" y="131" font-size="39" font-weight="700" letter-spacing="9" fill="{accent}">DIGITAL</text>'
    bg_rect = f'<rect width="{width}" height="{height}" rx="18" fill="{bg}"/>' if bg != "none" else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">STRAIGHT UP DIGITAL</title><desc id="desc">Straight Up Digital wordmark with an angular S symbol and rising lime accent.</desc>
<style>text{{font-family:Montserrat,Arial,sans-serif}}</style>{defs}{bg_rect}{icon_group}<g fill="{word}">{first}</g>{second}
</svg>'''


def pfont(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = BOLD_FONT_PATH if bold else REGULAR_FONT_PATH
    return ImageFont.truetype(str(path), size=size)


def draw_mark(canvas: Image.Image, x: int, y: int, size: int, variant: str = "colour", bg: str | None = None) -> None:
    draw = ImageDraw.Draw(canvas)
    factor = size / 160
    if bg:
        draw.rounded_rectangle((x, y, x + int(180 * factor), y + int(160 * factor)), radius=int(24 * factor), fill=bg)
    if variant == "mono-white":
        metal = lime = (245, 247, 244, 255)
    elif variant == "mono-dark":
        metal = lime = (8, 11, 10, 255)
    else:
        metal, lime = (207, 215, 209, 255), (182, 255, 54, 255)
    for poly, fill in [(TOP_RIBBON, metal), (BOTTOM_RIBBON, metal), (ARROW, lime)]:
        coords = [(x + int(px * factor), y + int(py * factor)) for px, py in poly]
        draw.polygon(coords, fill=fill)


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    s = hex_color.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, size: int, bold: bool = True, spacing: int = 0) -> tuple[ImageFont.FreeTypeFont, int]:
    while size > 12:
        f = pfont(size, bold)
        width = draw.textlength(text, font=f) + spacing * max(0, len(text) - 1)
        if width <= max_width:
            return f, int(width)
        size -= 1
    f = pfont(size, bold)
    return f, int(draw.textlength(text, font=f))


def draw_spaced(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, int, int, int], spacing: int = 0) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textlength(char, font=font) + spacing


def render_logo(width: int, height: int, layout: str = "horizontal", variant: str = "light", transparent: bool = True) -> Image.Image:
    bg = (0, 0, 0, 0) if transparent else rgba(BG if variant != "dark" else WHITE)
    im = Image.new("RGBA", (width * SCALE, height * SCALE), bg)
    d = ImageDraw.Draw(im)
    if layout == "symbol":
        s = min(width * 0.78, height * 0.78)
        draw_mark(im, int((width - 180 * s / 160) * SCALE / 2), int((height - 160 * s / 160) * SCALE / 2), int(s * SCALE), variant)
        return im.resize((width, height), Image.Resampling.LANCZOS)
    if layout == "stacked":
        s = min(width * 0.35, height * 0.36)
        draw_mark(im, int((width * SCALE - 180 * s / 160 * SCALE) / 2), int(24 * SCALE), int(s * SCALE), variant)
        word = (0, 0, 0, 255) if variant == "dark" or variant == "mono-dark" else rgba(WHITE)
        accent = rgba(LIME if variant not in ("dark", "mono-dark") else "#4B7900")
        f, _ = fit_text(d, "STRAIGHT UP", int(width * 0.88 * SCALE), int(height * 0.105 * SCALE), True, int(0.010 * width * SCALE))
        draw_spaced(d, (0, int(height * 0.69 * SCALE)), "STRAIGHT UP", f, word, int(0.010 * width * SCALE))
        f2, _ = fit_text(d, "DIGITAL", int(width * 0.75 * SCALE), int(height * 0.09 * SCALE), True, int(0.017 * width * SCALE))
        draw_spaced(d, (0, int(height * 0.81 * SCALE)), "DIGITAL", f2, accent, int(0.017 * width * SCALE))
        # Recenter text after measuring.
        for box_y, text, font, color, gap in [
            (int(height * 0.69 * SCALE), "STRAIGHT UP", f, word, int(0.010 * width * SCALE)),
            (int(height * 0.81 * SCALE), "DIGITAL", f2, accent, int(0.017 * width * SCALE)),
        ]:
            d.rectangle((0, box_y, width * SCALE, box_y + font.size + 6), fill=bg)
            total = d.textlength(text, font=font) + gap * (len(text) - 1)
            draw_spaced(d, (int((width * SCALE - total) / 2), box_y), text, font, color, gap)
        return im.resize((width, height), Image.Resampling.LANCZOS)
    mark_h = height * 0.78
    mark_w = mark_h * 180 / 160
    x, y = int(14 * SCALE), int((height - mark_h) * SCALE / 2)
    draw_mark(im, x, y, int(mark_h * SCALE), variant)
    word = (0, 0, 0, 255) if variant in ("dark", "mono-dark") else rgba(WHITE)
    accent = rgba(LIME if variant not in ("dark", "mono-dark") else "#4B7900")
    tx = int((mark_w + 30) * SCALE)
    maxw = int((width - mark_w - 46) * SCALE)
    f, _ = fit_text(d, "STRAIGHT UP", maxw, int(height * 0.255 * SCALE), True, int(0.010 * height * SCALE))
    f2, _ = fit_text(d, "DIGITAL", maxw, int(height * 0.27 * SCALE), True, int(0.020 * height * SCALE))
    draw_spaced(d, (tx, int(height * 0.16 * SCALE)), "STRAIGHT UP", f, word, int(0.010 * height * SCALE))
    draw_spaced(d, (tx, int(height * 0.52 * SCALE)), "DIGITAL", f2, accent, int(0.020 * height * SCALE))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def save_svg(name: str, content: str) -> None:
    (SVG_DIR / name).write_text(content, encoding="utf-8")


def main() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_BRAND.mkdir(parents=True, exist_ok=True)

    svg_assets = {
        "straight-up-digital-horizontal.svg": logo_svg("horizontal", "light"),
        "straight-up-digital-horizontal-dark.svg": logo_svg("horizontal", "dark"),
        "straight-up-digital-horizontal-mono-white.svg": logo_svg("horizontal", "mono-white"),
        "straight-up-digital-horizontal-mono-dark.svg": logo_svg("horizontal", "mono-dark"),
        "straight-up-digital-stacked.svg": logo_svg("stacked", "light"),
        "straight-up-digital-stacked-dark.svg": logo_svg("stacked", "dark"),
        "straight-up-digital-stacked-mono-white.svg": logo_svg("stacked", "mono-white"),
        "straight-up-digital-stacked-mono-dark.svg": logo_svg("stacked", "mono-dark"),
        "straight-up-digital-symbol.svg": symbol_svg(),
        "straight-up-digital-symbol-mono-white.svg": symbol_svg(mono="#F5F7F4"),
        "straight-up-digital-symbol-mono-dark.svg": symbol_svg(mono="#080B0A"),
    }
    for name, svg in svg_assets.items():
        save_svg(name, svg)

    exports: dict[str, Image.Image] = {
        "logo-horizontal.png": render_logo(1800, 450, "horizontal", "light"),
        "logo-horizontal-dark.png": render_logo(1800, 450, "horizontal", "dark"),
        "logo-horizontal-mono-white.png": render_logo(1800, 450, "horizontal", "mono-white"),
        "logo-horizontal-mono-dark.png": render_logo(1800, 450, "horizontal", "mono-dark"),
        "logo-stacked.png": render_logo(1200, 1200, "stacked", "light"),
        "logo-stacked-dark.png": render_logo(1200, 1200, "stacked", "dark"),
        "logo-symbol.png": render_logo(1024, 1024, "symbol", "colour"),
        "logo-symbol-mono-white.png": render_logo(1024, 1024, "symbol", "mono-white"),
        "logo-symbol-mono-dark.png": render_logo(1024, 1024, "symbol", "mono-dark"),
        "social-profile-1080.png": render_logo(1080, 1080, "symbol", "colour"),
        "social-cover-facebook-1640x624.png": render_logo(1640, 624, "horizontal", "light"),
        "social-cover-linkedin-1128x191.png": render_logo(1128, 191, "horizontal", "light"),
        "og-image-1200x630.png": render_logo(1200, 630, "horizontal", "light"),
        "favicon-512.png": render_logo(512, 512, "symbol", "colour"),
        "icon-192.png": render_logo(192, 192, "symbol", "colour"),
        "icon-512.png": render_logo(512, 512, "symbol", "colour"),
        "apple-touch-icon-180.png": render_logo(180, 180, "symbol", "colour"),
        "app-icon-1024.png": render_logo(1024, 1024, "symbol", "colour"),
    }
    for name, im in exports.items():
        im.save(PNG_DIR / name, optimize=True)
    exports["favicon-512.png"].save(PNG_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    # Transparent social banners retain the approved black/lime brand on dark layouts.
    horizontal = exports["logo-horizontal.png"]
    for name, size in [("social-cover-facebook-1640x624.png", (1640, 624)), ("social-cover-linkedin-1128x191.png", (1128, 191)), ("og-image-1200x630.png", (1200, 630))]:
        canvas = Image.new("RGBA", (size[0] * SCALE, size[1] * SCALE), rgba(BG))
        d = ImageDraw.Draw(canvas)
        # Restrained grid and two soft brand glows, built deterministically.
        spacing = 52 * SCALE
        for gx in range(0, size[0] * SCALE, spacing):
            d.line((gx, 0, gx, size[1] * SCALE), fill=(165, 173, 166, 12), width=1)
        for gy in range(0, size[1] * SCALE, spacing):
            d.line((0, gy, size[0] * SCALE, gy), fill=(165, 173, 166, 12), width=1)
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        glow_w = int(size[0] * 0.65 * SCALE)
        od.ellipse((size[0] * SCALE - glow_w, -size[1] * SCALE, size[0] * SCALE + glow_w // 2, size[1] * SCALE), fill=(142, 219, 40, 23))
        overlay = overlay.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(size[1] * SCALE * 0.55))
        canvas.alpha_composite(overlay)
        target_w = int(size[0] * 0.56 * SCALE)
        target_h = int(target_w * 450 / 1800)
        logo = horizontal.resize((target_w, target_h), Image.Resampling.LANCZOS)
        canvas.alpha_composite(logo, (int(size[0] * 0.08 * SCALE), int((size[1] * SCALE - target_h) / 2)))
        # Descriptor is deliberately factual and not a performance claim.
        f = pfont(max(24, int(size[1] * 0.045 * SCALE)), False)
        draw = ImageDraw.Draw(canvas)
        descriptor = "DIGITAL INTELLIGENCE  /  WEBSITES  /  BUSINESS SUPPORT"
        draw.text((int(size[0] * 0.08 * SCALE), int(size[1] * 0.78 * SCALE)), descriptor, font=f, fill=rgba(MUTED))
        canvas.resize(size, Image.Resampling.LANCZOS).save(PNG_DIR / name, optimize=True)

    # Public-site brand files and platform icons, in a transparent PNG format.
    copies = {
        "logo-horizontal-dark.png": "logo-horizontal.png",
        "logo-horizontal-light.png": "logo-horizontal-dark.png",
        "logo-stacked-dark.png": "logo-stacked.png",
        "symbol.png": "logo-symbol.png",
        "app-icon-1024.png": "app-icon-1024.png",
        "favicon-256.png": "favicon-512.png",
        "favicon-512.png": "favicon-512.png",
        "icon-192.png": "icon-192.png",
        "icon-512.png": "icon-512.png",
        "apple-touch-icon.png": "apple-touch-icon-180.png",
        "favicon.ico": "favicon.ico",
    }
    for target, source in copies.items():
        shutil.copy2(PNG_DIR / source, PUBLIC_BRAND / target)
    shutil.copy2(SVG_DIR / "straight-up-digital-symbol.svg", PUBLIC_BRAND / "symbol.svg")
    shutil.copy2(PNG_DIR / "og-image-1200x630.png", ROOT / "public" / "og-image.png")
    shutil.copy2(PNG_DIR / "favicon-512.png", ROOT / "public" / "favicon-512.png")
    shutil.copy2(PNG_DIR / "icon-192.png", ROOT / "public" / "icon-192.png")
    shutil.copy2(PNG_DIR / "icon-512.png", ROOT / "public" / "icon-512.png")
    shutil.copy2(PNG_DIR / "favicon.ico", ROOT / "public" / "favicon.ico")
    shutil.copy2(PNG_DIR / "app-icon-1024.png", ROOT / "public" / "app-icon-1024.png")
    shutil.copy2(PNG_DIR / "apple-touch-icon-180.png", ROOT / "public" / "apple-touch-icon.png")
    (ROOT / "public" / "favicon.svg").write_text(svg_assets["straight-up-digital-symbol.svg"], encoding="utf-8")

    guide = f'''# Straight Up Digital brand guidelines

## Brand idea
**Intelligence. Visibility. Growth.** A clear, capable digital partner for small and growing South African businesses. The identity should feel considered, direct, and dependable—not loud or futuristic for its own sake.

## Logo system
The angular S mark combines two continuous graphite/silver ribbons with an upward lime signal stroke. Use the horizontal lockup in headers and footers, the stacked lockup for square placements, and the standalone mark for favicons and avatars. Keep the mark and exact uppercase wordmark together when space permits. Do not redraw, distort, rotate, crop, or add effects to the mark. Leave clear space equal to at least one quarter of the symbol width. Minimum recommended size: 150 px wide for the horizontal lockup and 28 px for the standalone symbol.

The wordmark is set as editable vector text in the SVG masters. The exact supplied spelling is **STRAIGHT UP DIGITAL**. For consistent rendering, the master CSS uses Montserrat with Arial/sans-serif fallback. Package artwork can be opened in a vector editor and converted to outlines if a print supplier requires outlined paths.

## Colour palette
- Deep background: `{BG}`
- Graphite: `{LINE}`
- Surface: `{SURFACE}` and `{SURFACE_2}`
- Electric lime: `{LIME}`
- Supporting green: `{LIME_DARK}`
- Light text: `{WHITE}`
- Muted text: `{MUTED}`

Use lime as a focused signal for actions, links, and small data highlights. Keep body text light and legible. Do not use lime for long paragraphs or decorative glow effects over text.

## Typography
Use Montserrat for display headings and the wordmark; use Inter for body copy and interface labels. Both are self-hosted on the website. Keep headings compact, clear and sentence case in page copy; the wordmark itself remains uppercase.

## Photography and illustration
Use deliberate, locally hosted imagery with responsive sizes and descriptive alternative text. The existing Unsplash images represent business categories only; they are not client work. Interface mockups and auditor preview visuals must be labelled illustrative and must never be presented as live output or a real client result.

## Voice
Write in direct, plain English. Explain scope, price, payment timing and third-party costs before asking someone to commit. Never add unsupported claims, testimonials, partnerships, awards, rankings or quantified results.

## Files
- `masters/`: clean SVG vector masters in colour and monochrome, horizontal and stacked.
- `exports/`: transparent logo PNGs, favicons, app icon, social profile/cover images and Open Graph image.
- `straight-up-digital-logo-kit.zip`: distributable bundle of masters, exports, and this guide.
'''
    (KIT / "BRAND-GUIDELINES.md").write_text(guide, encoding="utf-8")
    archive = KIT / "straight-up-digital-logo-kit.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for file in sorted(KIT.rglob("*")):
            if file.is_file() and file != archive and "__pycache__" not in file.parts:
                zf.write(file, file.relative_to(KIT))
    public_downloads = ROOT / "public" / "downloads"
    public_downloads.mkdir(parents=True, exist_ok=True)
    shutil.copy2(archive, public_downloads / archive.name)
    print(f"Built {len(svg_assets)} SVG masters, {len(exports) + 1} PNG/ICO exports and {archive}")


if __name__ == "__main__":
    main()
