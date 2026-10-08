"""Replace only the arm tubes with shared circumferential loops; preserve body/legs/hands.
Usage: python retopologize-arms.py input.json output.json
"""
import json, math, sys
from collections import Counter, defaultdict
single='--single' in sys.argv
planes=[.12,.305] if single else [-.305,-.12,.12,.305]
ring_count=16 if single else 20
ylo,yhi=(.041,.3) if single else (.03,.13)
src=json.load(open(sys.argv[1],encoding='utf-8'))
p=[src['positions'][i:i+3] for i in range(0,len(src['positions']),3)]
n=[src['normals'][i:i+3] for i in range(0,len(src['normals']),3)]
f=[src['indices'][i:i+3] for i in range(0,len(src['indices']),3)]
original=[v[:] for v in p];original_faces=[t[:] for t in f]
def arm(t):return all(ylo<p[i][1]<yhi for i in t)
def cut(plane):
 global f
 cache={};out=[]
 def intersect(a,b):
  key=tuple(sorted((a,b)))
  if key in cache:return cache[key]
  t=(plane-p[a][0])/(p[b][0]-p[a][0])
  if t<1e-8:return a
  if t>1-1e-8:return b
  v=[p[a][k]*(1-t)+p[b][k]*t for k in range(3)];v[0]=plane
  normal=[n[a][k]*(1-t)+n[b][k]*t for k in range(3)];length=math.sqrt(sum(x*x for x in normal));normal=[x/length for x in normal]
  cache[key]=len(p);p.append(v);n.append(normal);return cache[key]
 for tri in f:
  xs=[p[i][0] for i in tri]
  if not arm(tri) or not min(xs)<plane<max(xs):out.append(tri);continue
  for side in (-1,1):
   poly=[]
   for a,b in zip(tri,tri[1:]+tri[:1]):
    da=(p[a][0]-plane)*side;db=(p[b][0]-plane)*side
    if da>=0:poly.append(a)
    if da*db<0:poly.append(intersect(a,b))
   for j in range(1,len(poly)-1):
    t=[poly[0],poly[j],poly[j+1]]
    if len(set(t))==3:out.append(t)
 f=out
for plane in planes:cut(plane)
f=[t for t in f if not (arm(t) and all(.12-1e-8<=(p[i][0] if single else abs(p[i][0]))<=.305+1e-8 for i in t))]
edges=Counter(tuple(sorted((a,b))) for t in f for a,b in zip(t,t[1:]+t[:1]))
boundaries={}
for plane in planes:
 es=[e for e,count in edges.items() if count==1 and all(abs(p[i][0]-plane)<1e-7 for i in e)]
 ids=set(i for e in es for i in e);degree=Counter(i for e in es for i in e)
 assert ids and all(v==2 for v in degree.values()),('Bad cut loop',plane,degree)
 boundaries[plane]=list(ids)
def center(ids):return [(min(p[i][k] for i in ids)+max(p[i][k] for i in ids))/2 for k in [1,2]]
def sorted_ring(ids):
 cy,cz=center(ids)
 return sorted([(math.atan2(p[i][2]-cz,p[i][1]-cy)%(2*math.pi),i) for i in ids])
def section(x):
 pts=[]
 for t in original_faces:
  if not all(ylo<original[i][1]<yhi for i in t):continue
  for a,b in zip(t,t[1:]+t[:1]):
   va,vb=original[a],original[b]
   if min(va[0],vb[0])<=x<=max(va[0],vb[0]) and abs(va[0]-vb[0])>1e-10:
    r=(x-va[0])/(vb[0]-va[0]);pts.append([va[k]*(1-r)+vb[k]*r for k in (1,2)])
 assert pts
 cy=(min(v[0] for v in pts)+max(v[0] for v in pts))/2;cz=(min(v[1] for v in pts)+max(v[1] for v in pts))/2
 ry=(max(v[0] for v in pts)-min(v[0] for v in pts))/2;rz=(max(v[1] for v in pts)-min(v[1] for v in pts))/2
 return cy,cz,ry,rz
