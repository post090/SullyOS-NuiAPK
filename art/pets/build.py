"""Geometry-only pet repairs. Run Blender 4.2 -b --python art/pets/build.py.
Coordinates in selectors are source glTF (X right, Y up, Z front).
No image sampling, UVs, baked maps or vertex colors are used.
"""
import bpy,bmesh,math,os,json,sys
from mathutils import Vector

ROOT=os.path.abspath('.')
OUT=os.path.join(ROOT,'public/room3d/pets');os.makedirs(OUT,exist_ok=True)
SPECS=[
 ('bird',.72,{'body':'#f3d565','wings':'#a6b59a','crest':'#f7dc72','tail':'#809581','beak':'#df9860','feet':'#d6a27f','eyes':'#292c32'}),
 ('snake',.72,{'body':'#d99056','belly':'#f5deb1','eyes':'#322b29','tongue':'#be5868'}),
 ('slime',.76,{'body':'#8bc8bc','cheeks':'#dfb6ac','eyes':'#243d42','mouth':'#416a69'}),
 ('cat',.82,{'body':'#cc9863','markings':'#f6e6cc','ears':'#d79797','eyes':'#34322f','nose':'#a15e69','whiskers':'#fff3df'}),
 ('dog',.84,{'body':'#dab17b','markings':'#f5e7d1','ears':'#8e6244','tail':'#c49159','eyes':'#302c2c','nose':'#46342f'}),
 ('turtle',.72,{'skin':'#8aa974','shell':'#678267','rim':'#c7bb7c','belly':'#dfcf94','eyes':'#283d35','mouth':'#546d4a'}),
 ('shark',.92,{'body':'#6ba7bf','belly':'#f4eddb','fins':'#5689a6','eyes':'#243d49','mouth':'#405b69'}),
]
def srgb(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def material(name,color):
 m=bpy.data.materials.new('pet-'+name);m.diffuse_color=tuple(srgb(int(color[i:i+2],16)/255) for i in (1,3,5))+(1,);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.82
 return m
def xyz(v):return v.x,v.z,-v.y
def loc(p):return (p[0],-p[2],p[1])
def activate(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
def apply(o,m):activate(o);bpy.ops.object.modifier_apply(modifier=m.name)
def remesh(o,voxel):
 m=o.modifiers.new('Seal repair and remove intersecting interior faces','REMESH');m.mode='VOXEL';m.voxel_size=voxel;apply(o,m)
 m=o.modifiers.new('Smooth repaired joins','SMOOTH');m.factor=.65;m.iterations=3;apply(o,m)
def sphere(name,p,r,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24 if name=='Head' else 12,ring_count=12 if name=='Head' else 8,location=loc(p));o=bpy.context.object;o.name=name;o.scale=(r[0],r[2],r[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=True
 return o
def curve(name,points,r,mat):
 data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=1;data.resolution_u=2
 spline=data.splines.new('POLY');spline.points.add(len(points)-1)
 for v,p in zip(spline.points,points):v.co=(*loc(p),1)
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat);activate(o);bpy.ops.object.convert(target='MESH');return bpy.context.object
def smoothstep(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def local_smooth(o,name,weight,iterations):
 group=o.vertex_groups.new(name=name)
 for v in o.data.vertices:
  w=weight(*xyz(v.co))
  if w>0:group.add([v.index],w,'REPLACE')
 m=o.modifiers.new(name,'SMOOTH');m.vertex_group=group.name;m.factor=1;m.iterations=iterations;apply(o,m)
def remove_faces(o,predicate):
 bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if predicate(*xyz(f.calc_center_median()))],context='FACES')
 edges=[e for e in bm.edges if e.is_boundary]
 bmesh.ops.holes_fill(bm,edges=edges,sides=0)
 bm.to_mesh(o.data);bm.free();o.data.validate();o.data.update()
def split_planes(o,planes):
 bm=bmesh.new();bm.from_mesh(o.data)
 for p,n in planes:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=loc(p),plane_no=loc(n),dist=.00001)
 bm.to_mesh(o.data);bm.free();o.data.update()
def surface(o,x,y,offset=.014):
 hit,p,normal,idx=o.ray_cast(Vector((x,-3,y)),Vector((0,1,0)))
 return (x,y,-p.y+offset) if hit else (x,y,.85)
def patch(o,name,c,r,mat):
 # A solid-color geometry patch follows the repaired surface. Its perimeter is
 # explicit geometry, so simplification cannot produce jagged color pixels.
 verts=[loc(surface(o,*c))];faces=[];steps=24;rings=4
 for k in range(1,rings+1):
  for j in range(steps):
   a=math.tau*j/steps;verts.append(loc(surface(o,c[0]+r[0]*math.cos(a)*k/rings,c[1]+r[1]*math.sin(a)*k/rings)))
 for j in range(steps):faces.append((0,1+j,1+(j+1)%steps))
 for k in range(rings-1):
  for j in range(steps):
   a=1+k*steps+j;b=1+k*steps+(j+1)%steps;faces.extend([(a,b,b+steps),(a,b+steps,a+steps)])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();p=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(p);p.data.materials.append(mat)
 for f in p.data.polygons:f.use_smooth=True
 # Winding faces forward (glTF +Z = Blender -Y).
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 return p
def erase_bump(o,c,rx,ry):
 x0,y0=c;l=surface(o,x0-rx,y0,0)[2];r=surface(o,x0+rx,y0,0)[2];b=surface(o,x0,y0-ry,0)[2];t=surface(o,x0,y0+ry,0)[2]
 for v in o.data.vertices:
  x,y,z=xyz(v.co);q=((x-x0)/rx)**2+((y-y0)/ry)**2
  if z>.6 and q<1:
   target=(l+r+b+t)/4+.007+(x-x0)*(r-l)/(2*rx)+(y-y0)*(t-b)/(2*ry)
   blend=1-smoothstep(.3,1,q);v.co.y=-(z+(target-z)*blend)
 o.data.update()
def remove_rear_feet(o,n):
 # Original cats/dogs have a fifth and sixth paw under the tail. Project ONLY
 # this local underside onto the continuous rump, then seal via voxel union.
 for v in o.data.vertices:
  x,y,z=xyz(v.co)
  if n==4:
   mask=(1-smoothstep(-.36,-.21,z))*(1-smoothstep(.31,.43,abs(x)))*(1-smoothstep(-.42,-.32,y))
   q=1-(x/.64)**2-((z+.02)/.77)**2;floor=-.24-.355*math.sqrt(max(.02,q))
  else:
   mask=(1-smoothstep(-.31,-.16,z))*(1-smoothstep(.29,.40,abs(x)))*(1-smoothstep(-.20,-.08,y))
   q=1-(x/.61)**2-((z-.01)/.73)**2;floor=-.035-.345*math.sqrt(max(.02,q))
  if mask and y<floor:v.co.z=y+(floor-y)*mask
def assign(o,mats,role):
 names=list(mats);o.data.materials.clear()
 for m in mats.values():o.data.materials.append(m)
 for f in o.data.polygons:f.material_index=names.index(role(f));f.use_smooth=True
def facial(x,y,z,ex,ey,rx=.043,ry=.047):return z>.6 and ((abs(x)-ex)/rx)**2+((y-ey)/ry)**2<1
report=[]
requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for n,(species,width,colors) in enumerate(SPECS,1):
 if requested and species not in requested:continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for old in list(bpy.data.materials):bpy.data.materials.remove(old)
 bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,f'art/pets/sources/{n}.glb'))
 o=next(o for o in bpy.context.scene.objects if o.type=='MESH');activate(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 mats={k:material(k,v) for k,v in colors.items()};extras=[];source_triangles=len(o.data.polygons)
 if n==1:
  # Loose parts are authored Meshy components, identified by their centroid.
  activate(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
  for part in [p for p in bpy.context.scene.objects if p.type=='MESH']:
   vv=[xyz(v.co) for v in part.data.vertices];c=[sum(v[i] for v in vv)/len(vv) for i in range(3)]
   x,y,z=c
   role='body' if len(part.data.polygons)>1000 else 'feet' if y<-.32 else 'wings' if abs(x)>.28 and z>-.1 else 'crest' if y>.2 else 'tail' if z<-.2 else 'eyes' if abs(x)>.08 and z>.34 else 'beak'
   part.data.materials.clear();part.data.materials.append(mats[role])
   for f in part.data.polygons:f.material_index=0;f.use_smooth=True
  bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=o;bpy.ops.object.join()
 elif n==2:
  # Keep the original coil/neck; discard duplicate head shells and broken tail.
  activate(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
  pieces=[p for p in bpy.context.scene.objects if p.type=='MESH'];o=max(pieces,key=lambda p:len(p.data.polygons))
  for p in pieces:
   if p!=o:bpy.data.objects.remove(p,do_unlink=True)
  split_planes(o,[((0,-.28,0),(0,1,0))]);assign(o,mats,lambda f:'belly' if xyz(f.center)[1]<-.28 else 'body')
  head=sphere('Head',(-.011,.224,.237),(.284,.207,.260),mats['body']);extras.append(head)
  for sign in (-1,1):extras.append(sphere('Eye left' if sign<0 else 'Eye right',(sign*.128,.20,.472),(.026,.032,.025),mats['eyes']))
  # A closed tapered tail follows the original curl, with a rounded tip.
  points=[(.30,-.31,-.17),(.37,-.29,-.25),(.40,-.23,-.34),(.39,-.16,-.38),(.365,-.12,-.37)]
  verts=[];faces=[]
  for i,p in enumerate(points):
   tangent=Vector(points[min(i+1,4)])-Vector(points[max(0,i-1)]);tangent.normalize();u=tangent.cross(Vector((0,0,1))).normalized();v=tangent.cross(u).normalized();r=[.11,.095,.073,.043,.008][i]
   for j in range(12):verts.append(loc(Vector(p)+r*(u*math.cos(j*math.tau/12)+v*math.sin(j*math.tau/12))))
  for i in range(4):
   for j in range(12):a=i*12+j;b=i*12+(j+1)%12;faces.extend([(a,b,b+12),(a,b+12,a+12)])
  faces.extend([tuple(reversed(range(12))),tuple(range(48,60))]);mesh=bpy.data.meshes.new('Tail');mesh.from_pydata(verts,[],faces);mesh.update();tail=bpy.data.objects.new('Tail',mesh);bpy.context.collection.objects.link(tail);tail.data.materials.append(mats['body']);extras.append(tail)
  # The small face has no authored mouth. Give it a discreet forked tongue.
  extras.append(curve('Tongue',[(0,.115,.435),(0,.10,.50),(-.02,.096,.525)],.009,mats['tongue']))
  extras.append(curve('Tongue fork',[(0,.10,.50),(.02,.096,.525)],.009,mats['tongue']))
 elif n==3:
  local_smooth(o,'Erase fused facial bumps',lambda x,y,z:max(0,1-(x/.48)**4-((y+.075)/.19)**4) if z>.62 else 0,180)
  for sign in (-1,1):erase_bump(o,(sign*.285,-.06),.102,.105)
  erase_bump(o,(0,-.11),.12,.08)
  assign(o,mats,lambda f:'body')
 elif n in (4,5):
  remove_rear_feet(o,n);remesh(o,.009 if n==4 else .012)
  local_smooth(o,'Round repaired rump',lambda x,y,z:(1-smoothstep(-.25,-.05,z))*(1-smoothstep(-.30,-.15,y))*(1-smoothstep(.36,.52,abs(x))),100)
  if n==5:
   local_smooth(o,'Smooth noisy tail',lambda x,y,z:(1-smoothstep(-.55,-.40,z))*smoothstep(-.15,.04,y),30)
  if n==4:
   for sign in (-1,1):extras.append(sphere('Hind paw left' if sign<0 else 'Hind paw right',(sign*.535,-.525,-.14),(.135,.095,.15),mats['body']))
  ey=-.171 if n==4 else .027
  local_smooth(o,'Erase fused facial bumps',lambda x,y,z:max(0,1-(x/.32)**4-((y-ey+.025)/.16)**4) if z>.66 else 0,120)
  def role(f):
   x,y,z=xyz(f.center);ax=abs(x)
   if n==4:
    if ax>.61 and -.26<y<-.065 and z>.40:return 'whiskers'
   else:
    if ax>.36 and y>-.14 and z>.30:return 'ears'
    if z<-.55 and y>-.08:return 'tail'
   return 'body'
  assign(o,mats,role)
 elif n==6:
  # Replace the four-eyed fused head with one closed rounded head. Legs stay.
  remove_faces(o,lambda x,y,z:(z>.28 and y>-.17) or (z>.50 and y>-.27 and abs(x)<.39))
  def role(f):
   x,y,z=xyz(f.center)
   if y<-.31 and abs(x)<.28:return 'belly'
   if (x/.53)**2+((z+.12)/.62)**2<1.12 and z<.34 and y>-.135:return 'rim' if y<-.035 else 'shell'
   return 'skin'
  assign(o,mats,role)
  head=sphere('Head',(0,.15,.445),(.455,.42,.425),mats['skin']);extras.append(head)
  extras.append(sphere('Neck',(0,-.155,.30),(.30,.155,.25),mats['skin']))
  extras.append(sphere('Belly',(0,-.20,-.035),(.43,.19,.56),mats['belly']))
  for sign in (-1,1):
   x=sign*.29;y=.16;z=.445+.425*math.sqrt(1-(x/.455)**2-((y-.15)/.42)**2)
   extras.append(sphere('Eye left' if sign<0 else 'Eye right',(x,y,z+.006),(.033,.044,.026),mats['eyes']))
  points=[]
  for x in [-.066,-.033,0,.033,.066]:
   y=.04-.024*(1-(x/.066)**2);z=.445+.425*math.sqrt(1-(x/.455)**2-((y-.15)/.42)**2)+.008;points.append((x,y,z))
  extras.append(curve('Smile',points,.008,mats['mouth']))
 elif n==7:
  # Source is five disconnected pieces: body, two side fins, two eyes.
  activate(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
  pieces=[p for p in bpy.context.scene.objects if p.type=='MESH'];o=max(pieces,key=lambda p:len(p.data.polygons))
  for p in pieces:
   if p==o:continue
   vv=[xyz(v.co) for v in p.data.vertices];x=sum(v[0] for v in vv)/len(vv)
   role='fins' if abs(x)>.23 else 'eyes';p.name=('Eye left' if x<0 else 'Eye right') if role=='eyes' else ('Fin left' if x<0 else 'Fin right');p.data.materials.clear();p.data.materials.append(mats[role]);extras.append(p)
  local_smooth(o,'Round small fused mouth bump',lambda x,y,z:max(0,1-(x/.075)**2-((y+.237)/.065)**2) if z>.3 else 0,100)
  assign(o,mats,lambda f:'body')
 # Simplify the body BEFORE placing explicit solid-color facial geometry.
 extra_tris=sum(sum(len(f.vertices)-2 for f in e.data.polygons) for e in extras)
 budget=(2000 if n==5 else 3100 if n==6 else 2500 if n in (3,4) else 3300 if n==7 else 3400)-extra_tris
 current=sum(len(f.vertices)-2 for f in o.data.polygons)
 if current>budget:
  d=o.modifiers.new('Under 4000 triangle budget','DECIMATE');d.ratio=budget/current;d.use_collapse_triangulate=True;apply(o,d)
 # Plane cuts produce a crisp border on the snake belly and shell rim.
 if n==2:
  split_planes(o,[((0,-.28,0),(0,1,0))]);assign(o,mats,lambda f:'belly' if xyz(f.center)[1]<-.28 else 'body')
 if n==7:
  split_planes(o,[((0,-.155,0),(0,1,0)),((0,0,-.31),(0,0,1))]);assign(o,mats,lambda f:'belly' if xyz(f.center)[1]<-.155 and xyz(f.center)[2]>-.31 else 'body')
  points=[surface(o,x,-.18-.018*(1-(x/.045)**2),.004) for x in [-.045,-.0225,0,.0225,.045]];extras.append(curve('Smile',points,.0035,mats['mouth']))
 if n==6:
  split_planes(o,[((0,-.135,0),(0,1,0)),((0,-.035,0),(0,1,0)),((0,-.31,0),(0,1,0))]);assign(o,mats,role)
 if n==5:
  split_planes(o,[((.36,0,0),(1,0,0)),((-.36,0,0),(1,0,0)),((0,-.14,0),(0,1,0)),((0,0,.30),(0,0,1))]);assign(o,mats,role)
 if n in (3,4,5):
  ex,ey=(.285,-.06) if n==3 else (.169,-.171) if n==4 else (.151,.027)
  for sign in (-1,1):extras.append(sphere('Eye left' if sign<0 else 'Eye right',surface(o,sign*ex,ey,.008),(.050,.055,.025) if n==3 else (.033,.043,.024),mats['eyes']))
  if n==3:
   for sign in (-1,1):extras.append(patch(o,'Cheek', (sign*.46,-.135),(.073,.03),mats['cheeks']))
   points=[surface(o,x,-.115-.035*(1-(x/.075)**2),.009) for x in [-.075,-.05,-.025,0,.025,.05,.075]]
   extras.append(curve('Smile',points,.011,mats['mouth']))
  else:
   my=-.29 if n==4 else -.082
   extras.append(patch(o,'Muzzle',(0,my),(.215,.105),mats['markings']))
   extras.append(sphere('Nose',surface(o,0,my+.05,.02),(.035,.024,.026),mats['nose']))
   for sign in (-1,1):
    extras.append(curve('Smile',[surface(o,sign*x,my+.019-.025*math.sin(x/.08*math.pi),.018) for x in [0,.02,.04,.06,.08]],.007,mats['nose']))
    if n==4:extras.append(patch(o,'Inner ear',(sign*.376,.15),(.050,.075),mats['ears']))
 # All output objects keep semantic material names, no textures/UV/color data.
 meshes=[p for p in bpy.context.scene.objects if p.type=='MESH']
 points=[p.matrix_world@v.co for p in meshes for v in p.data.vertices]
 lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
 scale=width/(hi.x-lo.x);offset=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for p in meshes:
  activate(p);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  for v in p.data.vertices:v.co=(v.co-offset)*scale
  for uv in list(p.data.uv_layers):p.data.uv_layers.remove(uv)
  for ca in list(p.data.color_attributes):p.data.color_attributes.remove(ca)
  for f in p.data.polygons:f.use_smooth=True
  p.data.validate();p.data.update()
 o.name='pet-'+species
 bpy.ops.object.select_all(action='SELECT')
 path=os.path.join(OUT,species+'.glb')
 tris=sum(sum(len(f.vertices)-2 for f in p.data.polygons) for p in meshes)
 assert tris<4000,(species,tris)
 bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_yup=True,export_animations=False)
 size=(hi-lo)*scale
 report.append({'id':'pet_'+species,'source':n,'sourceTriangles':source_triangles,'triangles':tris,'bytes':os.path.getsize(path),'size':[size.x,size.z,size.y],'colors':colors})
 print('PET_RESULT',report[-1],flush=True)
if requested:
 with open('art/pets/manifest.json',encoding='utf8') as f:previous=json.load(f)
 by_id={a['id']:a for a in previous}
 for a in report:by_id[a['id']]=a
 report=list(by_id.values())
with open('art/pets/manifest.json','w',encoding='utf8') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
