import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
r=Path('D:/CHICK/SullyOS/output/sailor-girl');out=r.parent/'cardigan-controller'
bpy.ops.wm.open_mainfile(filepath=str(r/'source-1.blend'));src=next(o for o in bpy.data.objects if o.type=='MESH');bpy.context.view_layer.objects.active=src;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new();bm.from_mesh(src.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);seen=set();parts=[]
for v in bm.verts:
 if v in seen:continue
 group=[];todo=[v];seen.add(v)
 while todo:
  a=todo.pop();group.append(a)
  for e in a.link_edges:
   b=e.other_vert(a)
   if b not in seen:seen.add(b);todo.append(b)
 n=len(group);kind={181:'torso',252:'skirt',139:'sleeve',305:'collar',54:'tie',27:'bow',15:'knot',275:'shoe',40:'shoe'}.get(n)
 if not kind:continue
 keep=set(group);faces={f for v in group for f in v.link_faces if all(a in keep for a in f.verts)};ids={v:i for i,v in enumerate(group)}
 parts.append((kind,[v.co.copy() for v in group],[[ids[v] for v in f.verts] for f in faces]))
bm.free()
bpy.ops.wm.open_mainfile(filepath=str(out/'cardigan-preserved.blend'));body=bpy.data.objects['Mesh_0'];rig=bpy.data.objects['CurrentBody']
for o in list(bpy.data.objects):
 if o not in [body,rig]:bpy.data.objects.remove(o,do_unlink=True)
for b in rig.pose.bones:b.matrix_basis.identity()
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mat(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.82;return m
white=mat('School cotton',(.82,.83,.81));navy=mat('School navy',(.037,.048,.078));line=mat('School white piping',(.94,.95,.92));black=mat('Shared loafers',(.027,.033,.045));mats=[white,navy,line,black]
def torso(p):
 z=2.36+(p.z-.4468)*4.0;flare=1+.08*max(0,min(1,(3.1-z)/.74))
 return Vector((p.x*4.4*flare,p.y*4.3-.05,z+.18*smooth(2.7,3.25,z)))
def sleeve(p):
 s=1 if p.x>0 else -1;a=math.radians(55);dx=abs(p.x)-.061;dz=p.z-.638
 return Vector((s*(.29+4.7*(dx*math.cos(a)-dz*math.sin(a))),p.y*4.7-.035,3.23+4.7*(dx*math.sin(a)+dz*math.cos(a))))
def bind(o,kind):
 for g in body.vertex_groups:o.vertex_groups.new(name=g.name)
 for v in o.data.vertices:
  x,y,z=v.co;s='L_' if x>=0 else 'R_';ax=abs(x)
  if kind=='sleeve':t=smooth(.20,.43,ax);weights={'chest':1-t,s+'upperArm':t}
  elif kind=='skirt':weights={'hips':1}
  elif kind=='shoe':weights={s+'foot':1}
  elif kind=='sock':t=smooth(.26,.48,z);weights={s+'shin':t,s+'foot':1-t}
  else:t=smooth(2.48,2.95,z);weights={'chest':t,'spine':1-t}
  for n,w in weights.items():
   if w:o.vertex_groups[n].add([v.index],w,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('Body armature','ARMATURE');mod.object=rig
def make(name,vs,fs,kind,mi=0):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
 for m in mats:me.materials.append(m)
 for f in me.polygons:f.material_index=mi;f.use_smooth=True
 bind(ob,kind);return ob
objects=[]
for kind,vs,fs in parts:
 if kind=='skirt':coords=[Vector((p.x*4.6,p.y*4.7-.025,2.49+(p.z-.4834)*4.4)) for p in vs]
 elif kind=='sleeve':coords=[sleeve(p) for p in vs]
 elif kind=='shoe':
  coords=[Vector(((1 if p.x>0 else -1)*.235+(p.x-(.047 if p.x>0 else -.047))*4.9,p.y*4.0+.045,p.z*4.6+.015)) for p in vs]
 else:coords=[torso(p) for p in vs]
 ob=make('Sailor_'+kind,coords,fs,kind,3 if kind=='shoe' else 1 if kind in ['skirt','tie','bow','collar'] else 0);objects.append(ob)
 if kind=='sleeve':
  # Thin, open short-sleeve cuff, with two painted-looking flat bands.
  end=max(abs(p.x) for p in coords);sgn=1 if coords[0].x>0 else -1;cut=end-.035
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(sgn*cut,0,0),plane_no=(sgn,0,0),clear_outer=True)
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(sgn*(cut-.11),0,0),plane_no=(sgn,0,0));bm.to_mesh(ob.data);bm.free()
  for f in ob.data.polygons:
   ax=sum(abs(ob.data.vertices[i].co.x) for i in f.vertices)/len(f.vertices)
   if ax>cut-.11:f.material_index=1
  ob.vertex_groups.clear();ob.modifiers.clear();bind(ob,kind)
  # Surface rings derived from the sleeve mesh, avoiding an extra bulky cuff.
  from mathutils.bvhtree import BVHTree
  tree=BVHTree.FromPolygons([v.co for v in ob.data.vertices],[list(f.vertices) for f in ob.data.polygons])
  for center in [cut-.023,cut-.078]:
   pts=[];faces=[]
   for i in range(49):
    a=i*math.tau/48;d=Vector((0,math.cos(a),math.sin(a)))
    for offset in [-.009,.009]:
     origin=Vector((sgn*(center+offset),-.035,3.23));h,_,_,_=tree.ray_cast(origin+d,-d,2);pts.append(h+d*.003 if h is not None else origin+d*.2)
   for i in range(48):faces.append((2*i,2*i+1,2*i+3,2*i+2))
   objects.append(make('Sailor_cuff_stripe',pts,faces,'sleeve',2))
 if kind=='collar':
  # Draw narrow double stripes directly onto source collar surface.
  from mathutils.bvhtree import BVHTree
  tree=BVHTree.FromPolygons(vs,fs)
  paths=[]
  for s in [-1,1]:
   for off in [0,.007]:paths.append(([(s*(.092-off),.667),(s*(.012+off*.5),.603+off)],False))
  for off in [0,.008]:paths.append(([(-.091+off,.673),(-.087+off,.603+off),(0,.599+off),(.087-off,.603+off),(.091-off,.673)],True))
  for path,back in paths:
   pts=[];faces=[]
   for a,b in zip(path,path[1:]):
    a=Vector((a[0],0,a[1]));b=Vector((b[0],0,b[1]));d=(b-a).normalized();cross=Vector((d.z,0,-d.x))
    for j in range(30):
     row=[]
     for f in [-1,1]:
      p=a.lerp(b,j/29)+cross*.00115*f;h,_,_,_=tree.ray_cast(Vector((p.x,1 if back else -1,p.z)),Vector((0,-1 if back else 1,0)),2)
      row.append(None if h is None else torso(h)+Vector((0,.002 if back else -.002,0)))
     if j and prev[0] is not None and prev[1] is not None and row[0] is not None and row[1] is not None:
      k=len(pts);pts+=prev+row;faces.append((k,k+1,k+3,k+2))
     prev=row
   if faces:objects.append(make('Sailor_collar_stripe',pts,faces,'collar',2))
