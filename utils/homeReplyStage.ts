/** Abort the caller promptly even when a shared DB/recall operation has no signal API. */
export function awaitHomeStage<T>(signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
 if(signal.aborted)return Promise.reject(signal.reason||new DOMException('已取消','AbortError'));
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason||new DOMException('已取消','AbortError'));
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(()=>{if(signal.aborted)throw signal.reason;return work();}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
