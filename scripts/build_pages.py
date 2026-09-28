"""Build output for Vercel while keeping GitHub Pages non-public."""
from pathlib import Path
import hashlib
import base64
import io
import json
import os
import shutil
import zipfile
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"

OPENING_AUDIO_EXPECTED = {
    "curtain-start-1.mp3": (73197, "1b20f11cde9736eeceb7902fa1c49074f6977a887555681182e27b9a01e56673"),
    "curtain-start-2.mp3": (73197, "3e45fea2d8630805e29b55b31432109d5cefdc5a9acfd7b9beaa87d1bbce1ebb"),
    "curtain-start-3.mp3": (73197, "b325e9a89645488549c402e3870705e4b7e7f6affae406d0df80e8ace6345406"),
    "curtain-start-4.mp3": (73197, "d35759865b40a5acd85920115b4d35709ccab6878fc7803195336a04084fc1ee"),
    "opening-3voices.m4a": (32587, "45894044bd44f4abfa7a25932e3b4b1e5fbe69f32161bab51be72cebf14e807b"),
    "opening-bgm-01.m4a": (534697, "2ea88521d154cafa8493572835c3502b88e0420c84722e48f6de99295678c3dc"),
    "opening-bgm-02.m4a": (558101, "f54f301528b11d70b7d46d56bb4b8b98dce867ba7b7a564cffc18982b0e32e3e"),
    "opening-bgm-03.m4a": (558593, "44c1d292bf8c004c43573d7adcb8371ef0f28c4b62d4099f78d841563326aa13"),
    "opening-bgm-04.m4a": (473836, "a30bfc48359676f7fda0d06f6a2e6f648afe5940c6c6cb73ee141e866e862778"),
    "opening-bgm-05.m4a": (284932, "09db0a9bb1c3ade1134bb6604f357b5c1809b22a0fbe00902ad38d59d94126f5"),
    "opening-bgm-06.m4a": (537067, "3833dda5b0c32cf5905ef190f17219c9b6cc51caab354a41cadee179118847c2"),
    "opening-bgm-07.m4a": (514366, "ad0e2febf6c5e539b3bf0dd2b7bf2872776d70ed1d9d01d2e4d4c3dbc9c81b14"),
    "opening-bgm-08.m4a": (533558, "7bcde226867bedd1de340de2651ee720893dfecb5fa90a3b2841c920f0280bb2"),
    "opening-bgm-09.m4a": (266903, "99651e807d0b8d7e0db1bf644b5db4a65411d5d4f26a5cc176ff61121a9c1bd6"),
    "opening-bgm-10.m4a": (542390, "6cfea560806a8589c931960821b00ad0737b79901ab03bd08b2b1b2c22554fb4"),
}


def _verify_app_sources():
    site = ROOT / "site"
    js_files = sorted(site.glob("*.js"))
    if not js_files:
        raise ValueError("No JavaScript source files found")

    # Literal backslash-n sequences previously corrupted generated edits in piano.js
    # and multitrack.js. This project does not intentionally use them in JS source.
    for path in js_files:
        source = path.read_text(encoding="utf-8")
        if "\\n" in source:
            raise ValueError(f"Suspicious literal \\n found in JavaScript source: {path.relative_to(ROOT)}")
        try:
            subprocess.run(
                ["node", "--check", str(path)],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("node is required for JavaScript syntax validation") from exc
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or exc.stdout or "").strip()
            raise ValueError(f"JavaScript syntax check failed for {path.relative_to(ROOT)}: {detail}") from exc

    html = (site / "index.html").read_text(encoding="utf-8")
    html_actions = set(re.findall(r'data-action="([^"]+)"', html))
    referenced_actions = set()
    for path in js_files:
        source = path.read_text(encoding="utf-8")
        referenced_actions.update(re.findall(r'action\([\'"]([^\'"]+)[\'"]\)', source))
    missing_actions = sorted(referenced_actions - html_actions)
    if missing_actions:
        raise ValueError("JavaScript references missing data-action controls: " + ", ".join(missing_actions))

    for name, (expected_size, expected_sha256) in OPENING_AUDIO_EXPECTED.items():
        path = site / "audio" / name
        if not path.is_file():
            raise ValueError(f"Missing required opening audio: {name}")
        data = path.read_bytes()
        if len(data) != expected_size or hashlib.sha256(data).hexdigest() != expected_sha256:
            raise ValueError(f"Opening audio checksum mismatch: {name}")

    opening_source = (site / "rotation-guide.js").read_text(encoding="utf-8")
    for name in OPENING_AUDIO_EXPECTED:
        if f"/audio/{name}" not in opening_source:
            raise ValueError(f"Opening audio is not referenced by rotation-guide.js: {name}")
    if opening_source.count("opening-bgm-") != 10:
        raise ValueError("Expected exactly 10 opening BGM references")
    if "fadeOutCurtainBgm(.78)" not in opening_source or "setValueCurveAtTime" not in opening_source:
        raise ValueError("Strong Web Audio BGM fade-out is missing")
    if "voiceAt=now+1.5" not in opening_source:
        raise ValueError("Opening voice must become audible 1.5 seconds after BGM")
    if "primeOpeningAudio();" not in opening_source or "openingAudioContext.resume()" not in opening_source:
        raise ValueError("Opening AudioContext and sources must be primed on pointerdown")
    if "bgmSource.playbackRate.setValueAtTime(1,now)" not in opening_source:
        raise ValueError("Opening BGM source must start running silently on pointerdown")
    if "voiceSource.playbackRate.setValueAtTime(0,now)" not in opening_source:
        raise ValueError("Opening voice source must stay frozen and silent until its delay")
    if "beginAudibleOpening()" not in opening_source:
        raise ValueError("Opening BGM must become audible only after swipe-or-hold succeeds")
    if "createBufferSource()" not in opening_source or "createGain()" not in opening_source:
        raise ValueError("Opening audio must use Web Audio buffers and gain control")
    if "cancelPreparationAudio();" not in opening_source:
        raise ValueError("A normal tap must not complete the preparation gesture")
    if "distance<72&&held<520" not in opening_source or "LONG PRESS / SWIPE" not in opening_source:
        raise ValueError("Swipe-or-hold preparation gesture is missing")
    if "voiceAudio.volume" in opening_source or "curtainBgm.volume" in opening_source:
        raise ValueError("Do not use HTMLMediaElement volume for opening audio on iOS")
    if any(line.strip() == "undefined" for line in opening_source.splitlines()):
        raise ValueError("Unexpected undefined line in rotation-guide.js")


