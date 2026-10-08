import fs from 'node:fs';
const file='output/cardigan-controller/clothing-0920b/manifest.json';
const manifest=JSON.parse(fs.readFileSync(file));
for(const id of ['collar-shirt','stand-collar','school-blazer','hood-parka','bow-headband','belt-coat']){
 const bytes=fs.readFileSync(`output/cardigan-controller/clothing-0920b/${id}-rig.glb`),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const primitives=json.nodes.filter(n=>n.name?.startsWith('Apparel_')&&n.mesh!==undefined).flatMap(n=>json.meshes[n.mesh].primitives);
 const item=manifest.find(m=>m.id===id);if(!item||!primitives.length)throw Error(`Missing rebuilt garment: ${id}`);
 item.triangles=primitives.reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);item.drawCalls=primitives.length;item.status=id==='belt-coat'?'reference-colored':'rebuilt-current-body';
 delete item.coveredBodyTriangles;delete item.pack;delete item.folder;
 if(id==='school-blazer'){item.label='翻领西装外套';item.open=true;}
}
fs.writeFileSync(file,JSON.stringify(manifest,null,2));
console.log('Updated six rebuilt / colored garment records.');
