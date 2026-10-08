import bpy,bmesh,json
from pathlib import Path
r=Path('D:/CHICK/SullyOS/output/sailor-school');bpy.ops.wm.open_mainfile(filepath=str(r/'source-1.blend'));ob=next(o for o in bpy.data.objects if o.type=='MESH');bpy.context.view_layer.objects.active=ob;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.verts.ensure_lookup_table();seen=set();parts=[]
for v in bm.verts:
 if v in seen:continue
 todo=[v];seen.add(v);vs=[]
 while todo:
  a=todo.pop();vs.append(a)
  for e in a.link_edges:
   b=e.other_vert(a)
   if b not in seen:seen.add(b);todo.append(b)
 if len(vs)>3:parts.append({'n':len(vs),'bounds':[(min(v.co[i] for v in vs),max(v.co[i] for v in vs)) for i in range(3)]})
print(json.dumps(sorted(parts,key=lambda a:-a['n']),indent=2));(r/'components.json').write_text(json.dumps(parts,indent=2))
print('MATERIAL',[(n.name,n.type, n.image.name if n.type=='TEX_IMAGE' else '') for n in ob.data.materials[0].node_tree.nodes]);print('IMAGES',[(im.name,tuple(im.size)) for im in bpy.data.images])
