import bpy,bmesh,math,json,numpy as np
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
im=next(im for im in bpy.data.images if im.type=='IMAGE');pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape((im.size[1],im.size[0],4));uvlayer=bm.loops.layers.uv.active

def darkface(f):
 uvs=[l[uvlayer].uv.copy() for l in f.loops];center=sum(uvs,Vector((0,0)))/len(uvs);samples=[center]+[center.lerp(v,t) for v in uvs for t in [.35,.70,.95]]
 values=[float(np.mean(pixels[int(max(0,min(.99999,p.y))*im.size[1]),int(max(0,min(.99999,p.x))*im.size[0]),:3])) for p in samples]
 return min(values)<.56
# Retain only shirt/neck below the original head, separate sleeves, bow and shorts.
parts=[]
for group in groups:
 n=len(group);lo=[min(v.co[i] for v in group) for i in range(3)];hi=[max(v.co[i] for v in group) for i in range(3)]
 if n==1590:kind='torso';keep={v for v in group if v.co.z<.709 and not(v.co.z>.688 and (v.co.y<-.17 or v.co.y>.022)) and not(v.co.z>.700 and v.co.y<-.12)}
 elif n==146:kind='sleeve';keep=set(group)
 elif n==286:kind='pants';keep=set(group)
 elif n==30:kind='tie';keep=set(group)
 elif n==18:kind='knot';keep=set(group)
 else:continue
 fs={f for v in keep for f in v.link_faces if all(x in keep for x in f.verts)};vs=list(keep);idx={v:i for i,v in enumerate(vs)}
 parts.append((kind,[v.co.copy() for v in vs],[[idx[v] for v in f.verts] for f in fs],[darkface(f) for f in fs]))
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
 return Vector((side*(.285+u*4.55),(p.y+.073)*5.15-.045,3.215+h*4.75))
def torso_map(p):
 z=(p.z-.665)*3.45+3.125;y=(p.y+.078)*4.1-.05;y-=.075*smooth(-.055,-.16,y) if y<-.055 else 0
 return Vector((p.x*4.2,y,z+.18*smooth(2.7,3.25,z)))
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
   arm=0;chest=smooth(2.48,2.95,z);ws={side+'upperArm':arm,'chest':(1-arm)*chest,'spine':(1-arm)*(1-chest)}
  for n,w in ws.items():
   if w>1e-8:ob.vertex_groups[n].add([v.index],w,'REPLACE')
 ob.parent=rig;m=ob.modifiers.new('Body armature','ARMATURE');m.object=rig

def make(name,vs,fs,kind,mat=0):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
 for m in materials:mesh.materials.append(m)
 for f in mesh.polygons:f.use_smooth=True;f.material_index=mat
 bind(ob,kind);return ob

