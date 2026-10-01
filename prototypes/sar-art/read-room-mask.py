"""Read the supplied mask without modifying artwork. Run from the worktree root."""
import json
from collections import deque
from pathlib import Path
from PIL import Image

mask = Image.open('assets/sar/room-walk-mask.png').convert('RGBA')
w, h = mask.size
pixels = mask.load()
def zone(x, y):
    if not (0 <= x < w and 0 <= y < h): return 0
    r,g,b,a = pixels[x,y]
    if a < 128: return 0
    if g > 180 and g > r + 25 and b < 180: return 2
    if r > 150 and r > g * 1.4 and b < 130: return 1
    return 0

# Exact per-pixel runs; no approximate rectangle can spill into furniture.
rows = []
for y in range(h):
    spans, start, prev = [], 0, 0
    for x in range(w + 1):
        current = zone(x,y)
        if current != prev:
            if prev: spans.append([start,x-1,prev])
            start,prev = x,current
    rows.append(spans)

# Candidate foot centres have an inset elliptical footprint in the same zone.
candidates = []
for y in range(0,h,16):
    for x in range(0,w,16):
        z=zone(x,y)
        if z and all(zone(x+dx,y+dy)==z for dx,dy in [(0,0),(-20,0),(20,0),(0,-9),(0,9),(-14,-6),(14,6),(-14,6),(14,-6)]):
            candidates.append([x,y,z])

points = Image.open('assets/sar/room-hotspots.png').convert('RGBA')
marked = {(x,y) for y in range(h) for x in range(w) if (lambda p:p[3]>128 and p[0]>100 and p[1]<100)(points.getpixel((x,y)))}
centres=[]
while marked:
    seed=next(iter(marked)); marked.remove(seed); queue=deque([seed]); group=[]
    while queue:
        x,y=queue.popleft(); group.append((x,y))
        for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if p in marked: marked.remove(p); queue.append(p)
    if len(group)>20: centres.append([round(sum(p[0] for p in group)/len(group),2),round(sum(p[1] for p in group)/len(group),2)])
centres.sort(key=lambda p:p[1])
result={'width':w,'height':h,'rows':rows,'candidates':candidates,'hotspots':dict(zip(['board','modules','cabinet','gacha','water'],centres))}
Path('utils/vrWorld/sarRoomMask.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print(json.dumps({'dimensions':[w,h],'candidates':len(candidates),'hotspots':result['hotspots']},ensure_ascii=False))
