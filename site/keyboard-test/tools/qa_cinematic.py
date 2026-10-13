#!/usr/bin/env python3
"""Generate small reference frames for the gacha video QA only."""
import base64
from io import BytesIO
from pathlib import Path
import subprocess
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/"piano-pullback-press-v5.mp4"
times=[0.4,1.77,1.85,1.94,2.04,2.16,2.38,2.9,3.6,4.2]
frames=[]
for t in times:
    blob=subprocess.check_output(["ffmpeg","-hide_banner","-loglevel","error","-ss",str(t),"-i",str(source),"-frames:v","1","-f","image2pipe","-vcodec","png","-"])
    f=Image.open(BytesIO(blob)).convert("RGB");f.thumbnail((480,280))
    frames.append(f.copy())
W=480*5;H=310*2
out=Image.new("RGB",(W,H),"#17171c");d=ImageDraw.Draw(out)
for i,(t,img) in enumerate(zip(times,frames)):
    x=(i%5)*480;y=(i//5)*310
    out.paste(img,(x,y+28));d.text((x+7,y+7),f"{t:.2f}s",fill="#fff3dd")
buff=BytesIO();out.save(buff,format="JPEG",quality=82,optimize=True)
(ROOT/"_debug_reference.b64").write_text(base64.b64encode(buff.getvalue()).decode("ascii"))
print("STORYBOARD",len(buff.getvalue()),"original frames:",[(round(t,2),f.size)for t,f in zip(times,frames)])
