"""Rebuildable, modular toy-room source. Blender 4.2+, no external assets."""
import bpy, math, random, json, os, sys, struct, zlib
from mathutils import Vector
from math import sin, cos, pi
random.seed(27)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'output/jellyfish-home')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.collections):
    if block.name != 'Collection': bpy.data.collections.remove(block)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
GROUP = None
def group(name):
    global GROUP
    GROUP = bpy.data.collections.new(name); scene.collection.children.link(GROUP)
def link(o, name, mat=None):
    o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    GROUP.objects.link(o)
    if mat and not o.data.materials: o.data.materials.append(mat)
    return o
def rgb(h):
    c = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
def material(name, h, rough=.65, emit=0, alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); c=rgb(h)
    p.inputs['Base Color'].default_value=(*c,alpha)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Specular IOR Level'].default_value=.28
    if emit: p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=emit
    p.inputs['Alpha'].default_value=alpha
    if alpha<1: m.surface_render_method='DITHERED'
    m.diffuse_color=(*c,alpha)
    return m
M={k:material(k,h) for k,h in {
 'cream':'FFF2E3','white':'FFF8F2','lavender':'A99BE8','purple':'8E83D8',
 'pink':'F2B8D5','blush':'F7D5E3','blue':'91C9F4','peri':'8399E8',
 'wood':'D7B28A','woodLight':'EACBA8','woodDark':'B89375',
 'green':'789879','leafLight':'9BAE88','leafDark':'597E73',
 'ink':'514B75','rug':'C2B3DF','sand':'CBD4ED','coral':'EBA5C9'
}.items()}
M['water']=material('Water depth', '819FDB', .85, .32)
M['waterLight']=material('Water light','A3CAE9',.8,.28)
M['jelly']=material('Jelly bell • translucent','CBB0F4',.40,.35,.83)
M['jellyPink']=material('Jelly bell • rose','EDABD5',.40,.35,.83)
M['glow']=material('Jelly luminous edges','EFCFFF',.4,1.35)
M['peachGlow']=material('Warm peach lamplight','FFE3B4',.5,1.3)
M['lampShade']=material('Frosted peach lamp shade','F5BFD2',.58,.22)
M['glass']=material('Glass • tinted thin surface','B4D6F5',.18,0,.09)
M['screen']=material('Screen • periwinkle','9CADD9',.65,.18)
M['bg']=material('Backdrop','D8C8D7',.95)

# Aquarium artwork is a low-resolution gradient, not a reflected physical water volume.
def texture_png(name,rows):
    def chunk(k,data):return struct.pack('>I',len(data))+k+data+struct.pack('>I',zlib.crc32(k+data)&0xffffffff)
    file=os.path.join(OUT,name+'.png')
    data=b''.join(bytes([0])+bytes(row) for row in rows)
    with open(file,'wb') as f:f.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b''))
    image=bpy.data.images.load(file,check_existing=False);image.pack();return image
water_rows=[]
bottom=(163,208,239);top=(113,137,211)
for y in range(256):
    row=[]
    for x in range(256):
        t=y/255
        ray=max(0,cos(x/256*17+t*3))**18*7*(1-t)
        row.extend([int(min(255,top[i]*(1-t)+bottom[i]*t+ray)) for i in range(3)])
    water_rows.append(row)
water_img=texture_png('water-gradient',water_rows)
wn=M['water'].node_tree.nodes;wn.clear()
wi=wn.new('ShaderNodeTexImage');wi.image=water_img
we=wn.new('ShaderNodeEmission');we.inputs['Strength'].default_value=.85
wo=wn.new('ShaderNodeOutputMaterial')
M['water'].node_tree.links.new(wi.outputs['Color'],we.inputs['Color']);M['water'].node_tree.links.new(we.outputs[0],wo.inputs['Surface'])

