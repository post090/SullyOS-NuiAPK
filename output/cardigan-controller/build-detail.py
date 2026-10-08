import bpy,math,json,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path('D:/CHICK/SullyOS/output/cardigan-controller')
bpy.ops.wm.open_mainfile(filepath=str(r/'cardigan-preserved.blend'))
cloth=bpy.data.objects['Little_Cardigan'];body=bpy.data.objects['Mesh_0'];rig=bpy.data.objects['CurrentBody']
for p in rig.pose.bones:p.matrix_basis.identity()
land=json.loads((r/'detail-landmarks.json').read_text())
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def tree():return BVHTree.FromPolygons([v.co for v in cloth.data.vertices],[list(p.vertices) for p in cloth.data.polygons])
original=tree();stored=[n.vector.copy() for n in cloth.data.corner_normals];changed=set()
def front(bvh,x,z):
 p,n,idx,d=bvh.ray_cast(Vector((x,-2,z)),Vector((0,1,0)),4)
 return (p,n) if p is not None else (None,None)
# Flatten integrated lumps locally against the surrounding placket; keep all unedited split normals.
for item in land['buttons']+land['oldLeft']:
 cx,cy,cz=item['co'];samples=[]
 for a in np.linspace(0,2*math.pi,32,endpoint=False):
  x=cx+.068*math.cos(a);z=cz+.087*math.sin(a);p,n=front(original,x,z)
  if p is not None and abs(p.y-cy)<.14:samples.append((x-cx,z-cz,p.y))
 if len(samples)<5:continue
 coef=np.linalg.lstsq(np.array([[1,x,z] for x,z,y in samples]),np.array([y for x,z,y in samples]),rcond=None)[0]
 for v in cloth.data.vertices:
  x,y,z=v.co;rad=math.hypot((x-cx)/.064,(z-cz)/.08)
  if rad<1.2 and abs(y-cy)<.13:
   target=float(coef@[1,x-cx,z-cz]);w=1-smooth(.75,1.2,rad)
   if y<target:v.co.y+=(target-y)*w;changed.add(v.index)
# Raise only the upper sleeve around the exposed upper-arm wedge, feathered into existing folds.
for v in cloth.data.vertices:
 x,y,z=v.co;w=math.exp(-((x-.74)/.17)**4)*smooth(3.055,3.19,z)
 if w>.0001:v.co.z+=.105*w;changed.add(v.index)
cloth.data.update()
# Smooth across the export's duplicate positions without welding away the source normals.
normal_sum={}
key=lambda v:tuple(round(c,5) for c in v.co)
for poly in cloth.data.polygons:
 for vi in poly.vertices:
  k=key(cloth.data.vertices[vi]);normal_sum[k]=normal_sum.get(k,Vector())+poly.normal*poly.area
for i,loop in enumerate(cloth.data.loops):
 if loop.vertex_index in changed:stored[i]=normal_sum[key(cloth.data.vertices[loop.vertex_index])].normalized()
cloth.data.normals_split_custom_set(stored)
bvh=tree()
def surface_info(p):
 hit,n,idx,dist=bvh.find_nearest(p);poly=cloth.data.polygons[idx];ids=list(poly.vertices);a,b,c=[cloth.data.vertices[i].co for i in ids];v0=b-a;v1=c-a;v2=hit-a
 d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
 w1=(d11*d20-d01*d21)/den if abs(den)>1e-12 else 0;w2=(d00*d21-d01*d20)/den if abs(den)>1e-12 else 0;weights=[1-w1-w2,w1,w2]
 normal=sum((stored[li]*w for li,w in zip(poly.loop_indices,weights)),Vector()).normalized();return normal,ids,weights
