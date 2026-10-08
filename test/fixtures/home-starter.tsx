import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home3DView from '../../apps/room3d/Home3DView';
import {HomePalettePicker} from '../../apps/room3d/HomePalettePicker';
import {createStarterHome} from '../../apps/room3d/starterHome.js';
import {testCharacter} from './room3d-test-character';
import '../../apps/room3d/homeDefinition.css';
const catalog=await fetch('/room3d/catalog.json').then(r=>r.json());
function App(){const [home,setHome]=useState<any>(),[editor,setEditor]=useState<any>(),[report,setReport]=useState('');
const qa=new URLSearchParams(location.search).has('qa');
const inspect=()=>{const state=editor.inspect();setReport(JSON.stringify({visible:state.chibiVisible,room:state.rooms.find((r:any)=>r.id===state.activeRoomId)?.name,events:editor.getState().activityLog??[]}));};
return home?<><Home3DView value={home} character={{id:'qa-starter',name:'Sully',chibiStudio:{home3D:{state:testCharacter.state,hair:{layers:{},extras:[],bodyShape:'blank'}}}} as any} onChange={setHome} onEditor={setEditor} onBack={()=>setHome(undefined)}/>{qa&&editor&&<aside style={{position:'absolute',top:0,left:200,zIndex:100,background:'white'}}><button onClick={()=>{editor.setResidentRoom(home.rooms[4].id);inspect();}}>测试书房日程</button><button onClick={()=>{editor.setResidentRoom(null);inspect();}}>测试外出日程</button><button onClick={()=>{editor.setResidentRoom(undefined);inspect();}}>测试自由活动</button><button onClick={inspect}>检查当前状态</button><output>{report}</output></aside>}</>:<main className="home-definition"><div className="home-definition-content"><HomePalettePicker onChoose={id=>setHome(createStarterHome(catalog,id))}/></div></main>;}
createRoot(document.getElementById('root')!).render(<App/>);

