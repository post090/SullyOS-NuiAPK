const HOME_DISPOSED='Home3D disposed';
export const homeDisposalReason=()=>new DOMException(HOME_DISPOSED,'AbortError');
/** Only a tagged home-asset lifecycle cancellation is quiet; real failures stay visible. */
export function isHomeAssetDisposal(error:unknown,signal:AbortSignal|null|undefined,url:string){
 return !!signal?.aborted&&(error as any)?.name==='AbortError'&&signal.reason?.name==='AbortError'&&signal.reason?.message===HOME_DISPOSED&&/\/room3d\//.test(url);
}
