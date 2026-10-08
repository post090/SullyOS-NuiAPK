import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import HomeUpdatePopup from '../../components/os/HomeUpdatePopup';
function Preview(){const [open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>查看家园更新介绍</button>{open&&<HomeUpdatePopup onDone={()=>setOpen(false)} onVisit={()=>{location.href='/';}} onGuide={()=>{location.href='/changelogs/2026-10-home3d-beta.html';}}/>}</>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
