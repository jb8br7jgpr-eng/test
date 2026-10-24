#!/usr/bin/env python3
"""Generate lightweight OPFC Hall of Fame thumbnails from official portraits.

Non-destructive: never edits portraits_opfc/*.webp.
Only writes the separate opfc/hall-thumbs/*.webp directory.
"""
from pathlib import Path
from PIL import Image, ImageOps

SRC = Path("portraits_opfc")
DEST = Path("opfc/hall-thumbs")
SIZE = (192, 192)
QUALITY = 82

def build():
    originals = sorted(SRC.glob("*.webp"))
    if len(originals) != 75:
        raise SystemExit(f"Expected 75 official portraits, found {len(originals)}; aborting")
    DEST.mkdir(parents=True, exist_ok=True)
    source_bytes = target_bytes = 0
    for original in originals:
        target = DEST / original.name
        with Image.open(original) as raw:
            portrait = ImageOps.exif_transpose(raw)
            if "A" in portrait.getbands() or "transparency" in portrait.info:
                portrait = portrait.convert("RGBA")
            else:
                portrait = portrait.convert("RGB")
            # Keep complete composition. CSS provides the circular crop at display time.
            portrait.thumbnail(SIZE, Image.Resampling.LANCZOS)
            portrait.save(target, format="WEBP", quality=QUALITY, method=6)
        with Image.open(target) as check:
            check.verify()
        source_bytes += original.stat().st_size
        target_bytes += target.stat().st_size
    if len(list(DEST.glob("*.webp"))) != len(originals):
        raise SystemExit("Thumbnail count mismatch")
    print(f"Generated {len(originals)} Hall-only thumbnails")
    print(f"Official originals untouched: {source_bytes/1048576:.2f} MiB")
    print(f"Hall-only thumbnails: {target_bytes/1048576:.2f} MiB")
    print(f"Reduction: {(1 - target_bytes/source_bytes)*100:.1f}%")

if __name__ == "__main__":
    build()