# A small, packed color map is used instead of procedural shaders that cannot export.
palette=[(240,225,239),(207,185,226),(177,149,208)]
rows=[]
for y in range(256):
    row=[]
    for x in range(256):
        idx=((x//32)%2)+((y//32)%2)
        c=palette[idx];row.extend(c)
    rows.append(row)
img=texture_png('gingham',rows)
M['gingham']=material('Lavender gingham fabric','FFFFFF',.95)
n=M['gingham'].node_tree.nodes.new('ShaderNodeTexImage'); n.image=img; n.interpolation='Linear'
M['gingham'].node_tree.links.new(n.outputs['Color'],M['gingham'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

CACHE={}
def box(name, loc, size, mat, bevel=.06):
    key=('box',tuple(size),round(bevel,4),mat.name)
    if key in CACHE:
        o=bpy.data.objects.new(name,CACHE[key]); GROUP.objects.link(o); o.location=loc; return o
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft toy edges','BEVEL'); mod.width=min(bevel,min(size)*.47); mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=40
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if mat==M['gingham']:
        uv=o.data.uv_layers.active
        for poly in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
            for li in poly.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv=(v[axes[0]]*.55+.5,v[axes[1]]*.55+.5)
    if mat==M['water']:
        uv=o.data.uv_layers.active
        for li,loop in enumerate(o.data.loops):
            v=o.data.vertices[loop.vertex_index].co
            uv.data[li].uv=(v.x/size[0]+.5,v.z/size[2]+.5)
    link(o,name,mat); CACHE[key]=o.data; return o
def ellipsoid(name,loc,scale,mat,segments=20,rings=12):
    key=('sphere',segments,rings,mat.name)
    if key not in CACHE:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1)
        o=bpy.context.object; link(o,name,mat)
        for p in o.data.polygons:p.use_smooth=True
        CACHE[key]=o.data
    else: o=bpy.data.objects.new(name,CACHE[key]); GROUP.objects.link(o)
    o.location=loc; o.scale=scale; return o
def cylinder(name,loc,radius,depth,mat,vertices=24):
    key=('cyl',radius,depth,mat.name,vertices)
    if key not in CACHE:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
        o=bpy.context.object; link(o,name,mat)
        b=o.modifiers.new('Rounded rim','BEVEL'); b.width=min(.035,depth*.2,radius*.18); b.segments=2
        bpy.ops.object.modifier_apply(modifier=b.name)
        for p in o.data.polygons:p.use_smooth=True
        norm=o.modifiers.new('Normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=norm.name)
        CACHE[key]=o.data
    else:o=bpy.data.objects.new(name,CACHE[key]); GROUP.objects.link(o); o.location=loc
    return o
def path(name,points,r,mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=1; c.bevel_depth=r; c.bevel_resolution=1
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for a,b in zip(s.points,points): a.co=(*b,1)
    o=bpy.data.objects.new(name,c); GROUP.objects.link(o); c.materials.append(mat)
    return o
def rod(name,a,b,r,mat):
    a,b=Vector(a),Vector(b); o=cylinder(name,(a+b)*.5,r,(b-a).length,mat,12); o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o
def torus(name,loc,major,minor,mat,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=loc,major_radius=major,minor_radius=minor,rotation=rot)
    o=link(bpy.context.object,name,mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def star(name,loc,r,mat):
    verts=[]
    cushion='cushion' in name
    for y in ([-.095,.095] if cushion else [-.045,.045]):
        for i in range(10):
            a=pi/2+i*pi/5; rr=r if i%2==0 else r*.49; verts.append((rr*cos(a),y,rr*sin(a)))
    faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o);o.location=loc
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    b=o.modifiers.new('Soft star','BEVEL');b.width=.07 if cushion else .035;b.segments=4 if cushion else 3
    bpy.ops.object.modifier_apply(modifier=b.name);o.select_set(False)
    for p in mesh.polygons:p.use_smooth=True
    return o
def book(name,x,y,z,w=.1,h=.32,color='lavender'):
    box(name,(x,y,z+h/2),(w,.23,h),M[color],.014)
    box(name+' spine line',(x,y-.12,z+h*.2),(w*.68,.009,.012),M['cream'],.003)
def pot(name,x,y,z,s=.25,trail=False):
    cylinder(name+' planter',(x,y,z+s*.48),s*.55,s*.9,M['cream'] if random.random()<.5 else M['lavender'])
    torus(name+' rolled ceramic lip',(x,y,z+s*.91),s*.51,s*.075,M['cream'])
    torus(name+' foot ring',(x,y,z+s*.09),s*.43,s*.03,M['lavender'])
    cylinder(name+' soil',(x,y,z+s*.95),s*.45,.016,M['woodDark'])
    for i in range(7):
        a=i*2.4; end=(x+cos(a)*s*.76,y+sin(a)*s*.65,z+s*(1.3+random.random()*.9))
        rod(name+' stem',(x,y,z+s*.85),end,.011,M['green'])
        o=ellipsoid(name+' leaf',end,(s*.24,s*.48,s*.10),M['leafLight' if i%3==0 else 'green'],12,8)
        o.rotation_euler=(random.uniform(-.8,.8),random.uniform(-.7,.7),-a)
    if trail:
        for j in range(2):
            pts=[(x+j*.1+.055*sin(k),y-.1-.08*sin(k*.4),z-.09*k) for k in range(10)]
            path(name+' trailing stem',pts,.012,M['green'])
            for k,p in enumerate(pts[1:]):
                o=ellipsoid(name+' trailing leaf',(p[0]+(-1)**k*.07,p[1]-.02,p[2]),(.075,.035,.115),M['green'],12,8);o.rotation_euler.y=(-1)**k*.5
def mug(name,x,y,z,s=.1):
    cylinder(name,(x,y,z+s*.7),s,s*1.4,M['cream'])
    cylinder(name+' tea',(x,y,z+s*1.41),s*.77,.006,M['woodDark'])
    torus(name+' handle',(x+s,y,z+s*.8),s*.52,s*.18,M['cream'],(pi/2,0,0))
def pillow(name,loc,scale,mat,tilt=0):
    o=ellipsoid(name,loc,(1,1,1),mat,24,16)
    o.data=o.data.copy()
    for v in o.data.vertices:
        for axis in range(3):
            a=v.co[axis];v.co[axis]=(1 if a>=0 else -1)*abs(a)**.57*scale[axis]
    o.rotation_euler.y=tilt
    pts=[]
    for i in range(65):
        a=2*pi*i/64
        x=math.copysign(abs(cos(a))**.57,cos(a))*scale[0]*.94
        z=math.copysign(abs(sin(a))**.57,sin(a))*scale[2]*.94
        pts.append((x,0,z))
    seam=path(name+' sewn piping',pts,.008,M['blush'] if mat!=M['blush'] else M['pink']);seam.parent=o
    return o
def fabric(name,x,profile,width,mat):
    # A real draped surface: soft hem undulation, broad folds, and a rounded fall.
    cols=36;verts=[];uvs=[]
    for j,(y,z) in enumerate(profile):
        for i in range(cols+1):
            u=i/cols;xx=x+(u-.5)*width
            fold=.017*sin(u*12*pi+j*.24)+.008*sin(u*23*pi-j*.16)
            yy=y+.012*sin(u*8*pi)
            verts.append((xx,yy,z+fold));uvs.append((xx*.55+.5,j/(len(profile)-1)*.9))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(cols):
            a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name='Fabric UV')
    for p in mesh.polygons:
        p.use_smooth=True
        for li in p.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
    o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
    mod=o.modifiers.new('Soft fabric thickness','SOLIDIFY');mod.thickness=.025;bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
    return o
def jelly(name,x,y,z,s=.35,pink=False,animate=True):
    root=bpy.data.objects.new(name,None);GROUP.objects.link(root);root.location=(x,y,z)
    root['floatAmplitude']=s*.13;root['floatSpeed']=.55+random.random()*.3;root['phase']=random.random()*6.28
    mat=M['jellyPink' if pink else 'jelly']; parts=[]
    # Smooth open bell, 24 radial sectors and 8 curved rings, scalloped lower rim.
    verts=[(0,0,s*.65)];faces=[];N=24;R=8
    for j in range(1,R+1):
        t=j/R*pi*.51
        for i in range(N):
            a=2*pi*i/N; rr=s*sin(t)*(1+.035*cos(a*8)*(j/R)**4)
            verts.append((rr*cos(a),rr*sin(a),s*.65*cos(t)+.025*s*cos(a*8)*(j/R)**6))
    for i in range(N):faces.append((0,1+i,1+(i+1)%N))
    for j in range(R-1):
        for i in range(N):a=1+j*N+i;b=1+j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
    mesh=bpy.data.meshes.new('Reusable jelly bell');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
    bell=bpy.data.objects.new(name+' bell',mesh);GROUP.objects.link(bell);parts.append(bell)
    for p in mesh.polygons:p.use_smooth=True
    parts.append(torus(name+' luminous rim',(0,0,0),s*.98,s*.022,M['glow']))
    parts.append(ellipsoid(name+' inner heart',(0,0,s*.17),(s*.42,s*.42,s*.24),M['glow'],16,8))
    for i in range(8):
        a=i*pi/4
        pts=[]
        for k in range(10):
            t=.10+k/9*pi*.46
            pts.append((s*1.005*sin(t)*cos(a),s*1.005*sin(t)*sin(a),s*.657*cos(t)))
        parts.append(path(name+' bell meridian',pts,s*.014,M['glow']))
    for i in range(5):
        a=i*2*pi/5;length=s*(1.1+.25*sin(i*2))
        pts=[(cos(a)*s*.45+sin(k*.67+i)*s*.12,sin(a)*s*.38+sin(k*.4+i)*s*.05,-length*k/10) for k in range(11)]
        o=path(name+' tentacle '+str(i),pts,s*.043,M['glow']);o['tentacle']=True;parts.append(o)
    for o in parts:o.parent=root
    root['animated']=animate
    if animate:
        for f in [1,46,91,136,181]:
            root.location.z=z+sin((f-1)/180*2*pi+root['phase'])*root['floatAmplitude'];root.keyframe_insert(data_path='location',frame=f)
        for fc in root.animation_data.action.fcurves:
            fc.modifiers.new('CYCLES')
        root.location.z=z
    return root
def lamp(name,x,y,z,s=.18,kind='desk'):
    if kind=='desk':
        cylinder(name+' foot',(x,y,z+.035),s*.62,.07,M['woodLight']);rod(name+' stem',(x,y,z+.05),(x,y,z+s*1.6),s*.09,M['cream'])
        root=jelly(name,x,y,z+s*1.8,s,True,False)
    elif kind=='hanging':
        rod(name+' cord',(x,y,z),(x,y,z+.65),.017,M['wood']);root=jelly(name,x,y,z,s,True,False)
    else:
        cylinder(name+' plinth',(x,y,z+.04),s*.85,.08,M['wood'])
        root=jelly(name,x,y,z+s*1.7,s*.56,False,False)
        ellipsoid(name+' glass dome',(x,y,z+s*1.2),(s*.85,s*.85,s*1.2),M['glass'])
        torus(name+' glass foot bead',(x,y,z+.075),s*.80,.009,M['lavender'])
        path(name+' dome highlight',[(x+cos(a)*s*.86,y-s*.1,z+s*1.2+sin(a)*s*1.19) for a in [pi*.15+k*pi*.7/16 for k in range(17)]],.008,M['cream'])
    if kind!='jar':
        for child in root.children:
            if child.type=='MESH' and 'bell' in child.name:
                child.data.materials.clear();child.data.materials.append(M['lampShade'])
            elif child.type=='CURVE':
                child.data.materials.clear();child.data.materials.append(M['peachGlow'])
        for i in range(3):ellipsoid(name+' pearl fringe',(x+(i-1)*s*.32,y-s*.35,z+s*(.82 if kind=='desk' else -1)),(s*.075,s*.075,s*.10),M['peachGlow'],12,8)
    return
def frame(name,x,y,z,w,h,color='lavender',motif='jelly'):
    box(name+' frame',(x,y,z),(w,.075,h),M['woodLight'] if color=='cream' else M['cream'],.04)
    box(name+' picture',(x,y-.043,z),(w-.075,.015,h-.075),M[color],.012)
    if motif=='star':star(name+' star',(x,y-.07,z),min(w,h)*.27,M['blush'])
    elif motif=='wave':
        path(name+' ocean',[(x-w*.34+i*w*.068,y-.058,z+.045*sin(i*.9)) for i in range(11)],.016,M['cream'])
    else:
        ellipsoid(name+' jelly print',(x,y-.061,z+h*.09),(w*.20,.012,h*.19),M['blush'],16,8)
        for i in range(3):path(name+' print tendril',[(x+(i-1)*w*.12+.018*sin(k),y-.064,z-k*h*.047) for k in range(5)],.009,M['cream'])

group('01 • rounded room shell')
box('Thick lavender display plinth',(0,0,-.2),(6.45,5.58,.44),M['lavender'],.18)
box('Cream plinth inset',(0,0,.025),(6.14,5.27,.13),M['cream'],.1)
for iy in range(14):
    y=-2.43+iy*.371
    for ix in range(4):
        x=-2.24+ix*1.5
        box('Quiet painted floor plank',(x,y,.105),(1.482,.358,.08),M['woodLight'] if (ix+iy)%4 else M['cream'],.018)
box('Back cream wall',(0,2.65,2.36),(6.4,.24,4.75),M['cream'],.10)
box('Left cream wall',(-3.1,0,2.36),(.24,5.36,4.75),M['cream'],.10)
box('Back lavender cornice',(0,2.65,4.72),(6.43,.30,.19),M['lavender'],.07)
box('Left lavender cornice',(-3.1,0,4.72),(.30,5.38,.19),M['lavender'],.07)
box('Back skirting',(0,2.48,.31),(6.1,.11,.27),M['white'],.04)
box('Left skirting',(-2.94,0,.31),(.11,5.1,.27),M['white'],.04)
for y in [-2.1,-1.45,-.8,-.15,.5,1.15,1.8]:
    box('Subtle left wall board seam',(-2.974,y,2.49),(.006,.012,4.23),M['blush'],.003)
for x in [-2.6,-1.95,-1.3,-.65,0,.65,1.3,1.95,2.6]:
    box('Subtle back wall board seam',(x,2.524,2.49),(.012,.006,4.23),M['blush'],.003)
# Right wall remains only at the back; the low front pier does not hide the tank.
box('Right short return',(3.1,2.24,2.36),(.24,.84,4.75),M['cream'],.10)
box('Right cornice return',(3.1,2.24,4.72),(.30,.86,.19),M['lavender'],.07)
box('Soft back-left cornice joint',(-3.1,2.65,4.72),(.34,.34,.23),M['lavender'],.09)
box('Soft back-right cornice joint',(3.1,2.65,4.72),(.34,.34,.23),M['lavender'],.09)
box('Right low parapet',(3.1,-1.38,.54),(.24,1.64,.93),M['cream'],.09)
box('Right parapet cap',(3.1,-1.38,1.03),(.29,1.68,.12),M['lavender'],.05)
for x in [-2.91,2.94]: box('Rounded open-front corner',(x,-2.5,.52),(.25,.27,.82),M['lavender'],.10)

group('02 • luminous aquarium window')
for x in [0,2.76]:box('Aquarium thick outer jamb',(x,2.31,2.92),(.18,.43,2.91),M['lavender'],.075)
for z in [1.55,4.29]:box('Aquarium thick outer lintel',(1.38,2.31,z),(2.94,.43,.18),M['lavender'],.075)
for x in [.12,2.64]:box('Aquarium cream inner jamb',(x,2.12,2.92),(.085,.13,2.55),M['white'],.035)
for z in [1.69,4.15]:box('Aquarium cream inner lintel',(1.38,2.12,z),(2.60,.13,.085),M['white'],.035)
box('Aquarium periwinkle depth',(1.38,2.44,2.92),(2.58,.055,2.53),M['water'],.09)
box('Aquarium sand',(1.38,1.94,1.72),(2.52,.31,.11),M['sand'],.045)
# A shallow aquarium gives strong depth without an expensive transparent volume.
for i,(x,z,s) in enumerate([(.59,3.66,.32),(1.67,3.39,.25),(2.34,3.84,.22),(1.0,2.57,.21),(2.21,2.67,.29),(.37,2.99,.15)]):
    j=jelly('Window jelly %02d'%i,x,2.06,z,s,i%2==0);j.scale.y=.75
box('Aquarium thin front glazing',(1.38,1.755,2.92),(2.55,.008,2.50),M['glass'],.003)
for i in range(11):
    x=.18+i*.24;z=1.81+random.random()*.05
    ellipsoid('Aquarium pebble',(x,1.90,z),(.13,.10,.08),M['peri' if i%2 else 'lavender'],12,8)
for x in [.24,.42,2.35,2.55]:
    for j in range(3):
        pts=[(x+.055*sin(k*.7+j),1.93-j*.025,1.78+k*.07) for k in range(6+j)]
        path('Soft coral frond',pts,.03,M['coral' if j%2 else 'lavender'])
        if j==1:path('Coral branch',[(x,1.91,1.94),(x-.12,1.91,2.1),(x-.14,1.91,2.19)],.025,M['coral'])
for x in [.16,.59,2.18,2.57]:
    for j in range(3):
        a=j*.7
        path('Aquarium sage sea ribbon',[(x+.09*sin(k*.5+a),1.98,1.78+k*.065) for k in range(8)],.018,M['green'])
for x,z in [(.77,1.87),(1.66,1.83)]:star('Aquarium sand star',(x,1.81,z),.10,M['blush'])
for i in range(12):
    o=ellipsoid('Window bubble %02d'%i,(random.uniform(.2,2.5),1.86,random.uniform(1.95,4.0)),(.020,.012,.020),M['waterLight'],10,6);o['bubble']=True
for x,z in [(.35,3.85),(1.58,2.1)]:
    ellipsoid('Tiny aquarium fish',(x,1.88,z),(.07,.023,.035),M['sand'],12,8)
box('Aquarium projecting sill',(1.38,2.02,1.49),(3.03,.48,.15),M['white'],.07)

group('03 • loft and gentle stairs')
for x in [-2.28,-.25]:
    for y in [.37,2.21]:box('Loft rounded timber post',(x,y,1.23),(.16,.16,2.18),M['cream'],.045)
box('Loft platform',(-1.28,1.3,2.24),(2.34,2.15,.23),M['woodLight'],.065)
box('Loft lavender apron',(-1.28,.245,2.22),(2.40,.12,.28),M['lavender'],.045)
box('Plump cream mattress',(-1.28,1.32,2.47),(2.16,1.95,.28),M['white'],.13)
box('Lavender gingham duvet',(-1.28,1.08,2.64),(2.17,1.48,.20),M['gingham'],.095)
box('Duvet soft front drape',(-1.28,.39,2.49),(2.14,.14,.33),M['gingham'],.06)
for name in ['Lavender gingham duvet','Duvet soft front drape']:
    bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
duvet_profile=[(.30,2.40),(.29,2.47),(.30,2.54),(.33,2.62),(.40,2.68),(.49,2.71)]
duvet_profile += [(.53+i*.045,2.72+.015*sin(i*.24)) for i in range(26)]
fabric('Sculpted gingham quilt',-1.28,duvet_profile,2.16,M['gingham'])
path('Cream rolled quilt hem',[(-2.33+i*.06,.29,2.40+.018*sin(i*.68)) for i in range(36)],.018,M['cream'])
box('Rounded headboard',(-1.28,2.28,2.77),(2.35,.16,.74),M['lavender'],.10)
for x,mat in [(-1.76,M['blush']),(-.84,M['white'])]:
    o=pillow('Plump bed pillow',(x,1.99,2.88),(.40,.17,.26),mat,.08);o.rotation_euler.x=.38
star('Bed star cushion',(-1.28,1.70,2.95),.27,M['cream'])
# Whale plush: a broad soft silhouette, tiny face, two little flippers.
ellipsoid('Whale plush body',(-1.17,1.1,2.95),(.39,.23,.23),M['peri'])
ellipsoid('Whale plush belly',(-1.17,.976,2.88),(.30,.11,.11),M['cream'])
for x in [-1.39,-.98]:ellipsoid('Whale plush flipper',(x,.94,2.87),(.13,.12,.06),M['peri'],16,8)
for dx in [-.08,.08]:ellipsoid('Whale tail',(-.73+dx,1.17,3.01),(.14,.07,.085),M['peri'],16,8)
for x in [-1.39,-1.19]:ellipsoid('Whale eye',(x,.879,2.99),(.018,.012,.022),M['ink'],10,6)
for x in [-2.36,-.20]:box('Guardrail newel',(x,.29,2.69),(.14,.14,.83),M['cream'],.045)
box('Thick bed guardrail',(-1.28,.29,2.99),(2.42,.14,.13),M['woodLight'],.055)
for i,x in enumerate([-1.96,-1.3,-.64]):
    rod('Guardrail spindle',(x,.29,2.38),(x,.29,2.96),.036,M['cream']);star('Guardrail sea star',(x,.19,2.69),.16,M['pink' if i%2 else 'cream'])
# Side guards belong to the bed, even when room walls are hidden. Leave the
# front of the stair-side guard open for the landing onto the mattress.
for side,x,y,length in [('right',-.20,1.28,1.96),('left',-2.36,1.595,1.33)]:
    box('Loft side guard '+side,(x,y,2.70),(.12,length,.55),M['cream'],.025)
    box('Loft side guard cap '+side,(x,y,3.00),(.15,length+.02,.10),M['woodLight'],.035)
for i in range(6):
    y=-1.53+i*.335;h=(i+1)*.344
    box('Wide low stair %02d'%i,(-2.58,y,.145+h/2),(.69,.345,h),M['cream'],.04)
    box('Stair lavender tread %02d'%i,(-2.58,y,.16+h),(.73,.36,.07),M['blush'] if i%2 else M['woodLight'],.035)
rod('Sloping toy stair handrail',(-2.19,-1.63,.94),(-2.19,.17,2.87),.055,M['lavender'])
for y,z in [(-1.60,.51),(-.60,1.55),(.15,2.31)]:rod('Stair rail support',(-2.19,y,z),(-2.19,y,z+.53),.045,M['lavender'])

group('04 • under-loft study')
box('Rounded desk top',(-1.23,1.80,1.05),(1.87,.68,.13),M['woodLight'],.055)
for x in [-2.03,-.42]:
    for y in [1.56,2.03]:rod('Desk chunky leg',(x,y,.17),(x,y,1.0),.065,M['wood'])
box('Desk drawer',(-1.74,1.77,.88),(.54,.58,.23),M['cream'],.04)
ellipsoid('Desk drawer knob',(-1.74,1.457,.9),(.04,.025,.028),M['woodDark'],12,8)
box('Laptop base',(-1.18,1.70,1.146),(.60,.39,.035),M['lavender'],.025)
o=box('Laptop screen frame',(-1.18,1.894,1.36),(.61,.045,.42),M['cream'],.04);o.rotation_euler.x=-.14
box('Laptop screen',(-1.18,1.856,1.36),(.53,.014,.33),M['screen'],.024)
for row in range(3):
    for col in range(8):box('Simple laptop key',(-1.40+col*.061,1.66+row*.065,1.168),(.042,.039,.008),M['cream'],.004)
box('Laptop touchpad',(-1.18,1.56,1.169),(.17,.063,.008),M['blush'],.005)
star('Screen star',(-1.18,1.84,1.36),.085,M['blush'])
lamp('Study jelly lamp',-1.93,1.78,1.115,.14)
mug('Desk tea',-.69,1.64,1.12,.067)
for i in range(3):book('Desk book',-.64+i*.10,2.02,1.115,.078,.24+random.random()*.08,['pink','peri','cream'][i])
cylinder('Pencil crock',(-.47,1.75,1.19),.052,.15,M['pink'])
for i in range(2):rod('Two pencils',(-.49+i*.033,1.75,1.19),(-.50+i*.042,1.75,1.43),.009,M['wood'])
box('Chair soft seat',(-1.17,.87,.64),(.56,.50,.15),M['blush'],.08)
for x in [-1.38,-.96]:
    for y in [.69,1.04]:rod('Chair rounded leg',(x,y,.17),(x,y,.62),.047,M['wood'])
for x in [-1.39,-.95]:rod('Chair back upright',(x,.67,.59),(x,.67,1.20),.045,M['wood'])
box('Chair curved back',(-1.17,.67,1.10),(.54,.11,.30),M['woodLight'],.09)
star('Chair cutout ornament',(-1.17,.604,1.10),.08,M['cream'])
# Bring the whole working set toward the opening so the bed does not hide the laptop/lamp.
for o in list(GROUP.objects):
    if o.parent is None:o.location.y-=.68
box('Study cubby back',(-1.83,.15,.83),(.54,.09,1.38),M['cream'],.03)
for z in [.22,.67,1.12,1.53]:box('Study cubby shelf',(-1.83,-.02,z),(.61,.43,.09),M['woodLight'],.028)
for x in [-2.09,-1.57]:box('Study cubby upright',(x,-.02,.87),(.085,.43,1.36),M['cream'],.028)
for z in [.27,.72,1.17]:
    for i in range(3):book('Cubby pastel book',-1.98+i*.12,-.04,z,.087,.27+random.random()*.06,['lavender','pink','cream'][i])

group('05 • round porthole')
o=cylinder('Porthole water',(-2.92,1.30,3.54),.57,.04,M['water']);o.rotation_euler.y=pi/2
torus('Porthole deep lavender rim',(-2.88,1.30,3.54),.59,.085,M['purple'],(0,pi/2,0))
torus('Porthole soft highlight',(-2.83,1.30,3.54),.545,.022,M['lavender'],(0,pi/2,0))
for i,(y,z,s) in enumerate([(1.13,3.6,.18),(1.53,3.40,.11)]):
    j=jelly('Porthole jelly '+str(i),-2.77,y,z,s,i==0);j.scale.x=.60

group('06 • soft sitting area')
# Cloud rug is a single softly extruded, lobed outline.
def cloud(name,x,y,z,rx,ry,mat):
    N=72;v=[]
    for zz in [z,z+.04]:
        for i in range(N):
            a=i*2*pi/N;r=1+.07*cos(a*7);v.append((x+rx*r*cos(a),y+ry*r*sin(a),zz))
    fs=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],fs);mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o)
    return o
cloud('Lavender cloud rug',.68,-.99,.155,1.39,.99,M['rug'])
for x in [.45,2.32]:
    for y in [.03,.86]:cylinder('Sofa stubby oak foot',(x,y,.29),.085,.25,M['wood'])
box('Sofa upholstered base',(1.38,.45,.51),(2.35,1.12,.43),M['blush'],.17)
box('Sofa thick curved back',(1.38,.92,.95),(2.38,.29,1.05),M['blush'],.14)
for x in [.31,2.45]:box('Sofa chunky round arm',(x,.37,.82),(.35,1.14,.78),M['blush'],.16)
for x in [.88,1.87]:box('Soft seat cushion',(x,.36,.76),(.96,.84,.22),M['white'],.10)
for x in [.88,1.87]:
    path('Seat tailored piping',[(x+.43*cos(a),.36+.36*sin(a),.79) for a in [2*pi*i/48 for i in range(49)]],.009,M['blush'])
for x,mat in [(.80,M['lavender']),(1.49,M['pink'])]:
    o=pillow('Sofa plump pillow',(x,.67,1.10),(.275,.13,.265),mat,.12 if x<1 else -.12)
ellipsoid('Pillow jelly applique',(.80,.542,1.16),(.125,.016,.12),M['blush'],16,8)
for i in range(3):path('Pillow embroidered tentacle',[(.80+(i-1)*.065+.009*sin(k),.527,1.1-k*.035) for k in range(5)],.011,M['cream'])
box('Soft folded throw',(2.0,.27,.9),(.47,.79,.06),M['gingham'],.025)
box('Throw falling over front',(2.0,-.12,.66),(.47,.07,.43),M['gingham'],.026)
for name in ['Soft folded throw','Throw falling over front']:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
fabric('Soft sofa throw',2.0,[(-.155,.42),(-.16,.53),(-.16,.65),(-.14,.79),(-.10,.88),(.0,.91),(.1,.92),(.23,.92),(.36,.92),(.49,.92),(.62,.93)],.48,M['gingham'])
for i in range(8):rod('Blanket tassel',(1.79+i*.059,-.147,.44),(1.79+i*.059,-.147,.38),.009,M['cream'])
cylinder('Round low tea table',(.64,-.94,.70),.69,.14,M['woodLight'],48)
for a in [0,2*pi/3,4*pi/3]:rod('Tea table chunky leg',(.64+.49*cos(a),-.94+.49*sin(a),.21),(.64+.41*cos(a),-.94+.41*sin(a),.65),.07,M['wood'])
for i in [-1,1]:
    o=box('Open book page',(.64+i*.145,-1.04,.794),(.285,.35,.025),M['cream'],.012);o.rotation_euler.y=i*.085
    box('Open book ocean illustration',(.64+i*.15,-1.04,.812),(.18,.23,.008),M['lavender' if i==1 else 'blush'],.009)
path('Book spine',[(.64,-1.22,.804),(.64,-.86,.804)],.012,M['woodDark'])
mug('Coffee table mug',.30,-.83,.78,.085)
lamp('Table miniature jelly',.95,-.68,.78,.095,'jar')
for i in range(6):
    a=i*2*pi/6;ellipsoid('Pouf petal',(1.54+.25*cos(a),-1.74+.25*sin(a),.36),(.22,.22,.20),M['pink' if i%2 else 'lavender'],20,12)
ellipsoid('Pouf center',(1.54,-1.74,.40),(.19,.19,.15),M['blush'])

group('07 • small jelly tank and lamps')
box('Small aquarium oak cabinet',(2.55,-1.12,.42),(.78,1.14,.57),M['woodLight'],.07)
for y in [-1.39,-.85]:
    box('Cabinet drawer front',(2.55,y,.44),(.80,.51,.40),M['cream'],.045)
    box('Cabinet recessed handle',(2.55,y-.27,.54),(.20,.022,.045),M['woodDark'],.018)
box('Small aquarium sand',(2.55,-1.12,.755),(.68,1.04,.08),M['sand'],.035)
box('Small aquarium back glass',(2.92,-1.12,1.03),(.012,1.10,.62),M['glass'],.004)
box('Small aquarium front glass',(2.18,-1.12,1.03),(.012,1.10,.62),M['glass'],.004)
for y in [-1.67,-.57]:box('Small aquarium end glass',(2.55,y,1.03),(.74,.012,.62),M['glass'],.004)
for z in [.74,1.34]:
    for x in [2.18,2.92]:box('Small aquarium frame',(x,-1.12,z),(.045,1.15,.045),M['lavender'],.02)
    for y in [-1.68,-.56]:box('Small aquarium frame',(2.55,y,z),(.79,.045,.045),M['lavender'],.02)
for x in [2.18,2.92]:
    for y in [-1.68,-.56]:box('Small aquarium upright',(x,y,1.04),(.045,.045,.64),M['lavender'],.018)
for i,(y,z) in enumerate([(-1.40,1.13),(-.90,1.08)]):jelly('Small tank jelly '+str(i),2.49,y,z,.12,i==0)
for i in range(4):ellipsoid('Small tank stone',(2.56,-1.47+i*.21,.82),(.10,.07,.035),M['lavender'],12,8)
lamp('Pendant jelly',2.5,1.4,3.78,.27,'hanging')
box('Bedside shelf',(-.42,2.17,3.20),(.61,.60,.13),M['woodLight'],.04)
lamp('Bedside warm jelly',-.42,2.09,3.27,.17)
box('Front nightlight side table',(-2.58,-2.02,.49),(.61,.56,.70),M['lavender'],.075)
for z in [.35,.61]:
    box('Nightlight cabinet drawer',(-2.58,-2.303,z),(.48,.025,.21),M['blush'],.025)
    ellipsoid('Night cabinet wooden knob',(-2.58,-2.334,z),(.027,.021,.022),M['wood'],12,8)
lamp('Glass dome nightlight',-2.58,-2.02,.85,.23,'jar')

group('08 • sparse plants and personal wall art')
box('Back display shelf',(1.05,2.17,4.43),(2.46,.49,.11),M['woodLight'],.045)
pot('Shelf trailing pothos',1.9,2.11,4.49,.23,True)
for i in range(4):book('Display book',.15+i*.12,2.18,4.49,.095,.27+random.random()*.08,['cream','pink','lavender','wood'][i])
pot('Bed corner greenery',-2.47,2.17,3.05,.24)
box('Corner plant ledge',(-2.50,2.17,2.99),(.71,.59,.12),M['woodLight'],.035)
pot('Stair plant',-2.62,-.89,1.26,.19)
pot('Sofa side leafy plant',2.54,1.04,1.5,.26)
box('Plant wall ledge',(2.59,1.08,1.45),(.63,.55,.11),M['woodLight'],.04)
pot('Floor welcoming plant',-1.85,-2.07,.15,.32)
pot('Desk tiny plant',-.4,1.93,1.49,.15,True)
# Five pictures/stars, composed as one small salon above the bed.
frame('Small sea study',-1.95,2.46,3.72,.48,.60,'peri')
frame('Little wave',-1.30,2.46,3.90,.51,.43,'pink','wave')
frame('Sea star print',-.80,2.46,3.63,.36,.47,'lavender','star')
star('Hanging ceramic sea star',(-2.45,2.42,4.15),.17,M['pink'])
frame('Tiny ocean picture',-.18,2.46,4.02,.31,.40,'peri')
path('Picture hanging string',[(-2.45,2.47,4.65),(-2.45,2.44,4.26)],.008,M['wood'])
# Two deliberately placed pictures on the left wall complete the seven-piece art set.
before=set(GROUP.objects)
frame('Left wall sea memory',0,0,0,.42,.53,'peri','star')
frame('Left wall jelly memory',.63,0,-.39,.38,.46,'pink')
left_art=bpy.data.objects.new('Left wall art grouping',None);GROUP.objects.link(left_art)
for o in set(GROUP.objects)-before:
    if o!=left_art:o.parent=left_art
left_art.rotation_euler.z=pi/2;left_art.location=(-2.945,-1.70,3.13)
box('Left tiny shelf',(-2.72,-1.2,1.87),(.42,.73,.10),M['woodLight'],.035)
for i in range(2):
    o=box('Left shelf folded book',(-2.73,-1.18,1.96+i*.07),(.29,.41,.065),M['pink' if i else 'lavender'],.02)

group('09 • preview lighting and cameras')
def area(name,loc,power,color,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=rgb(color);data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);GROUP.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm softbox',(-3,-4,8),750,'FFF2DF',5,(0,0,1))
area('Soft room fill',(5,-1,6),330,'E3E3FF',5,(0,0,1.5))
area('Top cream bounce',(-1,3,7),300,'FFF3E1',4,(0,0,1))
area('Aquarium lavender spill',(1.4,1.65,3.1),55,'B4C7FF',2,(1.2,-.5,1.8))
area('Desk warm pool',(-1.6,.97,1.93),20,'FFD995',.8,(-1.2,.72,.7))
world=bpy.data.worlds.new('Pastel lavender environment');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb('DAD5EF'),1);world.node_tree.nodes['Background'].inputs[1].default_value=.28;scene.world=world
floor=box('Studio backdrop ground',(0,0,-.465),(200,200,.08),M['bg'],.02);floor['previewOnly']=True
bpy.ops.object.camera_add(location=(9,-12,10));camera=link(bpy.context.object,'Square orthographic camera')
camera.rotation_euler=(Vector((0,0,2.04))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=10.25;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.fps=30;scene.frame_start=1;scene.frame_end=180;scene.frame_set(1)
scene.use_nodes=True;nt=scene.node_tree;nt.nodes.clear()
rl=nt.nodes.new('CompositorNodeRLayers');glare=nt.nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='HIGH';glare.threshold=1.6;glare.mix=-.92
comp=nt.nodes.new('CompositorNodeComposite');nt.links.new(rl.outputs['Image'],glare.inputs['Image']);nt.links.new(glare.outputs['Image'],comp.inputs['Image'])
scene['brief']='Pastel jellyfish home. 6 × 5.1 × 4.7. Orthographic. No characters, text or UI.'
scene['source']='Procedurally authored original meshes. Separate furniture collections; linked repeated geometry.'
scene.cycles.preview_samples=16
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type=='VIEW_3D':
            space=area_ui.spaces.active;space.region_3d.view_perspective='CAMERA';space.region_3d.view_camera_zoom=0
            space.shading.type='MATERIAL';space.shading.use_scene_world=True;space.shading.use_scene_lights=True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'jellyfish-home.blend'))