newfaces=[]
def stitch(a,b):
 A=sorted_ring(a);B=sorted_ring(b);i=j=0
 while i<len(A) or j<len(B):
  ai=A[i%len(A)][1];bj=B[j%len(B)][1]
  an=A[(i+1)%len(A)][0]+(2*math.pi if i+1>=len(A) else 0)
  bn=B[(j+1)%len(B)][0]+(2*math.pi if j+1>=len(B) else 0)
  if i<len(A) and (j==len(B) or an<bn):newfaces.append([ai,bj,A[(i+1)%len(A)][1]]);i+=1
  else:newfaces.append([ai,bj,B[(j+1)%len(B)][1]]);j+=1
# Round, regular cross-sections rather than repeated cuts through long triangles.
# Preserve each original section's width/thickness, smooth its small axial bumps.
xs=[.12,.13,.145,.16,.175,.185,.195,.2025,.21,.2175,.225,.235,.245,.255,.266,.278,.285,.2925,.299,.305]
if single:xs=[.12,.13,.15,.17,.19,.21,.23,.25,.27,.29,.30,.305]
for sign in ([1] if single else [-1,1]):
 previous=boundaries[sign*.12]
 samples=[section(sign*x) for x in xs]
 for j,x in enumerate(xs[1:-1],1):
  # Light longitudinal smoothing, no shrink of the rest section's mean radius.
  values=[samples[j][k]*.6+(samples[j-1][k]+samples[j+1][k])*.2 for k in range(4)]
  cy,cz,ry,rz=values;ids=[]
  for k in range(ring_count):
   angle=k*2*math.pi/ring_count;ids.append(len(p));p.append([sign*x,cy+ry*math.cos(angle),cz+rz*math.sin(angle)]);n.append([0,0,0])
  stitch(previous,ids);previous=ids
 stitch(previous,boundaries[sign*.305])
# Orient the new tube faces outward, then verify boundary winding consistency.
for t in newfaces:
 a,b,c=[p[i] for i in t];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
 cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 cy,cz,_,_=section(sum(v[0] for v in [a,b,c])/3)
 radial=[sum(v[k] for v in [a,b,c])/3-q for k,q in [(1,cy),(2,cz)]]
 if cross[1]*radial[0]+cross[2]*radial[1]<0:t[1],t[2]=t[2],t[1]
f+=newfaces
counts=Counter(tuple(sorted((a,b))) for t in f for a,b in zip(t,t[1:]+t[:1]))
assert all(v==2 for v in counts.values()),Counter(counts.values())
directed=Counter((a,b) for t in f for a,b in zip(t,t[1:]+t[:1]))
assert all(directed[(b,a)]==v for (a,b),v in directed.items()),'Inconsistent winding'
# Recompute normals only for the rebuilt tube and its seam vertices.
changed=set(i for t in newfaces for i in t);sums={i:[0,0,0] for i in changed}
for t in f:
 a,b,c=[p[i] for i in t];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
 cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 for i in t:
  if i in sums:sums[i]=[sums[i][k]+cross[k] for k in range(3)]
for i,v in sums.items():
 length=math.sqrt(sum(x*x for x in v));assert length>1e-10;n[i]=[x/length for x in v]
used=sorted(set(i for t in f for i in t));mapping={v:i for i,v in enumerate(used)}
result={'positions':[x for i in used for x in p[i]],'normals':[x for i in used for x in n[i]],'indices':[mapping[i] for t in f for i in t]}
assert len(f)<=(6500 if single else 6000), len(f)
# Every original vertex outside the arm replacement is kept in place.
for i,v in enumerate(original):
 if not (.12<=(v[0] if single else abs(v[0]))<=.305 and ylo<v[1]<yhi):assert i in mapping and p[i]==v
json.dump(result,open(sys.argv[2],'w',encoding='utf-8'),separators=(',',':'))
print({'triangles':len(f),'vertices':len(used),'tubeTriangles':len(newfaces),'outsideArm':'unchanged','manifold':True})