_verify_app_sources()

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

def _flatten_rgba(src, bg=(36, 19, 36)):
    """Composite RGBA onto the app background and force alpha to 255."""
    out = bytearray(len(src))
    br, bgc, bb = bg
    for i in range(0, len(src), 4):
        r, g, b, a = src[i:i+4]
        inv = 255 - a
        out[i] = (r * a + br * inv + 127) // 255
        out[i+1] = (g * a + bgc * inv + 127) // 255
        out[i+2] = (b * a + bb * inv + 127) // 255
        out[i+3] = 255
    return bytes(out)

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
source_icon = (ROOT / "site" / "install" / "apple-touch-icon.png").read_bytes()
sw0, sh0, rgba0 = _decode_indexed_png_rgba(source_icon)
if (sw0, sh0) != (180, 180):
    raise ValueError(f"Unexpected source icon size: {sw0}x{sh0}")

# Generate fully opaque install icons. Safari on iPhone can prefer the 120px
# apple-touch-icon even on high-density phones, so ship all established Apple sizes.
opaque0 = _flatten_rgba(rgba0)

apple_icons = [
    (120, "apple-touch-icon-120-v21.png"),
    (152, "apple-touch-icon-152-v21.png"),
    (167, "apple-touch-icon-167-v21.png"),
    (180, "apple-touch-icon-180-v21.png"),
]
for size, name in apple_icons:
    pixels = opaque0 if size == 180 else _resize_rgba(opaque0, sw0, sh0, size, size)
    png = _encode_rgba_png(size, size, pixels)
    (install_dir / name).write_bytes(png)

# Root fallbacks used by Safari/Web Clip auto-discovery.
root180 = _encode_rgba_png(180, 180, opaque0)
(OUT / "apple-touch-icon.png").write_bytes(root180)
(OUT / "apple-touch-icon-precomposed.png").write_bytes(root180)

install_v23 = OUT / "install-v23"
install_v23.mkdir(parents=True, exist_ok=True)
(install_v23 / "piano-dream-stage-touch-v23.png").write_bytes(root180)

# Standard Web App Manifest sizes.
for size, name in [
    (192, "pwa-icon-192-v21.png"),
    (512, "pwa-icon-512-v21.png"),
]:
    resized = _resize_rgba(opaque0, sw0, sh0, size, size)
    png = _encode_rgba_png(size, size, resized)
    (install_dir / name).write_bytes(png)

# Fail the deployment if any generated install icon is malformed or mis-sized.
def _verify_png(path, expected):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Invalid PNG signature: {path}")
    if len(data) < 33 or data[12:16] != b"IHDR":
        raise ValueError(f"Missing PNG IHDR: {path}")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    if (width, height) != (expected, expected):
        raise ValueError(f"Wrong icon size for {path}: {width}x{height}")
    if bit_depth != 8 or color_type != 6:
        raise ValueError(f"Unexpected icon format for {path}: depth={bit_depth}, color_type={color_type}")

for size, name in apple_icons:
    _verify_png(install_dir / name, size)
_verify_png(OUT / "apple-touch-icon.png", 180)
_verify_png(OUT / "apple-touch-icon-precomposed.png", 180)
_verify_png(OUT / "install-v23" / "piano-dream-stage-touch-v23.png", 180)
_verify_png(install_dir / "pwa-icon-192-v21.png", 192)
_verify_png(install_dir / "pwa-icon-512-v21.png", 512)
print("Verified install icons: Apple 120/152/167/180 and PWA 192/512, opaque RGBA PNG")

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

# Validate every absolute /audio/... URL referenced by JavaScript after the sample bundles
# have been expanded into the Vercel output directory.
for js_path in sorted(OUT.glob("*.js")):
    source = js_path.read_text(encoding="utf-8")
    for asset in set(re.findall(r'[\'"](/audio/[^\'"?]+)', source)):
        target = OUT / asset.lstrip("/")
        if not target.is_file():
            raise ValueError(f"Missing referenced audio asset: {asset} (from {js_path.name})")

instrument_samples = [p for p in (OUT / "audio").rglob("*.m4a") if p.name not in OPENING_AUDIO_EXPECTED]
if len(instrument_samples) != 102:
    raise ValueError(f"Expected all 102 instrument audio samples, found {len(instrument_samples)}")
print("Verified opening audio: 3-voice call, 4 supplied tap sounds and 10 supplied full BGM tracks")
print("Ready: Piano Dream Stage for Vercel with 102 unchanged audio samples")
