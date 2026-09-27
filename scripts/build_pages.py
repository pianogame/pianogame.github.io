"""Build output for Vercel while keeping GitHub Pages non-public."""
from pathlib import Path
import hashlib
import base64
import io
import json
import os
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)

# GitHub Pages is intentionally not a public distribution target.
# Publish only a 404 page there so the github.io URL cannot serve the app.
if os.environ.get("GITHUB_ACTIONS") == "true":
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    (OUT / "404.html").write_text(
        """<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title></head><body><h1>404</h1><p>このページは公開されていません。</p></body></html>""",
        encoding="utf-8",
    )
    print("Ready: GitHub Pages intentionally publishes no app content")
    raise SystemExit(0)

# Vercel: publish the actual app at the project root.
shutil.copytree(ROOT / "site", OUT, dirs_exist_ok=True)

# Generate every install icon from the exact 180x180 image shown on the install screen.
# This avoids iOS/manifest choosing a different historical icon asset.
import struct
import zlib
import math

def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c

def _decode_indexed_png_rgba(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid PNG signature")
    pos = 8
    width = height = bit_depth = color_type = None
    palette = None
    alpha = b""
    idat = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        kind = data[pos+4:pos+8]
        payload = data[pos+8:pos+8+length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", payload)
        elif kind == b"PLTE":
            palette = [tuple(payload[i:i+3]) for i in range(0, len(payload), 3)]
        elif kind == b"tRNS":
            alpha = payload
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 3 or palette is None:
        raise ValueError("Expected 8-bit indexed PNG for Dream Stage source icon")
    raw = zlib.decompress(bytes(idat))
    stride = width
    rows = []
    prev = bytearray(stride)
    p = 0
    for _y in range(height):
        filt = raw[p]
        p += 1
        row = bytearray(raw[p:p+stride])
        p += stride
        for x in range(stride):
            left = row[x-1] if x else 0
            up = prev[x]
            up_left = prev[x-1] if x else 0
            if filt == 1:
                row[x] = (row[x] + left) & 255
            elif filt == 2:
                row[x] = (row[x] + up) & 255
            elif filt == 3:
                row[x] = (row[x] + ((left + up) >> 1)) & 255
            elif filt == 4:
                row[x] = (row[x] + _paeth(left, up, up_left)) & 255
            elif filt != 0:
                raise ValueError(f"Unsupported PNG filter: {filt}")
        rows.append(row)
        prev = row
    rgba = bytearray(width * height * 4)
    q = 0
    for row in rows:
        for idx in row:
            r, g, b = palette[idx]
            a = alpha[idx] if idx < len(alpha) else 255
            rgba[q:q+4] = bytes((r, g, b, a))
            q += 4
    return width, height, bytes(rgba)

def _resize_rgba(src, sw, sh, dw, dh):
    out = bytearray(dw * dh * 4)
    for y in range(dh):
        sy = (y + 0.5) * sh / dh - 0.5
        y0 = max(0, min(sh - 1, math.floor(sy)))
        y1 = min(sh - 1, y0 + 1)
        fy = max(0.0, min(1.0, sy - y0))
        for x in range(dw):
            sx = (x + 0.5) * sw / dw - 0.5
            x0 = max(0, min(sw - 1, math.floor(sx)))
            x1 = min(sw - 1, x0 + 1)
            fx = max(0.0, min(1.0, sx - x0))
            o = (y * dw + x) * 4
            for c in range(4):
                p00 = src[(y0 * sw + x0) * 4 + c]
                p10 = src[(y0 * sw + x1) * 4 + c]
                p01 = src[(y1 * sw + x0) * 4 + c]
                p11 = src[(y1 * sw + x1) * 4 + c]
                top = p00 + (p10 - p00) * fx
                bot = p01 + (p11 - p01) * fx
                out[o + c] = round(top + (bot - top) * fy)
    return bytes(out)

def _png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)

def _encode_rgba_png(width, height, rgba):
    rows = bytearray()
    stride = width * 4
    for y in range(height):
        rows.append(0)
        rows.extend(rgba[y*stride:(y+1)*stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + _png_chunk(b"IEND", b"")
    )

install_dir = OUT / "install"
install_dir.mkdir(parents=True, exist_ok=True)
source_icon = (ROOT / "site" / "icons" / "dreamstage-touch-180-v8.png").read_bytes()
sw0, sh0, rgba0 = _decode_indexed_png_rgba(source_icon)
if (sw0, sh0) != (180, 180):
    raise ValueError(f"Unexpected source icon size: {sw0}x{sh0}")

# Exact 180px source for iPhone Home Screen.
(install_dir / "apple-touch-icon.png").write_bytes(source_icon)

# Properly-sized manifest/fallback icons, all derived from that exact same picture.
for size, name in [
    (192, "icon-192.png"),
    (512, "icon-512.png"),
]:
    resized = _resize_rgba(rgba0, sw0, sh0, size, size)
    png = _encode_rgba_png(size, size, resized)
    (install_dir / name).write_bytes(png)


bundles = ROOT / "sample-bundles"
for bundle in json.loads((bundles / "parts.json").read_text()):
    data = b"".join((bundles / part["name"]).read_bytes() for part in bundle["parts"])
    if len(data) != bundle["size"] or hashlib.sha256(data).hexdigest() != bundle["sha256"]:
        raise ValueError(f"Incomplete audio bundle: {bundle['name']}")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for entry in archive.infolist():
            target = OUT / entry.filename
            if not entry.filename.startswith("audio/") or not target.resolve().is_relative_to(OUT.resolve()):
                raise ValueError(f"Unexpected archive path: {entry.filename}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))

if len(list((OUT / "audio").rglob("*.m4a"))) != 102:
    raise ValueError("Expected all 102 audio samples")
print("Ready: Piano Dream Stage for Vercel with 102 unchanged audio samples")
