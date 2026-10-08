import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home3DView from '../../apps/room3d/Home3DView';
import {testCharacter} from './room3d-test-character';
import {createStarterHome} from '../../apps/room3d/starterHome.js';
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json()),initial=createStarterHome(catalog,'sage');initial.activeRoomId=initial.rooms[5].id;
const character={id:'wave-review',name:'动作试看',chibiStudio:{home3D:{state:testCharacter.state,hair:{bodyShape:'blank'}}}} as any;
const choices=[['vrma-8bd33d84e90c0243','招手 · 当前入场'],['vrma-788371d87156b583','挥手回应'],['wave-cute','旧：可爱挥手'],['wave-calm','旧：冷静挥手'],['wave-alternate-1','编号 08 挥手'],['wave-alternate-2','编号 09 挥手']];
function App(){const [editor,setEditor]=useState<any>(),[selected,setSelected]=useState('vrma-8bd33d84e90c0243');return <><Home3DView value={initial} character={character} onEditor={setEditor} onChange={()=>{}} onBack={()=>{}}/><section className="wave-picker"><strong>挥手动作对照 · 点按钮重播</strong><div>{choices.map(([id,label])=><button key={id} disabled={!editor} aria-pressed={selected===id} onClick={()=>{setSelected(id);void editor.previewWave(id);}}>{label}</button>)}</div><div><button disabled={!editor} onClick={()=>editor.advanceTime(500)}>前进半秒并定格</button></div></section></>;}
const root=createRoot(document.getElementById('root')!);root.render(<App/>);import.meta.hot?.dispose(()=>root.unmount());
