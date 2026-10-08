import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Matrix,Vector
r=Path('D:/CHICK/SullyOS/output/sailor-girl');out=r.parent/'cardigan-controller'
bpy.ops.wm.open_mainfile(filepath=str(r/'sailor-girl-fitted.blend'))
rig=bpy.data.objects['CurrentBody'];body=bpy.data.objects['Mesh_0'];skirt=bpy.data.objects['Sailor_skirt']
for o in list(bpy.data.objects):
 if o.type=='MESH' and o.name.startswith('Sailor_top'):bpy.data.objects.remove(o,do_unlink=True)
with bpy.data.libraries.load(str(r.parent/'sailor-school/user-painted-v1/sailor-user-painted.blend'),link=False) as (src,dst):dst.objects=['Sailor_top','Sailor_pants']
top,lining=dst.objects
for o in [top,lining]:
 bpy.context.collection.objects.link(o);world=o.matrix_world.copy();o.data.transform(world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 o.modifiers.clear();o.parent=rig;m=o.modifiers.new('Current body','ARMATURE');m.object=rig
top.name='Sailor_top';top.data.name='Sailor_top'
# Keep the exact newly painted torso/collar/bow. Remove long sleeves by connectivity.
bm=bmesh.new();bm.from_mesh(top.data);seen=set();remove=[]
for v in bm.verts:
 if v in seen:continue
 group=[];todo=[v];seen.add(v)
 while todo:
  a=todo.pop();group.append(a)
  for e in a.link_edges:
   b=e.other_vert(a)
   if b not in seen:seen.add(b);todo.append(b)
 if max(abs(v.co.x) for v in group)>1:remove+=group
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(top.data);bm.free()
# Keep the back bib outside the shoulder sleeve envelope in the T pose.
for v in top.data.vertices:
 p=v.co
 if p.y>.10 and p.z>2.85:
  blend=max(0,min(1,(p.z-2.85)/.16))
  p.y+=.12*blend
def mat(name,c):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85;return m
white=mat('Thin cotton lining',(.82,.83,.81));navy=mat('Navy sleeve edge',(.037,.048,.078));stripe=mat('White sleeve stripe',(.94,.95,.92));dark=mat('Skirt inner lining',(.022,.028,.044))
def weights(ob,kind):
 ob.vertex_groups.clear()
 for g in body.vertex_groups:ob.vertex_groups.new(name=g.name)
 for v in ob.data.vertices:
  x,y,z=v.co;side='L_' if x>0 else 'R_'
  if kind=='sleeve':
   t=max(0,min(1,(abs(x)-.23)/.15));ws={'chest':1-t,side+'upperArm':t}
  else:ws={'spine':1} if z<2.8 else {'chest':1}
  for n,w in ws.items():
   if w:ob.vertex_groups[n].add([v.index],w,'REPLACE')
 ob.parent=rig;ob.modifiers.clear();m=ob.modifiers.new('Current body','ARMATURE');m.object=rig
def make(name,vs,fs,kind,materials):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
 for m in materials:me.materials.append(m)
 for f in me.polygons:f.use_smooth=True
 weights(ob,kind);return ob
pieces=[top]
# Thin hidden facing surfaces close the source torso's open boundary loops.
bm=bmesh.new();bm.from_mesh(top.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
edges=[e for e in bm.edges if e.is_boundary];result=bmesh.ops.holes_fill(bm,edges=edges,sides=0)
faces=result.get('faces',[]);vs=[];fs=[]
for f in faces:
 ids=[]
 for v in f.verts:ids.append(len(vs));vs.append(tuple(v.co))
 fs.append(ids)
bm.free()
if fs:pieces.append(make('Sailor_inner_facing',vs,fs,'torso',[white]))
# Sleeves are coaxial with the current arm in its rest pose, with a thin return at the end.
for side in [-1,1]:
 vs=[];fs=[];rings=[(.23,.235),(.34,.245),(.52,.23),(.68,.207),(.70,.201),(.72,.199),(.74,.197),(.77,.194),(.79,.192),(.81,.19),(.81,.185),(.79,.16)]
 for x,radius in rings:
  for i in range(40):
   a=i*math.tau/40;vs.append((side*x,.0106+radius*math.cos(a),3.125+radius*math.sin(a)))
 for j in range(len(rings)-1):
  for i in range(40):fs.append((j*40+i,j*40+(i+1)%40,(j+1)*40+(i+1)%40,(j+1)*40+i))
 ob=make('Sailor_short_sleeve',vs,fs,'sleeve',[white,navy,stripe]);pieces.append(ob)
 for f in ob.data.polygons:
  j=f.index//40;f.material_index=2 if j in [4,7] else 1 if j>=3 else 0
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
# Under-skirt shorts block the open view, with separate leg openings and original leg weights.
lining.name='Sailor_skirt_lining';lining.data.materials.clear();lining.data.materials.append(dark)
for f in lining.data.polygons:f.material_index=0
for v in lining.data.vertices:
 v.co.x*=.80;v.co.y=-.025+(v.co.y+.025)*.70;v.co.z=2.43+(v.co.z-2.49)*.72
# Add a thin waistband cap to close the view upward between shirt and skirt.
bm=bmesh.new();bm.from_mesh(lining.data);boundary=[e for e in bm.edges if e.is_boundary and all(v.co.z>2.35 for v in e.verts)];bmesh.ops.holes_fill(bm,edges=boundary,sides=0);bm.to_mesh(lining.data);bm.free()
def join(obs,name):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in obs:ob.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=obs[0];ob.name=name;ob.data.name=name;return ob
top=join(pieces,'Sailor_top');skirt=join([skirt,lining],'Sailor_skirt')
for o in bpy.context.scene.objects:o.hide_set(False)
bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-girl-refined.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'sailor-girl.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
counts={}
for kind,ob in [('top',top),('skirt',skirt)]:
 ob.data.calc_loop_triangles();counts[kind]=len(ob.data.loop_triangles);world=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=world;ob.modifiers.clear();ob.vertex_groups.clear();bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-girl-{kind}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
(r/'refined-report.json').write_text(json.dumps(counts,indent=2));print('COUNTS',counts)
