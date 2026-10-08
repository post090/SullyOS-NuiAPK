import bpy
bpy.ops.wm.open_mainfile(filepath='D:/CHICK/SullyOS/output/sailor-girl/sailor-girl-fitted.blend')
r=bpy.data.objects['CurrentBody']
for b in r.data.bones:
 if any(x in b.name for x in ['upperArm','forearm','clavicle']):print(b.name,tuple(b.head_local),tuple(b.tail_local))
