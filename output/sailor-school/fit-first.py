import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path('D:/CHICK/SullyOS/output/sailor-school');out=Path('D:/CHICK/SullyOS/output/cardigan-controller')
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def material(name,c):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.85;return m
bpy.ops.wm.open_mainfile(filepath=str(r/'source-1.blend'));src=next(o for o in bpy.data.objects if o.type=='MESH');bpy.context.view_layer.objects.active=src;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Use the source only to identify its disconnected geometric pieces; all output materials are new.
bm=bmesh.new();bm.from_mesh(src.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.verts.ensure_lookup_table();seen=set();groups=[]
for v in bm.verts:
 if v in seen:continue
 todo=[v];seen.add(v);part=[]
 while todo:
  a=todo.pop();part.append(a)
  for e in a.link_edges:
   b=e.other_vert(a)
   if b not in seen:seen.add(b);todo.append(b)
 if len(part)>3:groups.append(part)
groups.sort(key=len,reverse=True)
# Retain only shirt/neck below the original head, separate sleeves, bow and shorts.
parts=[]
for group in groups:
 n=len(group);lo=[min(v.co[i] for v in group) for i in range(3)];hi=[max(v.co[i] for v in group) for i in range(3)]
 if n==1590:kind='torso';keep={v for v in group if v.co.z<.709}
 elif n==146:kind='sleeve';keep=set(group)
 elif n==286:kind='pants';keep=set(group)
 elif n==30:kind='tie';keep=set(group)
 elif n==18:kind='knot';keep=set(group)
 else:continue
 fs={f for v in keep for f in v.link_faces if all(x in keep for x in f.verts)};vs=list(keep);idx={v:i for i,v in enumerate(vs)}
 parts.append((kind,[v.co.copy() for v in vs],[[idx[v] for v in f.verts] for f in fs]))
bm.free()
# Bring in the existing narrow-shouldered character with its original bone names.
bpy.ops.wm.open_mainfile(filepath=str(out/'cardigan-preserved.blend'));body=bpy.data.objects['Mesh_0'];rig=bpy.data.objects['CurrentBody']
for o in list(bpy.data.objects):
 if o not in [body,rig]:bpy.data.objects.remove(o,do_unlink=True)
for p in rig.pose.bones:p.matrix_basis.identity()
white=material('Sailor cotton - warm white',(.82,.83,.81));navy=material('Sailor trim - navy',(.037,.048,.078));stripe=material('Sailor painted white lines',(.94,.95,.92));materials=[white,navy,stripe]
angle=math.radians(56);cos=math.cos(angle);sin=math.sin(angle)
def sleeve_map(p):
 side=1 if p.x>=0 else -1;dx=abs(p.x)-.065;dz=p.z-.665;u=dx*cos-dz*sin;h=dx*sin+dz*cos
 return Vector((side*(.285+u*4.55),(p.y+.073)*4.45-.03,3.125+h*4.05))
def torso_map(p):return Vector((p.x*4.2,(p.y+.078)*4.1-.05,(p.z-.665)*3.45+3.125))
def bind(ob,kind):
 for g in body.vertex_groups:ob.vertex_groups.new(name=g.name)
 for v in ob.data.vertices:
  x,y,z=v.co;ax=abs(x);side='L_' if x>=0 else 'R_'
  if kind=='pants':
   leg=1-smooth(1.98,2.35,z);left=smooth(-.1,.1,x);ws={'hips':1-leg,'L_thigh':leg*left,'R_thigh':leg*(1-left)}
  elif kind=='sleeve':
   elbow=smooth(.79,1.05,ax);root=smooth(.20,.43,ax);ws={side+'upperArm':root*(1-elbow),side+'forearm':root*elbow,'chest':1-root}
  elif kind in ['tie','knot','collar']:
   chest=smooth(2.5,2.95,z);ws={'chest':chest,'spine':1-chest}
  else:
   arm=smooth(.30,.55,ax)*smooth(2.7,3.05,z);chest=smooth(2.48,2.95,z);ws={side+'upperArm':arm,'chest':(1-arm)*chest,'spine':(1-arm)*(1-chest)}
  for n,w in ws.items():
   if w>1e-8:ob.vertex_groups[n].add([v.index],w,'REPLACE')
 ob.parent=rig;m=ob.modifiers.new('Body armature','ARMATURE');m.object=rig

def make(name,vs,fs,kind,mat=0):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
 for m in materials:mesh.materials.append(m)
 for f in mesh.polygons:f.use_smooth=True;f.material_index=mat
 bind(ob,kind);return ob

objects=[];source_torso=None;sleeves=[]
for num,(kind,vs,fs) in enumerate(parts):
 if kind=='torso':
  source_torso=(vs,fs)
  coords=[]
  for p in vs:
   q=torso_map(p);w=smooth(.069,.11,abs(p.x))*smooth(.54,.635,p.z)*(1-smooth(.674,.700,p.z))
   q=q.lerp(sleeve_map(p),w);coords.append(q)
  ob=make('Sailor_top',coords,fs,'torso')
  # Broad solid collar regions; stripe pattern is painted separately below.
  for poly,face in zip(ob.data.polygons,fs):
   p=sum((vs[i] for i in face),Vector())/len(face);ax=abs(p.x)
   back=p.y>-.066 and p.z>.605
   front=p.y<-.075 and p.z>.607 and p.z<.72 and ax>max(.005,(p.z-.613)*.30) and p.z>.615+ax*.49
   if back or front:poly.material_index=1
 elif kind=='sleeve':
  coords=[sleeve_map(p) for p in vs];ob=make('Sailor_sleeve_'+('L' if coords[0].x>0 else 'R'),coords,fs,'sleeve');end=max(abs(p.x) for p in coords)
  for f in ob.data.polygons:
   if abs(f.center.x)>end-.18:f.material_index=1
  sleeves.append((ob,end))
 elif kind=='pants':
  coords=[]
  for p in vs:
   q=Vector((p.x*4.7,(p.y+.079)*4.6-.045,(p.z-.49414)*4.1+2.49));t=smooth(2.22,2.46,q.z)
   theta=math.atan2((q.y+.045)/.25,q.x/.41);target=Vector((.375*math.cos(theta),-.055+.255*math.sin(theta),q.z));q=q.lerp(target,t*.82);coords.append(q)
  ob=make('Sailor_pants',coords,fs,'pants',1)
 else:ob=make('Sailor_'+kind+'_'+str(num),[torso_map(p) for p in vs],fs,kind,1 if kind=='tie' else 0)
 objects.append(ob)
# Flat ribbons follow the collar surface; they carry only a pure color, no image texture.
vs,fs=source_torso;tree=BVHTree.FromPolygons(vs,fs)
def stripe_path(name,path,back=False,width=.0028,mat=2):
 vertices=[];faces=[]
 for ai,(a,b) in enumerate(zip(path,path[1:])):
  a=Vector((a[0],0,a[1]));b=Vector((b[0],0,b[1]));tan=(b-a).normalized();cross=Vector((tan.z,0,-tan.x));rows=[]
  steps=max(2,int((b-a).length/.006))
  for j in range(steps+1):
   p=a.lerp(b,j/steps);row=[]
   for side in [-1,1]:
    q=p+cross*width*.5*side;origin=Vector((q.x,1 if back else -1,q.z));hit,n,idx,dist=tree.ray_cast(origin,Vector((0,-1 if back else 1,0)),2)
    if hit is None:row.append(None)
    else:hit.y+=.00035 if back else -.00035;row.append(torso_map(hit))
   rows.append(row)
  for j in range(steps):
   if any(p is None for p in rows[j]+rows[j+1]):continue
   k=len(vertices);vertices+=rows[j]+rows[j+1];faces.extend([(k,k+2,k+1),(k+1,k+2,k+3)])
 if faces:objects.append(make(name,vertices,faces,'collar',mat))
for sign in [-1,1]:
 stripe_path('Sailor_front_line_'+str(sign),[(sign*.103,.689),(sign*.012,.620)],width=.0028)
 stripe_path('Sailor_front_inner_'+str(sign),[(sign*.092,.695),(sign*.010,.635)],width=.0028)
for i in [0,1]:
 x=.102-i*.010;z=.618+i*.012
 stripe_path('Sailor_back_line_'+str(i),[(-x,.690),(-x+.007,z+.005),(0,z),(x-.007,z+.005),(x,.690)],back=True,width=.003)
for z in [.661,.666]:stripe_path('Sailor_insert_line_'+str(z),[(-.026,z),(.026,z)],width=.0016,mat=1)
for z in [.601,.608]:stripe_path('Sailor_pocket_line_'+str(z),[(.040,z),(.079,z)],width=.0022,mat=1)
for sleeve,end in sleeves:
 bvh=BVHTree.FromPolygons([v.co for v in sleeve.data.vertices],[list(p.vertices) for p in sleeve.data.polygons]);sign=1 if sleeve.data.vertices[0].co.x>0 else -1
 for number,center in enumerate([end-.046,end-.108]):
  verts=[];faces=[];rows=[]
  for i in range(49):
   a=i*math.tau/48;d=Vector((0,math.cos(a),math.sin(a)));row=[]
   for offset in [-.011,.011]:
    c=Vector((sign*(center+offset),-.03,3.125));p,n,idx,dist=bvh.ray_cast(c+d,-d,1.3);row.append(None if p is None else p+d*.0012)
   rows.append(row)
  for i in range(48):
   if any(p is None for p in rows[i]+rows[i+1]):continue
   k=len(verts);verts+=rows[i]+rows[i+1];faces.extend([(k,k+2,k+1),(k+1,k+2,k+3)])
  if faces:objects.append(make('Sailor_cuff_line_'+str(sign)+'_'+str(number),verts,faces,'sleeve',2))
for ob in [body,rig]+objects:ob.hide_set(False);ob.hide_render=False;ob.hide_viewport=False
bpy.context.view_layer.update();bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-school-fitted.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'sailor-school.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
counts={}
for o in objects:o.data.calc_loop_triangles();counts[o.name]=len(o.data.loop_triangles)
(r/'report.json').write_text(json.dumps({'triangles':counts,'total':sum(counts.values()),'sourceTriangles':8022,'textures':0},indent=2));print('REPORT',counts,sum(counts.values()))
for o in objects:
 world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
 for m in list(o.modifiers):o.modifiers.remove(m)
 for g in list(o.vertex_groups):o.vertex_groups.remove(g)
for category in ['top','pants','outfit']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:
  if category=='outfit' or (o.name=='Sailor_pants')==(category=='pants'):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-school-{category}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
