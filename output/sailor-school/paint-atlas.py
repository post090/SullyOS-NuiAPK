import bpy,bmesh,json
from pathlib import Path
r=Path('D:/CHICK/SullyOS/output/sailor-school');out=r.parent/'cardigan-controller'
bpy.ops.wm.open_mainfile(filepath=str(r/'sailor-school-fitted.blend'))
parts=[bpy.data.objects[n] for n in ['Sailor_top','Sailor_pants']]
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(o.data);bm.free()
 o.select_set(True);o.data.uv_layers.new(name='Paint atlas')
 o.data.uv_layers.active_index=len(o.data.uv_layers)-1
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.016);bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('Sailor editable atlas',width=2048,height=2048,alpha=False);image.generated_color=(.925,.934,.918,1)
for o in parts:
 for mat in o.data.materials:
  # Keep source projection nodes on their original UV layer during baking.
  for n in list(mat.node_tree.nodes):
   if n.type=='TEX_IMAGE' and n.image:
    uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='Hand painted projection';mat.node_tree.links.new(uv.outputs['UV'],n.inputs['Vector'])
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=10
bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(out/'sailor-paint-base.png');image.file_format='PNG';image.save();image.pack()
mat=bpy.data.materials.new('User painted sailor');mat.use_nodes=True;node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8
regions=[]
for o in parts:
 uv=o.data.uv_layers.active
 regions.append({'name':o.name,'faces':[[list(uv.data[i].uv) for i in f.loop_indices] for f in o.data.polygons]})
 coords=[v.uv.copy() for v in uv.data]
 for old in list(o.data.uv_layers):o.data.uv_layers.remove(old)
 uv=o.data.uv_layers.new(name='Paint atlas')
 for p,co in zip(uv.data,coords):p.uv=co
 o.data.materials.clear();o.data.materials.append(mat)
 for f in o.data.polygons:f.material_index=0
(out/'sailor-paint-uv.json').write_text(json.dumps(regions))
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(out/'sailor-paint.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False)
