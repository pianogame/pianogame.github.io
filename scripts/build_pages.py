"""Build output for Vercel while keeping GitHub Pages non-public."""
from pathlib import Path
import hashlib
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
