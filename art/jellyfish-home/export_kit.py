"""Split the editable Blender room into reusable furniture assemblies."""
import bpy, os, json, math, shutil
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'output/jellyfish-home')
PUBLIC=os.path.join(ROOT,'public/room3d');os.makedirs(PUBLIC,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'jellyfish-home.blend'))
scene=bpy.context.scene;scene.frame_set(1)
for o in scene.objects:
    if o.animation_data:o.animation_data_clear()
INFO={
 'shell':('奶油小房间','shell'), 'loft':('鲸鱼阁楼床','floor'),
 'desk':('水母工作桌套组','floor'),'worktable':('空白小书桌','floor'),'chair':('小木椅','floor'),'bookcase':('三格书柜','floor'),
 'aquarium':('水母观景窗','back'),'porthole':('圆形水母窗','left'),
 'sofa':('软软双人沙发','floor'),'table':('阅读茶几','floor'),'rug':('云朵地毯','rug'),'pouf':('花瓣坐墩','floor'),
 'tank':('水母缸底柜','floor'),'nightstand':('玻璃夜灯柜','floor'),
 'pendant':('水母吊灯','ceiling'),'bedside':('床边灯架','back'),
 'high_shelf':('书与垂叶层板','back'),'corner_plant':('床边植物层板','back'),
 'wall_plant':('绿植壁架','back'),'plant':('落地绿植','floor'),
 'small_plant':('小盆栽','tabletop'),'trailing_plant':('垂叶小盆栽','tabletop'),
 'open_book':('打开的海洋书','tabletop'),'tea_mug':('小茶杯','tabletop'),'jelly_lamp':('迷你水母夜灯','tabletop'),
 'left_gallery':('海洋小画组','left'),'back_gallery':('海洋照片墙','back'),
 'left_shelf':('小书层板','left')}
def classify(o):
    top=o
    while top.parent:top=top.parent
    name=top.name
    c=o.users_collection[0].name[:2] if o.users_collection else ''
    if c=='01':return 'shell'
    if c=='02':return 'aquarium'
    if c=='03':return 'loft'
    if c=='04':
        if name.startswith('Chair'):return 'chair'
        if 'cubby' in name or 'Cubby' in name:return 'bookcase'
        return 'desk'
    if c=='05':return 'porthole'
    if c=='06':
        if name.startswith(('Open book','Book spine')):return 'open_book'
        if name.startswith('Coffee table'):return 'tea_mug'
        if name.startswith('Table miniature'):return 'jelly_lamp'
        if name.startswith('Lavender cloud'):return 'rug'
        if name.startswith('Pouf'):return 'pouf'
        if name.startswith(('Round low','Tea table','Open book','Book spine','Coffee table','Table miniature')):return 'table'
        return 'sofa'
    if c=='07':
        if name.startswith(('Small','Cabinet')):return 'tank'
        if name.startswith('Pendant'):return 'pendant'
        if name.startswith('Bedside'):return 'bedside'
        return 'nightstand'
    if c=='08':
        if name.startswith(('Back display','Display book','Shelf trailing')):return 'high_shelf'
        if name.startswith(('Bed corner','Corner plant')):return 'corner_plant'
        if name.startswith('Stair plant'):return 'small_plant'
        if name.startswith(('Sofa side','Plant wall')):return 'wall_plant'
        if name.startswith('Floor welcoming'):return 'plant'
        if name.startswith('Desk tiny'):return 'trailing_plant'
        if name.startswith(('Left tiny','Left shelf')):return 'left_shelf'
        if name.startswith('Left wall'):return 'left_gallery'
        return 'back_gallery'
    return None
sets={k:[] for k in INFO}
for o in list(scene.objects):
    if o.name.startswith(('Right low parapet','Right parapet cap','Rounded open-front corner')):
        bpy.data.objects.remove(o,do_unlink=True)
        continue
    if o.type in {'MESH','CURVE','EMPTY'}:
        k=classify(o)
        if k:sets[k].append(o)
# An undecorated desk exposes a genuine free rectangular surface for the editor.
for source in list(scene.objects):
    if source.name.startswith(('Rounded desk top','Desk chunky leg','Desk drawer')):
        copy=source.copy();copy.data=source.data.copy();copy.parent=None;copy.matrix_world=source.matrix_world.copy();scene.collection.objects.link(copy);sets['worktable'].append(copy)
catalog_path=os.path.join(PUBLIC,'catalog.json')
external_assets=[]
if os.path.exists(catalog_path):
    with open(catalog_path,encoding='utf8') as f:external_assets=[a for a in json.load(f) if a.get('url')]
