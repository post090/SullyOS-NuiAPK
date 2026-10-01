interface Store {getAssetRaw:(key:string)=>Promise<any>;saveAssetRaw:(key:string,value:any)=>Promise<any>}
/** Backups also migrate old browser-only presets, even if the old editor is never opened again. */
export async function migrateLegacyWhiteboxPresets(store:Store){
 const existing=await store.getAssetRaw('chrome_css_presets');if(Array.isArray(existing))return existing;
 const raw=localStorage.getItem('sully_chrome_css_presets_v1');if(!raw)return [];
 const values=JSON.parse(raw);if(!Array.isArray(values)||values.some(item=>!item||typeof item.name!=='string'||typeof item.code!=='string'))throw Error('旧版白框收藏格式无效，请先检查原始数据');
 if(values.length)await store.saveAssetRaw('chrome_css_presets',values);return values;
}
