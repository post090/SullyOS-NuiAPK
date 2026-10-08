// Add shared, planar elbow cuts without moving the approved rest surface.
// pnpm node art/chibi/refine-elbow-loops.mjs <input.json> <output.json>
import fs from 'node:fs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Pass source and output JSON');
const data=JSON.parse(fs.readFileSync(input,'utf8')),before=data.indices.length/3;
for(const plane of [-.21,.21]){
 const edges=new Map(),out=[];
 const intersection=(a,b)=>{
  const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))return edges.get(key);
  const t=(plane-data.positions[a*3])/(data.positions[b*3]-data.positions[a*3]);
  if(t<1e-7)return a;if(t>1-1e-7)return b;
  const id=data.positions.length/3,n=[];
  for(let k=0;k<3;k++){data.positions.push(data.positions[a*3+k]*(1-t)+data.positions[b*3+k]*t);n.push(data.normals[a*3+k]*(1-t)+data.normals[b*3+k]*t);}
  data.positions[id*3]=plane;
  const length=Math.hypot(...n);data.normals.push(...n.map(v=>v/length));edges.set(key,id);return id;
 };
 const clip=(tri,sign)=>{
  const result=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],da=(data.positions[a*3]-plane)*sign,db=(data.positions[b*3]-plane)*sign;
   if(da>=0)result.push(a);if((da>0&&db<0)||(da<0&&db>0))result.push(intersection(a,b));
  }
  for(let j=1;j<result.length-1;j++)if(new Set([result[0],result[j],result[j+1]]).size===3)out.push(result[0],result[j],result[j+1]);
 };
 for(let i=0;i<data.indices.length;i+=3){const tri=data.indices.slice(i,i+3),xs=tri.map(v=>data.positions[v*3]);
  const inArm=tri.every(v=>data.positions[v*3+1]>.03&&data.positions[v*3+1]<.13);
  if(inArm&&Math.min(...xs)<plane&&Math.max(...xs)>plane){clip(tri,1);clip(tri,-1);}else out.push(...tri);
 }
 data.indices=out;
}
const edges=new Map();for(let i=0;i<data.indices.length;i+=3)for(let k=0;k<3;k++){const a=data.indices[i+k],b=data.indices[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);}
if([...edges.values()].some(n=>n!==2))throw Error('Cuts introduced an open or nonmanifold edge');
if(data.indices.length/3>4000)throw Error(`Body exceeds 4000 triangles: ${data.indices.length/3}`);
fs.writeFileSync(output,JSON.stringify(data));console.log({before,after:data.indices.length/3,added:data.indices.length/3-before,vertices:data.positions.length/3});
