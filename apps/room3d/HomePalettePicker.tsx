import React from 'react';
import {ROOM_PALETTES} from './roomPalettes.js';
const labels:Record<string,string>={sage:'鼠尾草绿！',lilac:'淡紫色！',blush:'奶油粉！',aqua:'水蓝色！',cyber:'黑白紫！'};
export function HomePalettePicker({onChoose,busy=false}:{onChoose:(id:string)=>void;busy?:boolean}){
 return <section className="home-palette-picker"><h1>家里应该是……？</h1><div className="home-palette-options">{Object.entries(ROOM_PALETTES).map(([id,p])=><button key={id} disabled={busy} onClick={()=>onChoose(id)} aria-label={labels[id]}><span className="home-palette-house" style={{background:p.wall,borderColor:p.trim}}><i style={{background:p.accent}}/><i style={{background:p.soft}}/><i style={{background:p.floor}}/></span><strong>{labels[id]}</strong></button>)}</div><p>后续可在设置中修改</p>{busy&&<p role="status">正在布置你们的新家…</p>}</section>;
}