exec((r/'paint-lines.py').read_text(),{})
frontmat=white.copy();frontmat.name='Sailor hand-drawn flat front';backmat=white.copy();backmat.name='Sailor hand-drawn flat back'
for mat,key in [(frontmat,'front'),(backmat,'back')]:
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images['Sailor flat '+key];mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
objects=[];source_torso=None;sleeves=[]
for num,(kind,vs,fs,darks) in enumerate(parts):
 if kind=='torso':
  source_torso=(vs,fs)
  coords=[]
  for p in vs:
   q=torso_map(p)
   # A stiff, gently flared shell conceals the waist instead of following it.
   flare=max(0,min(1,(3.05-q.z)/(3.05-2.36)))
   q.x*=1+.13*flare
   q.y=-.05+(q.y+.05)*(1+.045*flare)
   coords.append(q)
  ob=make('Sailor_top',coords,fs,'torso')
  ob.data.materials.clear();ob.data.materials.append(frontmat);ob.data.materials.append(backmat);uv=ob.data.uv_layers.new(name='Hand painted projection')
  for poly,face in zip(ob.data.polygons,fs):
   p=sum((vs[i] for i in face),Vector())/len(face);poly.material_index=0 if p.y<-.065 else 1
  for loop in ob.data.loops:
   p=vs[loop.vertex_index];uv.data[loop.index].uv=((p.x+.145)/.29,(p.z-.43)/.30)
 elif kind=='sleeve':
  coords=[sleeve_map(p) for p in vs];ob=make('Sailor_sleeve_'+('L' if coords[0].x>0 else 'R'),coords,fs,'sleeve');end=max(abs(p.x) for p in coords)
  # Replace the jagged capped end with a continuous open cuff and inner lip.
  side=1 if coords[0].x>0 else -1;cut=end-.19
  bm=bmesh.new();bm.from_mesh(ob.data)
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(side*cut,0,0),plane_no=(side,0,0),clear_outer=True)
  edges=[e for e in bm.edges if e.is_boundary and all(abs(abs(v.co.x)-cut)<.00001 for v in e.verts)]
  for axial,radius in [(end-.005,.19),(end-.005,.184),(end-.025,.184)]:
   result=bmesh.ops.extrude_edge_only(bm,edges=edges)
   newverts=[v for v in result['geom'] if isinstance(v,bmesh.types.BMVert)]
   for v in newverts:
    a=math.atan2(v.co.z-3.15,v.co.y+.045);v.co=Vector((side*axial,-.045+radius*math.cos(a),3.15+radius*math.sin(a)))
   for f in result['geom']:
    if isinstance(f,bmesh.types.BMFace):f.material_index=1
   newset=set(newverts);edges=[e for e in bm.edges if all(v in newset for v in e.verts)]
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
  # New cuff vertices need weights assigned in the final rest geometry.
  ob.vertex_groups.clear()
  for modifier in list(ob.modifiers):
   if modifier.type=='ARMATURE':ob.modifiers.remove(modifier)
  bind(ob,'sleeve')
  sleeves.append((ob,end))
 elif kind=='pants':
  coords=[]
  for p in vs:
   q=Vector((p.x*4.7,(p.y+.079)*6.2-.055,(p.z-.49414)*4.1+2.49))
   # Only the waistband follows the waist. Keep the source's straight legs and wider folded hems.
   t=smooth(2.38,2.48,q.z);theta=math.atan2((q.y+.055)/.30,q.x/.43);target=Vector((.375*math.cos(theta),-.055+.255*math.sin(theta),q.z));q=q.lerp(target,t*.80)
   coords.append(q)
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
for sleeve,end in sleeves:
 bvh=BVHTree.FromPolygons([v.co for v in sleeve.data.vertices],[list(p.vertices) for p in sleeve.data.polygons]);sign=1 if sleeve.data.vertices[0].co.x>0 else -1
 for number,center in enumerate([end-.046,end-.108]):
  verts=[];faces=[];rows=[]
  for i in range(49):
   a=i*math.tau/48;d=Vector((0,math.cos(a),math.sin(a)));row=[]
   for offset in [-.011,.011]:
    c=Vector((sign*(center+offset),-.03,3.125));p,n,idx,dist=bvh.ray_cast(c+d,-d,1.3);row.append(None if p is None else p+d*.005)
   rows.append(row)
  for i in range(48):
   if any(p is None for p in rows[i]+rows[i+1]):continue
   k=len(verts);verts+=rows[i]+rows[i+1];faces.extend([(k,k+2,k+1),(k+1,k+2,k+3)])
  if faces:objects.append(make('Sailor_cuff_line_'+str(sign)+'_'+str(number),verts,faces,'sleeve',2))
# Keep only two wearable objects: all shirt details together, and trousers separately.
top=next(o for o in objects if o.name=='Sailor_top');pants=next(o for o in objects if o.name=='Sailor_pants');bpy.ops.object.select_all(action='DESELECT')
for o in objects:
 if o!=pants:o.select_set(True)
bpy.context.view_layer.objects.active=top;bpy.ops.object.join();objects=[top,pants]
for ob in [body,rig]+objects:ob.hide_set(False);ob.hide_render=False;ob.hide_viewport=False
bpy.context.view_layer.update();bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-school-fitted.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'sailor-school.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
counts={}
for o in objects:o.data.calc_loop_triangles();counts[o.name]=len(o.data.loop_triangles)
(r/'report.json').write_text(json.dumps({'triangles':counts,'total':sum(counts.values()),'sourceTriangles':8022,'textures':2},indent=2));print('REPORT',counts,sum(counts.values()))
for o in objects:
 world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
 for m in list(o.modifiers):o.modifiers.remove(m)
 for g in list(o.vertex_groups):o.vertex_groups.remove(g)
for category in ['top','pants','outfit']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:
  if category=='outfit' or (o.name=='Sailor_pants')==(category=='pants'):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-school-{category}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)





