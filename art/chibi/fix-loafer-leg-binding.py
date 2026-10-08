"""Repair loafer ownership by connected shoe, preserving geometry and weight magnitudes."""
import hashlib,json,struct
from pathlib import Path

def repair(path):
 b=bytearray(path.read_bytes());n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);base=28+n
 def accessor(index):
  a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];size=struct.calcsize(fmt)
  def offset(i,k=0):return base+v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',size*width)+k*size
  rows=[struct.unpack_from('<'+fmt*width,b,offset(i)) for i in range(a['count'])]
  return rows,lambda i,k,value:struct.pack_into('<'+fmt,b,offset(i,k),value)
 changed=0
 for node in j['nodes']:
  if not node.get('name','').startswith('Sailor_shoes') or 'mesh' not in node:continue
  names=[j['nodes'][i]['name'] for i in j['skins'][node['skin']]['joints']]
  for pr in j['meshes'][node['mesh']]['primitives']:
   p,_=accessor(pr['attributes']['POSITION']);si,write=accessor(pr['attributes']['JOINTS_0']);sw,_=accessor(pr['attributes']['WEIGHTS_0']);rows,_=accessor(pr['indices']);idx=[r[0] for r in rows];parent=list(range(len(p)))
   def root(i):
    while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
    return i
   for k in range(0,len(idx),3):
    for v in idx[k+1:k+3]:parent[root(v)]=root(idx[k])
   groups={}
   for i in set(idx):groups.setdefault(root(i),[]).append(i)
   for ids in groups.values():
    owner='L' if sum(p[i][0] for i in ids)>0 else 'R'
    for i in ids:
     touched=False
     for k in range(4):
      name=names[si[i][k]]
      if sw[i][k]>0 and name.startswith(('R' if owner=='L' else 'L')+'_'):
       assert name[2:] in ('thigh','shin','foot','toe'),name
       write(i,k,names.index(owner+name[1:]));touched=True
     changed+=touched
 if changed:path.write_bytes(b)
 print(str(path), 'corrected vertices:',changed)
 return changed

if __name__=='__main__':
 public=Path('public/room3d/wardrobe/sailor-girl.glb');backup=Path('output/loafer-fix/before.glb');backup.parent.mkdir(parents=True,exist_ok=True)
 if not backup.exists():backup.write_bytes(public.read_bytes())
 repair(public)
 source=Path('output/cardigan-controller/sailor-girl.glb')
 if source.exists():repair(source)
 catalog=Path('apps/room3d/chibi/approvedWardrobe.json');items=json.loads(catalog.read_text(encoding='utf-8'));revision=hashlib.sha256(public.read_bytes()).hexdigest()[:12]
 for item in items:
  if item['asset']==public.name:item['revision']=revision
 catalog.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
