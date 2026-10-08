import bpy,bmesh,json
from pathlib import Path
r=Path('D:/CHICK/SullyOS/output/sailor-girl');out=r.parent/'cardigan-controller'
bpy.ops.wm.open_mainfile(filepath=str(r/'sailor-girl-refined.blend'))
body=bpy.data.objects['Mesh_0'];rig=bpy.data.objects['CurrentBody'];shoes=bpy.data.objects['Sailor_shoes']
old=bpy.data.objects['Sailor_socks'];sockmat=old.data.materials[0];bpy.data.objects.remove(old,do_unlink=True)
# Copy the actual low-poly body surface and its deform weights, including ankle and foot.
socks=body.copy();socks.data=body.data.copy();socks.name='Sailor_socks';socks.data.name='Sailor_socks';bpy.context.collection.objects.link(socks)
socks.data.materials.clear();socks.data.materials.append(sockmat)
bm=bmesh.new();bm.from_mesh(socks.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.96),plane_no=(0,0,1),dist=.000001,clear_outer=True)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.normal_update()
for v in bm.verts:
 normal=v.normal.copy();on_rim=abs(v.co.z-.96)<.00001;v.co+=normal*.008
 if on_rim:v.co.z=.96
for f in bm.faces:f.material_index=0;f.smooth=True
bm.to_mesh(socks.data);bm.free();socks.data.update()
# Shoes previously ended short of the toes and had a floating heel. Fit their full extent.
for v in shoes.data.vertices:
 p=v.co;sign=1 if p.x>0 else -1
 p.x=sign*(.215+(abs(p.x)-.237)*.94)
 p.y=p.y*(1.48 if p.y<0 else .88)
 if p.z>=.09:
  lift=max(0,min(1,(-p.y-.03)/.14));p.z+=.15*lift
  p.x=sign*(.215+(abs(p.x)-.215)*1.07)
 if p.z<.09:p.z=.004+(p.z-.015)*.70
 if p.z<.20:
  p.x=sign*max(.004,.215+(abs(p.x)-.215)*1.15)
  if p.y<0:p.y*=1.07
bm=bmesh.new();bm.from_mesh(shoes.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(shoes.data);bm.free()
# Keep the loafer as one rigid foot accessory; sock weights remain identical to the body.
shoes.vertex_groups.clear()
for side in ['L','R']:shoes.vertex_groups.new(name=side+'_foot')
for v in shoes.data.vertices:shoes.vertex_groups['L_foot' if v.co.x>0 else 'R_foot'].add([v.index],1,'REPLACE')
bpy.ops.object.select_all(action='SELECT');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-girl-surface-socks.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'sailor-girl.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
report={}
for kind,ob in [('socks',socks),('shoes',shoes)]:
 ob.data.calc_loop_triangles();report[kind]=len(ob.data.loop_triangles);world=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=world;ob.modifiers.clear();ob.vertex_groups.clear();bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-girl-{kind}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
(r/'shoes-socks-report.json').write_text(json.dumps(report,indent=2));print(report)
