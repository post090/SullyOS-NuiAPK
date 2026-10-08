"""Rebuild only each knee-to-ankle tube through the validated tube remesher."""
import json,sys,math,subprocess,tempfile,pathlib
original=json.load(open(sys.argv[1],encoding='utf-8'));data=original
scale=.185/.14
def normalize(v):
 length=math.sqrt(sum(x*x for x in v));return [x/length for x in v]
with tempfile.TemporaryDirectory() as tmp:
 for side in [1,-1]:
  proxy={'positions':[],'normals':[],'indices':data['indices'][:]}
  for i in range(0,len(data['positions']),3):
   x,y,z=data['positions'][i:i+3];proxy['positions'] += [.12+(-y-.30)*scale,side*x+.041,z]
   nx,ny,nz=data['normals'][i:i+3];proxy['normals'] += normalize([-ny/scale,side*nx,nz])
  if side<0:
   for i in range(0,len(proxy['indices']),3):proxy['indices'][i+1],proxy['indices'][i+2]=proxy['indices'][i+2],proxy['indices'][i+1]
  inp=pathlib.Path(tmp)/'in.json';out=pathlib.Path(tmp)/'out.json';inp.write_text(json.dumps(proxy),encoding='utf-8')
  subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('retopologize-arms.py')),str(inp),str(out),'--single'],check=True)
  result=json.loads(out.read_text(encoding='utf-8'))
  # Restore existing points/normals exactly, avoiding roundoff outside the tube.
  known={tuple(proxy['positions'][i:i+3]):i for i in range(0,len(proxy['positions']),3)}
  for i in range(0,len(result['positions']),3):
   v=result['positions'][i:i+3];key=tuple(v);nx,ny,nz=result['normals'][i:i+3]
   if key in known:
    j=known[key];result['positions'][i:i+3]=data['positions'][j:j+3]
    if result['normals'][i:i+3]==proxy['normals'][j:j+3]:result['normals'][i:i+3]=data['normals'][j:j+3]
    else:result['normals'][i:i+3]=normalize([side*ny,-scale*nx,nz])
   else:
    x,y,z=v;result['positions'][i:i+3]=[side*(y-.041),-.30-(x-.12)/scale,z]
    result['normals'][i:i+3]=normalize([side*ny,-scale*nx,nz])
  if side<0:
   for i in range(0,len(result['indices']),3):result['indices'][i+1],result['indices'][i+2]=result['indices'][i+2],result['indices'][i+1]
  data=result
# Outside calves: source vertices are preserved, including all approved arm vertices.
def outside(p):return sorted(tuple(p[i:i+3]) for i in range(0,len(p),3) if not (-.44000001<=p[i+1]<=-.29999999))
assert outside(data['positions'])==outside(original['positions'])
json.dump(data,open(sys.argv[2],'w',encoding='utf-8'),separators=(',',':'))
print({'calfRetopoTriangles':len(data['indices'])//3,'vertices':len(data['positions'])//3,'outsideCalves':'unchanged'})
