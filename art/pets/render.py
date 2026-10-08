import bpy,sys,os,math
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
source=args[0] if args else 'art/pets/sources'
dest=args[1] if len(args)>1 else 'output/pets/source-views'
os.makedirs(dest,exist_ok=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=500;scene.render.resolution_y=500;scene.render.resolution_percentage=100
scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl'
scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD';scene.world.color=(.76,.78,.80)
scene.view_settings.view_transform='Standard'
for filename in sorted(os.listdir(source)):
 if not filename.endswith('.glb'):continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=os.path.abspath(os.path.join(source,filename)))
 meshes=[o for o in scene.objects if o.type=='MESH']
 points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
 lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
 center=(lo+hi)/2;size=max(hi-lo)
 for label,delta in [('front',(0,-3,.6)),('side',(3,-.8,.5)),('back',(.9,3,.6)),('bottom',(0,0,-3))]:
  bpy.ops.object.camera_add(location=center+Vector(delta)*size)
  cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size*1.2;scene.camera=cam
  scene.render.filepath=os.path.abspath(f'{dest}/{filename[:-4]}-{label}.png');bpy.ops.render.render(write_still=True)
  bpy.data.objects.remove(cam,do_unlink=True)
