"""Set a useful initial camera view in the delivery .blend; no geometry changes."""
import bpy
scene=bpy.context.scene
scene.cycles.preview_samples=16
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_perspective='CAMERA'
            space.region_3d.view_camera_zoom=0
            space.shading.type='MATERIAL'
            space.shading.use_scene_world=True
            space.shading.use_scene_lights=True
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
