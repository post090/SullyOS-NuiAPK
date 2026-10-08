import bpy,json
from pathlib import Path
r=Path('D:/CHICK/SullyOS/output/sailor-school/user-painted-v1');out=r.parent.parent/'cardigan-controller'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(r/'sailor-paint.glb'))
im=bpy.data.images.load(str(r/'user-texture.png'));im.name='User painted sailor - original UV v1';im.colorspace_settings.name='sRGB';im.pack()
parts=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Sailor_')]
for o in parts:
 for mat in o.data.materials:
  for n in mat.node_tree.nodes:
   if n.type=='TEX_IMAGE':n.image=im
bpy.ops.wm.save_as_mainfile(filepath=str(r/'sailor-user-painted.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'sailor-school-user.glb'),export_format='GLB',export_skins=True,export_animations=False)
for o in parts:
 world=o.matrix_world.copy();o.parent=None;o.matrix_world=world;o.modifiers.clear();o.vertex_groups.clear()
for kind in ['top','pants','outfit']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:
  if kind=='outfit' or o.name.startswith('Sailor_'+kind):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(r/f'sailor-painted-{kind}.glb'),export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
print('USER TEXTURE',list(im.size),'PARTS',[o.name for o in parts])
