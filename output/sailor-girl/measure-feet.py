import bpy
bpy.ops.wm.open_mainfile(filepath='D:/CHICK/SullyOS/output/sailor-girl/sailor-girl-refined.blend')
for o in [bpy.data.objects['Mesh_0'],bpy.data.objects['Sailor_shoes']]:
 print(o.name,'matrix',o.matrix_world)
 for lo,hi in [(0,.12),(.12,.28),(.28,.5),(.5,.96)]:
  vs=[v.co for v in o.data.vertices if lo<=v.co.z<hi and v.co.x>0]
  if vs:print(lo,hi,[(round(min(p[i] for p in vs),4),round(max(p[i] for p in vs),4)) for i in range(3)])
for b in bpy.data.objects['CurrentBody'].data.bones:
 if any(x in b.name for x in ['foot','shin','toe']):print(b.name,tuple(b.head_local),tuple(b.tail_local))
