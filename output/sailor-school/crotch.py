import bpy
bpy.ops.wm.open_mainfile(filepath='D:/CHICK/SullyOS/output/sailor-school/sailor-school-fitted.blend');o=bpy.data.objects['Sailor_pants']
print([(tuple(round(x,3) for x in v.co)) for v in o.data.vertices if abs(v.co.x)<.06])
