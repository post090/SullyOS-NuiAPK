import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path('D:/CHICK/SullyOS/output/sailor-school')
files=['sailor school uniform 3d model (1).glb']
for number,name in enumerate(files,1):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath='C:/Users/tiaotiao/Downloads/'+name)
 report=[];points=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   p=[o.matrix_world@v.co for v in o.data.vertices];points+=p;o.data.calc_loop_triangles()
   report.append(dict(name=o.name,vertices=len(p),faces=len(o.data.loop_triangles),bounds=[[min(v[i] for v in p),max(v[i] for v in p)] for i in range(3)],materials=[m.name for m in o.data.materials]))
 print('REPORT',number,json.dumps(report));(root/f'source-{number}.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(root/f'source-{number}.blend'))
 lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);center=(lo+hi)/2;size=max(hi-lo)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.object.camera_add(location=center+Vector((0,-size*3,0)));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size*1.2;scene.camera=cam
 bpy.ops.object.light_add(type='AREA',location=center+Vector((-size,-size,size)));lamp=bpy.context.object;lamp.data.energy=400*size*size;lamp.data.shape='DISK';lamp.data.size=size*2;lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler()
 for side,offset in [('front',(0,-3,0)),('back',(0,3,0))]:
  cam.location=center+Vector(offset)*size;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(root/f'source-{number}-{side}.png');bpy.ops.render.render(write_still=True)

