import React,{useState,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {OSPreviewProvider} from '../../context/OSContext';
import {testCharacter} from './room3d-test-character';
import type {Home3DState} from '../../apps/room3d/types';
const Setup=React.lazy(()=>import('../../apps/room3d/Home3DSetupEntry'));
// Exercise the real lazy-loaded onboarding and palette save in memory only.
const character:any={id:'qa-home-setup',name:'配色验收',homeDefinition:{kind:'virtual',notes:''},scheduleFeatureEnabled:false,chibiStudio:{home3D:{state:testCharacter.state}}};
function App(){
 const [home,setHome]=useState<Home3DState>();
 return <OSPreviewProvider value={{userProfile:{name:'你',chibiStudio:character.chibiStudio},apiConfig:{},characters:[character]} as any}>
  {home?<main style={{padding:32}}><h1>家园创建成功</h1><p>{home.rooms.length} 个房间 · {home.rooms.reduce((n,r)=>n+r.items.length,0)} 件家具</p><p>{home.rooms.map(r=>r.name).join(' · ')}</p><button onClick={()=>setHome(undefined)}>重新选择配色</button></main>:<Suspense fallback={<p>正在打开家园入口…</p>}><Setup character={character} onChange={setHome} onDefinitionChange={()=>{}} onBack={()=>{}} /></Suspense>}
 </OSPreviewProvider>;
}
const root=createRoot(document.getElementById('root')!);root.render(<App/>);
import.meta.hot?.dispose(()=>root.unmount());