# Interpolate the base garment's skin weights so relief stays attached during bends.
def bind(obj):
 for g in body.vertex_groups:obj.vertex_groups.new(name=g.name)
 for v in obj.data.vertices:
  n,ids,bary=surface_info(v.co);weights={}
  for vi,factor in zip(ids,bary):
   for g in cloth.data.vertices[vi].groups:
    name=cloth.vertex_groups[g.group].name;weights[name]=weights.get(name,0)+g.weight*max(0,factor)
  total=sum(weights.values())
  for name,w in weights.items():
   if w>1e-8:obj.vertex_groups[name].add([v.index],w/total,'REPLACE')
 obj.parent=rig;mod=obj.modifiers.new('Follow cardigan','ARMATURE');mod.object=rig
verts=[];faces=[];counts={};ribNormals=[]
def patch(points,category):
 if any(p is None for row in points for p in row):return
 base=len(verts);nr=len(points);nc=len(points[0]);verts.extend(tuple(p) for row in points for p in row)
 for j,row in enumerate(points):
  for i,p in enumerate(row):
   n,ids,ws=surface_info(p);du=points[j][min(i+1,nc-1)]-points[j][max(i-1,0)];dt=points[min(j+1,nr-1)][i]-points[max(j-1,0)][i];gn=du.cross(dt).normalized()
   if gn.dot(n)<0:gn=-gn
   blend=.85*math.sin(math.pi*i/(nc-1))*math.sin(math.pi*j/(nr-1));ribNormals.append(n.lerp(gn,blend).normalized())
 for j in range(nr-1):
  for i in range(nc-1):
   a=base+j*nc+i;faces.extend([(a,a+nc,a+1),(a+1,a+nc,a+nc+1)])
 counts[category]=counts.get(category,0)+1
# Low arched ribs, embedded at edges and ends, following the actual low-poly surface.
def ridge(center,direction,length,width,category):
 tangent=Vector((direction[0],0,direction[2])).normalized();cross=Vector((tangent.z,0,-tangent.x));rows=[]
 for t in [-1,0,1]:
  row=[]
  for u in [-1,-.5,0,.5,1]:
   v=center+tangent*(length*.5*t)+cross*(width*.5*u);p,n=front(bvh,v.x,v.z)
   if p is None or abs(p.y-center.y)>.14:row.append(None);continue
   n=Vector((n.x,min(n.y,-.2),n.z)).normalized();height=.009*(1-abs(u))*min(1,(1-abs(t))*1.5)+.0003
   row.append(p+n*height)
  rows.append(row)
 patch(rows,category)
def path_samples(name,spacing):
 ps=[Vector(p['co']) for p in land[name]];lengths=[(b-a).length for a,b in zip(ps,ps[1:])];total=sum(lengths);out=[]
 for d in np.linspace(.008,total-.008,max(2,int(total/spacing))):
  for i,l in enumerate(lengths):
   if d<=l:out.append((ps[i].lerp(ps[i+1],d/l),(ps[i+1]-ps[i]).normalized()));break
   d-=l
 return out
for name in ['placketLeft','placketRight']:
 for p,tan in path_samples(name,.065):
  if any(math.hypot((p.x-k['co'][0])/.06,(p.z-k['co'][2])/.072)<1 for k in land['buttons']):continue
  ridge(p,Vector((tan.z,0,-tan.x)),.09,.044,'placket')
for name in ['pocketLeft','pocketRight']:
 for p,tan in path_samples(name,.046):
  p.z-=.035;ridge(p,Vector((0,0,1)),.084,.036,'pockets')
for side in [-1,1]:
 for angle in np.linspace(0,math.tau,16,endpoint=False):
  rows=[]
  for t in [-1,0,1]:
   row=[]
   for u in [-1,-.5,0,.5,1]:
    a=angle+u*.12;direction=Vector((0,math.cos(a),math.sin(a)));center=Vector((side*(1.30+.06*t),-.021186,3.125));p,n,idx,d=bvh.ray_cast(center+direction, -direction,1)
    row.append(None if p is None else p+direction*(.009*(1-abs(u))*min(1,(1-abs(t))*1.5)+.0003))
   rows.append(row)
  patch(rows,'cuffs')