# Shared socks are thin shells fitted from the current character legs, not a second shoe design.
for s in [-1,1]:
 pts=[];faces=[]
 for row,z in enumerate([.18,.28,.42,.60,.80,.94,.96]):
  for i in range(32):
   a=i*math.tau/32;pts.append((s*.235+(.158 if z>.4 else .14)*math.cos(a),.012+(.158 if z>.4 else .14)*math.sin(a),z))
 for j in range(6):
  for i in range(32):faces.append((j*32+i,j*32+(i+1)%32,(j+1)*32+(i+1)%32,(j+1)*32+i))
 objects.append(make('Sailor_sock',pts,faces,'sock',0))
categories={}
for category in ['top','skirt','shoes','socks']:
 selected=[o for o in objects if (o.name.startswith('Sailor_skirt') if category=='skirt' else o.name.startswith('Sailor_shoe') if category=='shoes' else o.name.startswith('Sailor_sock') if category=='socks' else not any(o.name.startswith('Sailor_'+x) for x in ['skirt','shoe','sock']))]
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.select_set(True)
 objects=[o for o in objects if o not in selected]
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();ob=selected[0];ob.name='Sailor_'+category;ob.data.name=ob.name;categories[category]=ob
bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-girl-fitted.blend'));bpy.ops.export_scene.gltf(filepath=str(out/'sailor-girl.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
counts={}
for kind,o in categories.items():
 o.data.calc_loop_triangles();counts[kind]=len(o.data.loop_triangles);world=o.matrix_world.copy();o.parent=None;o.matrix_world=world;o.modifiers.clear();o.vertex_groups.clear();bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-girl-{kind}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
(r/'report.json').write_text(json.dumps(counts,indent=2));print('COUNTS',counts)