manifest=[]
for k,objects in sets.items():
    if not objects:continue
    points=[]
    for o in objects:
        if o.type!='EMPTY':points.extend(o.matrix_world@Vector(v) for v in o.bound_box)
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    if k=='shell':center=Vector((0,0,0))
    root=bpy.data.objects.new('asset_'+k,None);scene.collection.objects.link(root);root.location=center;root['assetId']=k;bpy.context.view_layer.update()
    if k=='loft' and any(o.name.startswith('Loft side guard ') for o in objects):root['loftSideGuards']=1
    for o in objects:
        if o.parent is None or o.parent not in objects:
            matrix=o.matrix_world.copy();o.parent=root;o.matrix_world=matrix
    dims=[round(hi.x-lo.x,3),round(hi.z-lo.z,3),round(hi.y-lo.y,3)]
    anchor=[round(center.x,3),round(center.z,3),round(-center.y,3)]
    entry={'id':k,'name':INFO[k][0],'surface':INFO[k][1],'size':dims,'default':anchor,'boxes':[]}
    # The loft is hollow: use the platform, stairs and individual posts as colliders.
    if k=='loft':
        chosen=[o for o in objects if o.name.startswith(('Loft platform','Loft rounded timber post','Wide low stair'))]
        for o in chosen:
            pp=[o.matrix_world@Vector(v)-center for v in o.bound_box]
            a=[min(v[i] for v in pp) for i in range(3)];b=[max(v[i] for v in pp) for i in range(3)]
            entry['boxes'].append([a[0],a[2],-b[1],b[0],b[2],-a[1]])
    elif entry['surface'] in {'floor','tabletop'}:entry['boxes']=[[-dims[0]/2,0,-dims[2]/2,dims[0]/2,dims[1],dims[2]/2]]
    if k=='table':entry['support']={'shape':'circle','radius':.65,'height':round(.77-center.z,4)}
    if k=='worktable':entry['support']={'shape':'rect','width':1.75,'depth':.56,'height':round(1.115-center.z,4)}
    manifest.append(entry)
    # Convert, then batch by material inside an asset; moving water remains separate.
    for o in objects:
        if o.type=='CURVE':
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    groups={}
    for o in list(root.children_recursive):
        if o.type!='MESH':continue
        dynamic=o.parent
        while dynamic and dynamic!=root and not dynamic.get('animated'):dynamic=dynamic.parent
        if dynamic and dynamic!=root:continue
        matrix=o.matrix_world.copy();o.parent=root;o.matrix_world=matrix
        # Keep wall components separate, so an adjoining room can open a partition.
        part=''
        if k=='shell':
            if 'Back' in o.name or 'back wall' in o.name:part='back'
            elif 'Left' in o.name or 'left wall' in o.name:part='left'
            elif 'Right' in o.name:part='right'
            else:part='floor'
        groups.setdefault((o.data.materials[0].name,part),[]).append(o)
    for (mat,part),obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];obs[0].data=obs[0].data.copy()
        if len(obs)>1:bpy.ops.object.join()
        obs[0].name=k+'_'+mat+'_'+part
        if part:obs[0]['wallPart']=part
    for moving in [o for o in root.children_recursive if o.type=='EMPTY' and o.get('animated')]:
        buckets={}
        for o in moving.children:
            if o.type=='MESH':buckets.setdefault((o.data.materials[0].name,bool(o.get('tentacle'))),[]).append(o)
        for (mat,tentacle),obs in buckets.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs:o.select_set(True)
            bpy.context.view_layer.objects.active=obs[0];obs[0].data=obs[0].data.copy()
            if len(obs)>1:bpy.ops.object.join()
    # Asset roots are exported at zero; default placement is kept in the manifest.
    root.location=(0,0,0)
    root['assetId']=k
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.name.startswith('asset_'):
        o.select_set(True)
        for child in o.children_recursive:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(PUBLIC,'kit.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False)
manifest.extend(external_assets)
for a in external_assets:shutil.copy2(os.path.join(PUBLIC,a['url']),os.path.join(OUT,a['url']))
with open(os.path.join(PUBLIC,'catalog.json'),'w',encoding='utf8') as f:json.dump(manifest,f,ensure_ascii=False,indent=2)
for file in ['kit.glb','catalog.json']:shutil.copy2(os.path.join(PUBLIC,file),os.path.join(OUT,file))
print('MODULAR_ASSETS',len(manifest),flush=True)