# Hem ribs wrap around the lower silhouette, including the back.
low=[v.co.copy() for v in cloth.data.vertices if v.co.z<2.04]
for angle in np.linspace(0,math.tau,40,endpoint=False):
 direction=Vector((math.cos(angle),math.sin(angle),0));near=[p for p in low if abs(math.atan2(math.sin(math.atan2(p.y,p.x)-angle),math.cos(math.atan2(p.y,p.x)-angle)))<.08]
 if not near:continue
 bottom=min(p.z for p in near);rows=[]
 for t in [-1,0,1]:
  row=[]
  for u in [-1,-.5,0,.5,1]:
   a=angle+u*.05;d=Vector((math.cos(a),math.sin(a),0));center=Vector((0,0,bottom+.085+t*.055));p,n,idx,dist=bvh.ray_cast(center+d*1.2,-d,1.15)
   row.append(None if p is None or Vector((p.x,p.y,0)).dot(d)<.19 else p+d*(.009*(1-abs(u))*min(1,(1-abs(t))*1.5)+.0003))
  rows.append(row)
 patch(rows,'hem')
def meshobj(name,vs,fs,mat):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat)
 for p in mesh.polygons:p.use_smooth=True
 bind(obj);return obj
for i,(a,b,c) in enumerate(faces):
 if (Vector(verts[b])-Vector(verts[a])).cross(Vector(verts[c])-Vector(verts[a])).dot(ribNormals[a]+ribNormals[b]+ribNormals[c])<0:faces[i]=(a,c,b)
ribs=meshobj('Little_Cardigan_Ribbing',verts,faces,cloth.data.materials[0]);ribs.data.normals_split_custom_set_from_vertices(ribNormals)
# Four independent shallow convex discs, 36 triangles each. Cloth conceals the open backs.
vs=[];fs=[]
for k in land['buttons']:
 c=Vector(k['co']);p,n=front(bvh,c.x,c.z)
 if p is None:continue
 n=Vector((n.x,min(n.y,-.5),n.z)).normalized();u=Vector((1,0,0));u=(u-n*u.dot(n)).normalized();v=n.cross(u);base=len(vs)
 for radius,height in [(.052,.004),(.036,.014)]:
  for i in range(12):vs.append(tuple(p+u*(radius*math.cos(i*math.tau/12))+v*(radius*math.sin(i*math.tau/12))+n*height))
 vs.append(tuple(p+n*.019))
 for i in range(12):
  j=(i+1)%12;fs.extend([(base+i,base+j,base+12+j),(base+i,base+12+j,base+12+i),(base+12+i,base+12+j,base+24)])
mat=cloth.data.materials[0].copy();mat.name='Cardigan buttons - recolorable'
buttons=meshobj('Little_Cardigan_Buttons',vs,fs,mat)
for o in list(bpy.data.objects):
 if o not in [cloth,body,rig,ribs,buttons]:bpy.data.objects.remove(o,do_unlink=True)
for ob in [cloth,body,rig,ribs,buttons]:ob.hide_set(False);ob.hide_render=False;ob.hide_viewport=False
bpy.context.view_layer.update();bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(r/'cardigan-detail.blend'))
bpy.ops.export_scene.gltf(filepath=str(r/'cardigan-rig-detail.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
report={'parts':{},'ribCounts':counts,'baseVerticesAdjusted':len(changed)}
for ob in [cloth,ribs,buttons]:ob.data.calc_loop_triangles();report['parts'][ob.name]=len(ob.data.loop_triangles)
report['totalTriangles']=sum(report['parts'].values());(r/'detail-report.json').write_text(json.dumps(report,indent=2));print(report)






# Garment-only, unrigged T-pose delivery, with the buttons and knit relief editable separately.
for ob in [cloth,ribs,buttons]:
 world=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=world
 for mod in list(ob.modifiers):ob.modifiers.remove(mod)
 for group in list(ob.vertex_groups):ob.vertex_groups.remove(group)
bpy.ops.object.select_all(action='DESELECT')
for ob in [cloth,ribs,buttons]:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(r/'cardigan-detail-only.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)


