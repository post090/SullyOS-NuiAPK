# Original, flat graphic maps. Coordinates are the source garment's X/Z plane.
import bpy, numpy as np
from pathlib import Path
r=Path('D:/CHICK/SullyOS/output/sailor-school');N=1536
X,Z=np.meshgrid(np.linspace(-.145,.145,N),np.linspace(.43,.73,N))
white=np.array([.925,.934,.918,1],dtype=np.float32);navy=np.array([.208,.244,.329,1],dtype=np.float32);line=np.array([.98,.99,.97,1],dtype=np.float32)
def poly(points):
 inside=np.zeros((N,N),dtype=bool)
 for a,b in zip(points,points[1:]+points[:1]):
  if abs(b[1]-a[1])<1e-10:continue
  inside^=((a[1]>Z)!=(b[1]>Z))&(X<(b[0]-a[0])*(Z-a[1])/(b[1]-a[1])+a[0])
 return inside

def draw(a,points,width,color):
 for p,q in zip(points,points[1:]):
  dx=q[0]-p[0];dz=q[1]-p[1];t=np.clip(((X-p[0])*dx+(Z-p[1])*dz)/(dx*dx+dz*dz),0,1);dist=np.sqrt((X-(p[0]+dx*t))**2+(Z-(p[1]+dz*t))**2);mask=dist<width/2;a[mask]=color
for side in ['front','back']:
 a=np.broadcast_to(white,(N,N,4)).copy()
 if side=='front':
  for s in [-1,1]:
   mask=poly([(s*.031,.719),(s*.114,.692),(s*.012,.614),(0,.612)]);a[mask]=navy
   draw(a,[(s*.105,.690),(s*.011,.620)],.0027,line);draw(a,[(s*.094,.697),(s*.008,.633)],.0027,line)
  for z in [.661,.666]:draw(a,[(-.026,z),(.026,z)],.0017,navy)
  for z in [.601,.608]:draw(a,[(.040,z),(.079,z)],.0021,navy)
 else:
  a[poly([(-.117,.73),(.117,.73),(.109,.610),(-.109,.610)])]=navy
  for i in [0,1]:
   x=.102-i*.010;z=.618+i*.012;draw(a,[(-x,.70),(-x+.005,z+.004),(0,z),(x-.005,z+.004),(x,.70)],.003,line)
 im=bpy.data.images.new('Sailor flat '+side,width=N,height=N);im.pixels.foreach_set(a.ravel());im.filepath_raw=str(r/f'sailor-flat-{side}.png');im.file_format='PNG';im.save();im.pack()
