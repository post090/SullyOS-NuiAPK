// Bound network/GLTF work and share concurrent requests; failures remain retryable.
export function createAssetQueue(load, concurrency=3){
 const pending=new Map(),queue=[];let running=0;
 function pump(){while(running<concurrency&&queue.length){const job=queue.shift();running++;Promise.resolve().then(()=>load(job.id)).then(job.resolve,job.reject).finally(()=>{running--;pending.delete(job.id);pump();});}}
 return id=>{if(pending.has(id))return pending.get(id);const promise=new Promise((resolve,reject)=>queue.push({id,resolve,reject}));pending.set(id,promise);pump();return promise;};
}
