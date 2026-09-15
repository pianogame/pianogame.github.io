"""Build the static site, restoring the original audio bytes from ZIP bundles."""
from pathlib import Path
import hashlib
import io
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(ROOT / "site", OUT)
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
print("Ready: piano site with 102 unchanged audio samples")
