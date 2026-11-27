#!/usr/bin/env python3
"""Export the supplied Straight Up Digital exact-symbol kit without redrawing it.

The user-provided archive is the single source of truth. This script copies the
provided logo PNGs, creates only standard-size icon derivatives, and refreshes
the website download. It does not redraw, recolour, reshape, crop, or add effects
to the supplied S symbol.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from shutil import copy2, rmtree
from zipfile import ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "brand-kit"
ARCHIVE = KIT / "straight-up-digital-logo-kit.zip"
PUBLIC = ROOT / "public"
PUBLIC_BRAND = PUBLIC / "brand"
EXPORTS = KIT / "exports"
LEGACY_MASTERS = KIT / "masters"
DOWNLOADS = PUBLIC / "downloads"
PREFIX = "straight-up-digital-exact-symbol-kit/"


def member_bytes(archive: ZipFile, relative_path: str) -> bytes:
    return archive.read(PREFIX + relative_path)


def copy_member(archive: ZipFile, relative_path: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(member_bytes(archive, relative_path))


def resize_png(source: bytes, size: int, target: Path) -> None:
    """Create a standard square icon by proportional resampling only."""
    with Image.open(BytesIO(source)) as image:
        image.convert("RGBA").resize(
            (size, size), Image.Resampling.LANCZOS
        ).save(target, format="PNG", optimize=True)


def write_png_wrapper(target: Path, image_href: str, title: str) -> None:
    target.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" '
        f'role="img" aria-labelledby="title"><title id="title">{title}</title>'
        f'<image href="{image_href}" width="256" height="256" /></svg>\n',
        encoding="utf-8",
    )


def write_ico(archive: ZipFile, source: str, target: Path) -> None:
    with Image.open(BytesIO(member_bytes(archive, source))) as image:
        image.convert("RGBA").save(
            target,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )


def main() -> None:
    if not ARCHIVE.is_file():
        raise FileNotFoundError(
            f"Exact-symbol source kit not found: {ARCHIVE}\n"
            "Copy the user-supplied straight-up-digital-exact-symbol-kit.zip "
            "to brand-kit/straight-up-digital-logo-kit.zip first."
        )

    # The previous generator's synthetic masters and exports are obsolete.
    if LEGACY_MASTERS.exists():
        rmtree(LEGACY_MASTERS)
    if EXPORTS.exists():
        rmtree(EXPORTS)
    EXPORTS.mkdir(parents=True, exist_ok=True)
    PUBLIC_BRAND.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)

    horizontal_1680 = "lockups/horizontal-white-lime-1680px.png"
    horizontal_3360 = "lockups/horizontal-white-lime-3360px.png"
    stacked_900 = "lockups/stacked-white-lime-900px.png"
    stacked_1800 = "lockups/stacked-white-lime-1800px.png"
    symbol_master = "png/straight-up-digital-symbol-master-1254.png"
    symbol_1024 = "png/straight-up-digital-symbol-1024.png"
    symbol_512 = "png/straight-up-digital-symbol-512.png"
    symbol_256 = "png/straight-up-digital-symbol-256.png"
    symbol_128 = "png/straight-up-digital-symbol-128.png"
    symbol_64 = "png/straight-up-digital-symbol-64.png"
    symbol_32 = "png/straight-up-digital-symbol-32.png"

    with ZipFile(ARCHIVE) as archive:
        # Keep a small, curated set of convenient exports beside the full source kit.
        for target, source in {
            "logo-horizontal.png": horizontal_1680,
            "logo-horizontal-3360px.png": horizontal_3360,
            "logo-stacked.png": stacked_900,
            "logo-stacked-1800px.png": stacked_1800,
            "logo-symbol-master-1254.png": symbol_master,
            "logo-symbol-1024.png": symbol_1024,
            "logo-symbol-512.png": symbol_512,
            "logo-symbol-256.png": symbol_256,
            "logo-symbol-128.png": symbol_128,
            "logo-symbol-64.png": symbol_64,
            "logo-symbol-32.png": symbol_32,
        }.items():
            copy_member(archive, source, EXPORTS / target)

        # Horizontal white/lime artwork is intended for dark website surfaces.
        copy_member(archive, horizontal_1680, PUBLIC_BRAND / "logo-horizontal-dark.png")
        copy_member(archive, horizontal_1680, PUBLIC_BRAND / "logo-horizontal-dark-compact.png")
        copy_member(archive, stacked_900, PUBLIC_BRAND / "logo-stacked-dark.png")
        stale_light_logo = PUBLIC_BRAND / "logo-horizontal-light.png"
        if stale_light_logo.exists():
            stale_light_logo.unlink()

        # Direct symbol exports retain the supplied artwork; wrappers reference
        # the same PNG rather than embedding a large duplicate raster payload.
        copy_member(archive, symbol_256, PUBLIC_BRAND / "symbol.png")
        copy_member(archive, symbol_512, PUBLIC_BRAND / "symbol-512.png")
        copy_member(archive, symbol_master, PUBLIC_BRAND / "symbol-master-1254.png")
        write_png_wrapper(PUBLIC_BRAND / "symbol.svg", "/brand/symbol.png", "Straight Up Digital symbol")
        write_png_wrapper(PUBLIC / "favicon.svg", "/favicon-256.png", "Straight Up Digital favicon")

        # Exact supplied images are used where available. A 192 px derivative is
        # a proportional resampling only, with transparent pixels preserved.
        folders = (PUBLIC, PUBLIC_BRAND, EXPORTS)
        for folder in folders:
            copy_member(archive, symbol_256, folder / "favicon-256.png")
            copy_member(archive, symbol_512, folder / "favicon-512.png")
            copy_member(archive, symbol_512, folder / "icon-512.png")
            copy_member(archive, symbol_1024, folder / "app-icon-1024.png")
            copy_member(archive, symbol_256, folder / "apple-touch-icon.png")
            resize_png(member_bytes(archive, symbol_256), 192, folder / "icon-192.png")
            write_ico(archive, symbol_512, folder / "favicon.ico")

        # Keep existing in-app asset names, all backed by the supplied mark.
        copy_member(archive, symbol_1024, PUBLIC_BRAND / "app-icon-1024.png")
        copy_member(archive, symbol_512, PUBLIC_BRAND / "icon-512.png")
        resize_png(member_bytes(archive, symbol_256), 180, EXPORTS / "apple-touch-icon-180.png")
        copy_member(archive, symbol_256, PUBLIC_BRAND / "favicon-256.png")
        copy_member(archive, symbol_512, PUBLIC_BRAND / "favicon-512.png")

    copy2(ARCHIVE, DOWNLOADS / "straight-up-digital-logo-kit.zip")
    print(
        "Refreshed website brand exports from the supplied exact-symbol kit; "
        "no logo geometry, colour or lockup artwork was regenerated."
    )


if __name__ == "__main__":
    main()
