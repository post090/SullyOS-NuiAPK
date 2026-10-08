import * as T from 'three';

/** A closed, curved extrusion for one transparent creator part. */
export function thickPart(image:HTMLImageElement, depth:number, surface:(x:number,y:number)=>number) {
    const resolution=112;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=resolution;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,resolution,resolution);
    const pixels=ctx.getImageData(0,0,resolution,resolution).data;
    const occupied=(x:number,y:number)=>x>=0&&y>=0&&x<resolution&&y<resolution&&pixels[(y*resolution+x)*4+3]>96;
    const vertices:number[]=[],uvs:number[]=[],walls:number[]=[],colors:number[]=[];
    const points=new Map<number,number[]>();
    const point=(x:number,y:number)=>{
        const key=y*(resolution+1)+x;
        let p=points.get(key);
        if(!p){const wx=(x/resolution*472-237)/325*1.875,wy=(424-y/resolution*472)/336*2;p=[wx,wy,surface(wx,wy)];points.set(key,p);}
        return p;
    };
    for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
        if(!occupied(x,y))continue;
        const corners=[[x,y],[x,y+1],[x+1,y+1],[x+1,y]];
        const front=corners.map(([a,b])=>point(a,b));
        const back=front.map(([a,b,c])=>[a,b,c-depth]);
        const uv=corners.map(([a,b])=>[a/resolution,1-b/resolution]);
        for(const ids of [[0,1,2],[0,2,3]])for(const i of ids){vertices.push(...front[i]);uvs.push(...uv[i]);}
        for(const ids of [[2,1,0],[3,2,0]])for(const i of ids){vertices.push(...back[i]);uvs.push(...uv[i]);}
        const offset=(y*resolution+x)*4;
        const color=new T.Color().setRGB(pixels[offset]/255,pixels[offset+1]/255,pixels[offset+2]/255,T.SRGBColorSpace);
        [[x-1,y],[x,y+1],[x+1,y],[x,y-1]].forEach(([nx,ny],i)=>{
            if(occupied(nx,ny))return;
            const j=(i+1)%4;
            for(const p of [front[i],back[i],back[j],front[i],back[j],front[j]]){walls.push(...p);colors.push(color.r,color.g,color.b);}
        });
    }
    const faces=new T.BufferGeometry();faces.setAttribute('position',new T.Float32BufferAttribute(vertices,3));faces.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));faces.computeVertexNormals();
    const sides=new T.BufferGeometry();sides.setAttribute('position',new T.Float32BufferAttribute(walls,3));sides.setAttribute('color',new T.Float32BufferAttribute(colors,3));sides.computeVertexNormals();
    return {faces,sides};
}

/** Continue each row's opaque garment edge around the back; never average the whole garment. */
export function clothingCanvas(image:HTMLImageElement, skin:string, rear:boolean) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=472;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,472,472);
    const data=ctx.getImageData(0,0,472,472).data;
    ctx.clearRect(0,0,472,472);ctx.fillStyle=skin;ctx.fillRect(0,0,472,472);
    for(let y=0;y<472;y++){
        let left=-1,right=-1;
        for(let x=0;x<472;x++)if(data[(y*472+x)*4+3]>192){if(left<0)left=x;right=x;}
        if(left<0)continue;
        const sample=(x:number)=>{const i=(y*472+x)*4;return `rgb(${data[i]},${data[i+1]},${data[i+2]})`;};
        // A couple of pixels inward avoid transparent/antialiased boundary colors.
        const l=Math.min(right,left+2),r=Math.max(left,right-2),mid=Math.round((left+right)/2);
        ctx.fillStyle=sample(l);ctx.fillRect(0,y,rear?mid:left,1);
        ctx.fillStyle=sample(r);ctx.fillRect(rear?mid:right,y,472-(rear?mid:right),1);
    }
    if(!rear)ctx.drawImage(image,0,0,472,472);
    return canvas;
}
