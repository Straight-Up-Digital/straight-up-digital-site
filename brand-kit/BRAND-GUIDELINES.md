# Straight Up Digital — brand and image guidance

## Brand idea

**Intelligence. Visibility. Growth.** The visual identity should feel capable, focused and dependable for small and growing South African businesses. Use confident charcoal surfaces, clear silver-white typography and a precise electric-lime signal rather than dense decoration.

## Official logo source

`straight-up-digital-logo-kit.zip` is the owner-supplied exact-symbol kit and the single source of truth. It contains the exact 1254 × 1254 RGBA S symbol, transparent lockups, PNG sizes, SVG and PDF source files. The SVG and PDF lockups embed the supplied raster symbol; their wordmark text remains editable in SVG.

The horizontal and stacked white/lime lockups are intended for dark backgrounds. Use them as supplied. Do not redraw, recolour, reshape, crop, distort, rotate, filter, add effects to, or place other artwork over the S symbol. Preserve its square proportions. Do not use the white/lime wordmark on a light background.

Website exports are in `public/brand/`. The header/footer use `logo-horizontal-dark.png`; standalone brand uses `symbol.png` and its small SVG wrapper. The favicon and web-app icons are exact symbol exports or proportional size derivatives.

## Palette

- Supplied electric lime: `#B7FF00` (exact value in the official kit)
- Obsidian UI background: `#080B0A`
- Deep charcoal surfaces: `#101512` and `#151B17`
- Light text: `#F5F7F4`
- Supporting silver: `#D6DDD7`
- Muted text: `#A5ADA6`

Use lime for primary actions, key links, small indicators and restrained edge light. Keep long text silver or white for readability. UI colors are separate from the logo artwork; never apply them to the supplied mark.

## Typography and layout

The website self-hosts Montserrat Variable for display headings and Inter Variable for body copy. Keep page copy in plain English, with compact headings, comfortable line lengths, visible keyboard focus, responsive layouts and reduced-motion support.

## Photography and concepts

The coordinated service images in `public/images/art-directed/` were generated for this website. They are illustrative category visuals, not client projects, commissioned photography or evidence of completed work. Keep alt text accurate. Do not turn the images into claimed portfolio work or imply that a depicted interface is an operating customer site. The Business Auditor preview must remain clearly labelled illustrative and contain no invented score or customer findings.

## Voice and claims

Explain package scope, confirmed price, payment timing and third-party costs before asking a visitor to commit. Do not invent testimonials, partnerships, awards, case studies, search rankings, performance figures or revenue results.

## Maintenance

Run `python scripts/build-brand-kit.py` to refresh the website and download exports from the supplied ZIP. The exporter copies official logo files and makes proportional standard icon sizes only; it does not draw or recolour the symbol. The former synthetic masters and exports are retired. Keep the source ZIP intact as the authoritative kit.