# Keep the editable .blend modular; only the delivery GLB batches static material groups.
for o in list(scene.objects):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
# Flatten non-animated decorative lamps into the static batches. Group the five
# moving tendrils as one mesh per jelly, preserving a separate subtle sway node.
for root in [o for o in scene.objects if o.type=='EMPTY' and 'animated' in o]:
    if not root['animated']:
        for child in list(root.children):
            world_matrix=child.matrix_world.copy();child.parent=None;child.matrix_world=world_matrix
    else:
        buckets={}
        for child in list(root.children):
            if child.type=='MESH':buckets.setdefault((child.data.materials[0].name,bool(child.get('tentacle'))),[]).append(child)
        for (mat,is_tentacle),objects in buckets.items():
            if len(objects)<2:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];objects[0].data=objects[0].data.copy();bpy.ops.object.join()
            bpy.context.object.name=root.name+(' • tentacle fan' if is_tentacle else ' • luminous core')
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in {'MESH','EMPTY'} and not o.get('previewOnly'):o.select_set(True)
selected=[o for o in bpy.context.selected_objects if o.type=='MESH']
stats={'source_mesh_objects':len(selected),'source_triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in selected),'materials':len(set(m.name for o in selected for m in o.data.materials)), 'room_dimensions':[6,5.1,4.7]}
static={}
for o in selected:
    if o.parent is None and len(o.data.materials)==1:static.setdefault(o.data.materials[0].name,[]).append(o)
for mat,objects in static.items():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];objects[0].data=objects[0].data.copy();bpy.ops.object.join();bpy.context.object.name='Static batch • '+mat
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in {'MESH','EMPTY'} and not o.get('previewOnly'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'jellyfish-home.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_range=True,export_yup=True)
stats['glb_bytes']=os.path.getsize(os.path.join(OUT,'jellyfish-home.glb'));stats['export_mesh_objects']=len([o for o in bpy.context.selected_objects if o.type=='MESH'])
with open(os.path.join(OUT,'metrics.json'),'w') as f:json.dump(stats,f,indent=2)
print('SCENE_METRICS',json.dumps(stats),flush=True)
if '--no-render' not in sys.argv:
    scene.render.filepath=os.path.join(OUT,'preview-square.png');bpy.ops.render.render(write_still=True)
print('BUILD_COMPLETE',flush=True)
