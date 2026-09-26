"""Build the static site, restoring audio and publishing Piano Dream Stage at its canonical path."""
from pathlib import Path
import hashlib
import io
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
APP_PATH = "piano-dream-stage"

if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / "site", OUT)

# Keep the full app at the branded URL while preserving shared assets at the site root.
app_html = (OUT / "index.html").read_text(encoding="utf-8")
app_dir = OUT / APP_PATH
app_dir.mkdir(parents=True, exist_ok=True)
(app_dir / "index.html").write_text(app_html, encoding="utf-8")

# The former public URL must continue to work for people who already received it.
redirect_html = """<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0;url=/piano-dream-stage/">
  <title>ピアノドリームステージへ移動します</title>
  <script>
    (function () {
      var target = '/piano-dream-stage/' + location.search + location.hash;
      location.replace(target);
    }());
  </script>
</head>
<body>
  <p><a href="/piano-dream-stage/">ピアノドリームステージを開く</a></p>
</body>
</html>
"""
(OUT / "index.html").write_text(redirect_html, encoding="utf-8")

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
print("Ready: Piano Dream Stage at /piano-dream-stage/ with legacy root redirect and 102 unchanged audio samples")
