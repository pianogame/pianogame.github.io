"""Import the pinned, CC0 VSCO 2 CE solo violin; retain source hashes and mapping."""
from pathlib import Path
import concurrent.futures, hashlib, io, json, re, subprocess, tempfile, urllib.request, zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "violin-source"
COMMIT = "28092772094b2d9f1148d84cea97f4545b8c687d"
BASE = f"https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{COMMIT}/"
SOURCE.mkdir(exist_ok=True)
OUT = ROOT / "site/audio/violin"
OUT.mkdir(parents=True, exist_ok=True)

def fetch(path):
    target = SOURCE / path
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(urllib.request.urlopen(BASE + urllib.parse.quote(path), timeout=90).read())
    return target

regions = []
for articulation, mapping in [("arco", "SViolinVib.sfz"), ("pizzicato", "SViolinPizz.sfz"), ("spiccato", "SViolinSpic.sfz"), ("tremolo", "SViolinTrem.sfz")]:
    text = fetch(mapping).read_text()
    folder = re.search(r"default_path=(.+)", text)[1].strip().replace("\\", "/")
    for block in text.split("<region>")[1:]:
        values = dict(re.findall(r"(\w+)=([^\r\n]+)", block))
        # Use the full-voice layer. Keep real round robins for short bow/pluck.
        if int(values.get("hivel", 127)) < 127:
            continue
        name = values["sample"].strip()
        regions.append({"articulation": articulation, "midi": int(values["pitch_keycenter"]),
                        "tune": float(values.get("tune", 0)), "source": folder + name})

def convert(region):
    source = fetch(region["source"])
    probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(source)]))["streams"][0]
    rate, channels = int(probe["sample_rate"]), int(probe["channels"])
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(source), "-f", "f32le", "-"])
    samples = np.frombuffer(raw, dtype="<f4").reshape(-1, channels).copy()
    # Preserve the original bow attack; trim only the leading near-silence.
    energy = np.max(np.abs(samples), axis=1)
    audible = np.flatnonzero(energy > .0005)
    first = max(0, int(audible[0]) - int(rate * .003)) if len(audible) else 0
    samples = samples[first:]
    loop = None
    if region["articulation"] in ("arco", "tremolo"):
        # A long crossfade within the recorded stable bow sound makes the
        # sustain loop continuous without replaying the sample's bow attack.
        start = min(1.5, len(samples) / rate * .30)
        end = min(4.5, len(samples) / rate - .4)
        cross = min(.35, (end - start) * .15)
        a, b, n = round(start * rate), round(end * rate), round(cross * rate)
        if b - a < rate:
            raise ValueError(f"Insufficient sustain: {source}")
        weights = np.linspace(0, 1, n)[:, None]
        samples[b - n:b] = samples[b - n:b] * (1 - weights) + samples[a - n:a] * weights
        samples = samples[:b]
        loop = {"loopStart": a / rate, "loopEnd": b / rate}
    else:
        last = int(audible[-1]) - first if len(audible) else len(samples)-1
        samples = samples[:min(len(samples), last + int(.18 * rate))]
    peak = np.max(np.abs(samples))
    samples *= .72 / max(.001, peak)
    stem = region["source"].split("/")[-1].removesuffix(".wav")
    target = OUT / (stem + ".m4a")
    # Encode in a private temporary file, then publish the completed bytes.
    with tempfile.TemporaryDirectory() as temporary:
        pcm = Path(temporary) / 'input.f32'
        encoded = Path(temporary) / 'sample.m4a'
        pcm.write_bytes(samples.astype('<f4').tobytes())
        subprocess.run(["ffmpeg", "-nostdin", "-threads", "1", "-y", "-v", "error", "-f", "f32le", "-ar", str(rate), "-ac", str(channels), "-i", str(pcm), "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", str(encoded)], check=True)
        result = encoded.read_bytes()
        if len(result) < 1000:
            raise ValueError(f'Empty encoded violin sample: {source}')
        target.write_bytes(result)
    descriptor = {"midi": region["midi"], "tune": region["tune"], "articulation": region["articulation"],
                  "url": "/audio/violin/" + target.name, **(loop or {})}
    provenance = {**region, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                  "outputSha256": hashlib.sha256(target.read_bytes()).hexdigest()}
    return descriptor, provenance

assert len({Path(r['source']).stem for r in regions}) == len(regions), 'Duplicate output names'
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    results = list(pool.map(convert, regions))
descriptors = sorted([r[0] for r in results], key=lambda x:(x["articulation"], x["midi"], x["url"]))
(ROOT / "site/violin-samples.js").write_text("window.HP_VIOLIN_SAMPLES=" + json.dumps(descriptors, separators=(",", ":")) + ";\n")
credits = ROOT / "site/licenses/violin"
credits.mkdir(parents=True, exist_ok=True)
(credits / "CC0.txt").write_bytes(fetch("LICENSE").read_bytes())
(credits / "Readme.txt").write_bytes(fetch("Readme.txt").read_bytes())
(credits / "source.json").write_text(json.dumps({"name":"VSCO 2 Community Edition — Solo Violin", "author":"Versilian Studios / Sam Gossner", "license":"CC0-1.0", "source":"https://versilian-studios.com/vsco-community/", "repository":"https://github.com/sgossner/VSCO-2-CE", "commit":COMMIT, "processing":"Leading silence trim, peak normalization, crossfade sustain loops, 320 kbps AAC", "samples":[r[1] for r in results]}, indent=2))
print(f"Prepared {len(descriptors)} real violin samples; {sum(p.stat().st_size for p in OUT.glob('*.m4a'))/1e6:.1f} MB")
for descriptor, provenance in results:
    assert hashlib.sha256((ROOT / 'site' / descriptor['url'].lstrip('/')).read_bytes()).hexdigest() == provenance['outputSha256'], descriptor['url']
archive = io.BytesIO()
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.glob("*.m4a")):
        info = zipfile.ZipInfo("audio/violin/" + p.name, (2026, 10, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, p.read_bytes())
data = archive.getvalue()
parts = []
for number, start in enumerate(range(0, len(data), 393216)):
    chunk = data[start:start + 393216]
    name = f"violin.zip.part{number:03d}"
    (ROOT / "sample-bundles" / name).write_bytes(chunk)
    sha = hashlib.sha1(f"blob {len(chunk)}\0".encode() + chunk).hexdigest()
    parts.append({"name": name, "size": len(chunk), "sha": sha})
manifest = ROOT / "sample-bundles/parts.json"
bundles = [b for b in json.loads(manifest.read_text()) if b["name"] != "violin.zip"]
bundles.append({"name":"violin.zip", "size":len(data), "sha256":hashlib.sha256(data).hexdigest(), "parts":parts})
manifest.write_text(json.dumps(bundles, indent=2) + "\n")
print(f"Packed violin into {len(parts)} verified audio bundle parts")
