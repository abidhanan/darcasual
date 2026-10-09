"""Kompres foto produk untuk web.

Sumber : data/images-src/<id>.jpg   (unduhan asli dari IG, tidak perlu di-deploy)
Hasil  : assets/products/<id>-480.webp   semua produk (kartu katalog)
         assets/products/<id>-720.webp   hanya produk Ready/Booked (detail & layar retina)
         assets/products/<id>-1080.webp  hanya foto hero & Tentang Kami (LARGE_IDS)

Daftar produk Ready/Booked dibaca dari data/hires-ids.json (ditulis build-products.mjs).
Produk Sold Out hanya mendapat 480.webp dengan kualitas sedikit lebih rendah, supaya total
upload tetap di bawah batas 100 MB Vercel Hobby.

Pakai  : python scripts/optimize-images.py [--force]
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "images-src"
OUT = ROOT / "assets" / "products"
FORCE = "--force" in sys.argv
HIRES_FILE = ROOT / "data" / "hires-ids.json"
HIRES = set(json.loads(HIRES_FILE.read_text())) if HIRES_FILE.exists() else None  # None = semua

WEBP = {"quality": 70, "method": 6}
WEBP_SOLD = {"quality": 62, "method": 6}
LARGE_IDS = {"DePAs5hlDBO", "DeJ189gFFAn"}  # dipakai index.html (hero & Tentang Kami)


def resize(im, width):
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def process(src: Path) -> str:
    stem = src.stem
    hires = HIRES is None or stem in HIRES
    targets = [(OUT / f"{stem}-480.webp", 480, "WEBP", WEBP if hires else WEBP_SOLD)]
    try:
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            (OUT / f"{stem}-360.jpg").unlink(missing_ok=True)  # format lama, tidak dipakai lagi
            if hires:
                targets.append((OUT / f"{stem}-720.webp", 720, "WEBP", WEBP))
            else:  # produk sudah sold: hapus versi besar yang tidak terpakai lagi
                (OUT / f"{stem}-720.webp").unlink(missing_ok=True)
            if stem in LARGE_IDS and im.width >= 1080:
                targets.append((OUT / f"{stem}-1080.webp", 1080, "WEBP", WEBP))
            else:
                (OUT / f"{stem}-1080.webp").unlink(missing_ok=True)
            if not FORCE and all(t[0].exists() for t in targets):
                return "skip"
            for path, width, fmt, opts in targets:
                resize(im, width).save(path, fmt, **opts)
        return "ok"
    except Exception as exc:  # file rusak / bukan gambar
        print(f"  ! {src.name}: {exc}")
        return "fail"


GSRC = ROOT / "data" / "gallery-src"
GOUT = ROOT / "assets" / "gallery"
WEBP_GALLERY = {"quality": 66, "method": 6}


def process_gallery(src: Path) -> str:
    """Foto carousel ke-2 dst untuk galeri detail produk (720px)."""
    pid = src.stem.rsplit("-", 1)[0]
    dest = GOUT / f"{src.stem}.webp"
    if HIRES is not None and pid not in HIRES:  # produk sudah sold → galeri tidak dipakai
        dest.unlink(missing_ok=True)
        return "skip"
    if not FORCE and dest.exists():
        return "skip"
    try:
        with Image.open(src) as im:
            resize(ImageOps.exif_transpose(im).convert("RGB"), 720).save(dest, "WEBP", **WEBP_GALLERY)
        return "ok"
    except Exception as exc:
        print(f"  ! {src.name}: {exc}")
        return "fail"


OUT.mkdir(parents=True, exist_ok=True)
for legacy in OUT.glob("*-480.jpg"):  # format lama
    legacy.unlink()
with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(process, sorted(SRC.glob("*.jpg"))))
print(f"[ok] kompres: {results.count('ok')} baru, {results.count('skip')} sudah ada, {results.count('fail')} gagal")

GOUT.mkdir(parents=True, exist_ok=True)
with ThreadPoolExecutor(max_workers=4) as pool:
    g = list(pool.map(process_gallery, sorted(GSRC.glob("*.jpg"))))
print(f"[ok] galeri: {g.count('ok')} baru, {g.count('skip')} dilewati, {g.count('fail')} gagal")
