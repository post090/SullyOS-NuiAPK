import React, { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function AcrylicStand({ image, yaw, spin }: { image:string; yaw:number; spin:boolean }) {
    const host=useRef<HTMLDivElement>(null), settings=useRef({yaw,spin});settings.current={yaw,spin};
    const [error,setError]=useState('');
    useEffect(()=>{
        let disposed=false, cleanup=()=>{};
        setError('');
        const img=new Image();
        img.onload=()=>{
            if(disposed)return;
            const resources:Array<{dispose():void}>=[];
            const keep=<V extends {dispose():void}>(v:V):V=>{resources.push(v);return v;};
            let renderer:T.WebGLRenderer|undefined;
            try{
                const source=document.createElement('canvas');source.width=img.width;source.height=img.height;
                const ctx=source.getContext('2d')!;ctx.drawImage(img,0,0);
                const data=ctx.getImageData(0,0,img.width,img.height).data;
                let minX=img.width,maxX=0,minY=img.height,maxY=0;
                for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)if(data[(y*img.width+x)*4+3]>48){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
                if(minX>maxX)throw new Error('图片没有可见内容');
                const crop=document.createElement('canvas');crop.width=maxX-minX+1;crop.height=maxY-minY+1;
                crop.getContext('2d')!.drawImage(source,minX,minY,crop.width,crop.height,0,0,crop.width,crop.height);
                const scale=2/crop.height,width=crop.width*scale,bottom=.37,margin=.075;
                const left:T.Vector2[]=[],right:T.Vector2[]=[];
                const step=Math.max(2,Math.round(crop.height/72));
                for(let y=minY;y<=maxY;y+=step){
                    let l=img.width,r=-1;
                    for(let dy=0;dy<step&&y+dy<=maxY;dy++)for(let x=minX;x<=maxX;x++)if(data[((y+dy)*img.width+x)*4+3]>48){l=Math.min(l,x);r=Math.max(r,x);}
                    if(r<0)continue;
                    const wy=bottom+(maxY-y)*scale;
                    left.push(new T.Vector2((l-minX)*scale-width/2-margin,wy));right.push(new T.Vector2((r-minX)*scale-width/2+margin,wy));
                }
                // A continuous die-cut silhouette, with clear bridges across small gaps.
                const outline=[new T.Vector2(0,bottom+2+margin),...left,new T.Vector2(-.16,bottom-margin),new T.Vector2(-.16,.105),new T.Vector2(.16,.105),new T.Vector2(.16,bottom-margin),...right.reverse()];
                const shape=new T.Shape();
                const first=outline[0].clone().add(outline[outline.length-1]).multiplyScalar(.5);shape.moveTo(first.x,first.y);
                outline.forEach((p,i)=>{const next=outline[(i+1)%outline.length];shape.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});shape.closePath();
                renderer=keep(new T.WebGLRenderer({antialias:true,alpha:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;
                const scene=new T.Scene();scene.background=new T.Color('#eeeae2');
                const env=new RoomEnvironment();const pmrem=keep(new T.PMREMGenerator(renderer));const target=keep(pmrem.fromScene(env,.04));env.dispose();scene.environment=target.texture;
                const root=new T.Group();scene.add(root);
                // Clear faces keep the print crisp; thicker polished side walls
                // carry the reflection/tint that makes the acrylic depth readable.
                const clear=keep(new T.MeshPhysicalMaterial({color:'#f5fcff',metalness:0,roughness:.045,ior:1.49,transparent:true,opacity:.055,depthWrite:false,clearcoat:1,envMapIntensity:.9}));
                const cutEdge=keep(new T.MeshPhysicalMaterial({color:'#bfdbdf',metalness:.06,roughness:.11,ior:1.49,transparent:true,opacity:.48,depthWrite:false,clearcoat:1,envMapIntensity:1.8}));
                const edgeMat=keep(new T.LineBasicMaterial({color:'#f6ffff',transparent:true,opacity:.60}));
                const addPlate=(z:number)=>{
                    const geometry=keep(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelThickness:.009,bevelSize:.009,bevelSegments:4,steps:1,curveSegments:4}));
                    const slab=new T.Mesh(geometry,[clear,cutEdge]);slab.position.z=z;slab.renderOrder=2;root.add(slab);
                    // Only the two contour rims, not every bevel tessellation edge.
                    const contour=shape.getPoints(240);
                    for(const depth of [-.007,.082]){
                        const lineGeo=keep(new T.BufferGeometry().setFromPoints(contour.map(p=>new T.Vector3(p.x,p.y,z+depth))));
                        const edge=new T.LineLoop(lineGeo,edgeMat);edge.renderOrder=3;root.add(edge);
                    }
                };
                addPlate(.013);addPlate(-.088);
                const texture=keep(new T.CanvasTexture(crop));texture.colorSpace=T.SRGBColorSpace;
                const printMat=keep(new T.MeshBasicMaterial({map:texture,alphaTest:.1,side:T.DoubleSide,toneMapped:false}));
                const print=new T.Mesh(keep(new T.PlaneGeometry(width,2)),printMat);print.position.set(0,bottom+1,0);print.renderOrder=0;root.add(print);
                const baseMat=keep(new T.MeshPhysicalMaterial({color:'#d4cbe8',roughness:.10,transmission:.65,thickness:.18,ior:1.49,transparent:true,depthWrite:false,clearcoat:1}));
                const baseShape=new T.Shape();baseShape.absarc(0,0,.74,0,Math.PI*2,false);
                // A real through-slot, with room for the two sheets and their bevels.
                const slot=new T.Path();slot.moveTo(-.17,-.115);slot.lineTo(.17,-.115);slot.quadraticCurveTo(.20,-.115,.20,-.085);slot.lineTo(.20,.085);slot.quadraticCurveTo(.20,.115,.17,.115);slot.lineTo(-.17,.115);slot.quadraticCurveTo(-.20,.115,-.20,.085);slot.lineTo(-.20,-.085);slot.quadraticCurveTo(-.20,-.115,-.17,-.115);baseShape.holes.push(slot);
                const baseGeo=keep(new T.ExtrudeGeometry(baseShape,{depth:.165,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:5,curveSegments:64}));
                const base=new T.Mesh(baseGeo,baseMat);base.rotation.x=-Math.PI/2;base.position.y=.035;root.add(base);
                const rimMat=keep(new T.MeshPhysicalMaterial({color:'#ede4f6',metalness:.35,roughness:.19,transparent:true,opacity:.7}));
                for(const y of [.028,.206]){
                    const rim=new T.Mesh(keep(new T.TorusGeometry(.739,.004,8,128)),rimMat);rim.rotation.x=Math.PI/2;rim.position.y=y;root.add(rim);
                }
                const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;
                const labelCtx=labelCanvas.getContext('2d')!;labelCtx.fillStyle='rgba(255,255,255,.75)';labelCtx.font='36px serif';labelCtx.textAlign='center';labelCtx.fillText('K A N A T A',256,76);
                const labelTex=keep(new T.CanvasTexture(labelCanvas));labelTex.colorSpace=T.SRGBColorSpace;
                const label=new T.Mesh(keep(new T.PlaneGeometry(.49,.1225)),keep(new T.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false,opacity:.8})));label.rotation.x=-Math.PI/2;label.position.set(0,.214,.43);label.renderOrder=4;root.add(label);
                const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
                const shadowCtx=shadowCanvas.getContext('2d')!;const fade=shadowCtx.createRadialGradient(64,64,15,64,64,64);fade.addColorStop(0,'rgba(79,69,90,.28)');fade.addColorStop(.55,'rgba(79,69,90,.12)');fade.addColorStop(1,'rgba(79,69,90,0)');shadowCtx.fillStyle=fade;shadowCtx.fillRect(0,0,128,128);
                const shadowTex=keep(new T.CanvasTexture(shadowCanvas));
                const shadow=new T.Mesh(keep(new T.PlaneGeometry(2.05,2.05)),keep(new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false})));shadow.rotation.x=-Math.PI/2;shadow.position.y=.008;scene.add(shadow);
                scene.add(new T.HemisphereLight('#ffffff','#b5a99a',2));
                const light=new T.DirectionalLight('#ffffff',2.5);light.position.set(-3,5,4);scene.add(light);
                const camera=new T.PerspectiveCamera(32,1,.1,30);
                const element=host.current!;element.appendChild(renderer.domElement);
                const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer!.setSize(w,h);camera.aspect=w/h;camera.position.set(0,2.05,Math.max(5.2,3.6/camera.aspect));camera.lookAt(0,1.18,0);camera.updateProjectionMatrix();};
                const observer=new ResizeObserver(resize);observer.observe(element);resize();
                let frame=0,previous=0,angle=0;
                const draw=(stamp:number)=>{frame=requestAnimationFrame(draw);const dt=previous?Math.min((stamp-previous)/1000,.05):0;previous=stamp;if(document.hidden)return;if(settings.current.spin)angle+=dt*.38;else angle=0;root.rotation.y=settings.current.yaw*Math.PI/180+angle;renderer!.render(scene,camera);};frame=requestAnimationFrame(draw);
                cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();renderer!.domElement.remove();resources.forEach(r=>r.dispose());};
            }catch(e){renderer?.domElement.remove();resources.forEach(r=>r.dispose());setError(String(e));}
        };
        img.onerror=()=>{if(!disposed)setError('原图加载失败');};img.src=image;
        return()=>{disposed=true;img.onload=null;img.onerror=null;cleanup();};
    },[image]);
    return <div ref={host} className="puppet">{error&&<p role="alert">{error}</p>}</div>;
}
