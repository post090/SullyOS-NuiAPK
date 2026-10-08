import bpy
bpy.ops.wm.open_mainfile(filepath='D:/CHICK/SullyOS/output/sailor-school/sailor-school-fitted.blend')
for name in ['Sailor_sleeve_L','Mesh_0','Sailor_pants','Sailor_top']:
 o=bpy.data.objects[name];print(name,'bbox',[(min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)) for i in range(3)])
 for x in [.4,.6,.8,1.,1.2,1.4]:
  vs=[v.co for v in o.data.vertices if abs(v.co.x-x)<.08 and v.co.z>2.8 and v.co.z<3.5]
  if vs:print('x',x,'yz',[(round(min(v[i] for v in vs),3),round(max(v[i] for v in vs),3)) for i in [1,2]])
