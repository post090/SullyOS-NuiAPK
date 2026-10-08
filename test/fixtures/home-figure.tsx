import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import HomeFigureEditor from '../../components/character/HomeFigureEditor';
import HomeFigureStudio from '../../components/character/HomeFigureStudio';
import {OSPreviewProvider} from '../../context/OSContext';
import type {HomeFigureSlot} from '../../types';
import {testCharacter} from './room3d-test-character';
import {DB} from '../../utils/db';
import builtinParts from '../../public/like520/parts/manifest.json';
const customQA=new URLSearchParams(location.search).has('custom');
const mirrorQA=new URLSearchParams(location.search).has('mirror');
const mirrorSeed={...testCharacter.state,selected:{...testCharacter.state.selected,facemark:['facemark_04','facemark_07']},flipped:{fronthair:true,facemark_04:true},tintColor:{...testCharacter.state.tintColor,eyes:{L:{color:'#ff0000',hueIdx:1,sat:50,light:0},R:{color:'#0000ff',hueIdx:1,sat:50,light:0},linked:false}}};
const customRows=customQA?['fronthair','earhair','back1','back2','eyes','mouth','facemark','decor','skin','outfit','outer'].flatMap(categoryKey=>{
 const source=builtinParts.find(p=>p.categoryKey===categoryKey);
 return source?[{...source,id:`qa-custom-${categoryKey}`,name:`自绘验收 ${categoryKey}`,src:new URL(`/like520/${source.src}`,location.href).href,createdAt:1}]:[];
}):[];
// Synthetic uploaded parts, kept in memory; never edit the user's custom library.
if(customQA)DB.getCustomCreatorParts=async()=>customRows;
const customSeed=customQA?{...testCharacter.state,selected:{...testCharacter.state.selected,...Object.fromEntries(customRows.map(p=>[p.categoryKey,['facemark','decor'].includes(p.categoryKey)?[p.id]:p.id]))}}:undefined;
// Opt-in wardrobe QA is isolated from the user's actual profile/library.
if(new URLSearchParams(location.search).has('closet')){
 let outfits:any[]=[];
 DB.getUserProfile=async()=>({name:'衣柜验收',avatar:'',bio:'',wardrobeOutfits:outfits});
 DB.updateWardrobeOutfits=async update=>(outfits=update(outfits));
}

function App() {
    const [figure, setFigure] = useState<HomeFigureSlot | undefined>(()=>new URLSearchParams(location.search).has('stress')?{state:testCharacter.state,img:'',updatedAt:0,hair:{layers:{},extras:[],bodyShape:'blank',wardrobe:{top:'sailor-long',outer:'slouch-cardigan',bottom:'sailor-skirt',socks:'school-socks',shoes:'school-loafers'},wardrobeLayering:true}}:undefined);
    const [open, setOpen] = useState(true);
    return open ? <HomeFigureEditor name={new URLSearchParams(location.search).has('sully') ? 'Sully' : '验收角色'} ownerId="qa-home-figure" seedState={mirrorQA?mirrorSeed:customSeed??(new URLSearchParams(location.search).has('fresh') ? undefined : testCharacter.state)} value={figure} onClose={() => setOpen(false)} onSave={value => {setFigure(value); setOpen(false);}} /> : <main><p>形象{figure ? '已保存到本页测试状态' : '未保存'}</p><button onClick={() => setOpen(true)}>重新编辑</button>{(customQA||mirrorQA)&&<output aria-label="测试存档">{JSON.stringify({state:figure?.state,hair:figure?.hair})}</output>}</main>;
}
// Real source chooser and lazy editor, with saves confined to this fixture.
function SourceApp() {
    const [character,setCharacter]=useState<any>({id:'qa-source',name:'Sully',chibiStudio:{room:{state:testCharacter.state},vr:{state:testCharacter.state},home3D:{state:testCharacter.state,img:'',updatedAt:0}}});
    const [open,setOpen]=useState(true);
    const value:any={theme:{homelyPalette:'apricot'},characters:[character],userProfile:{name:'验收用户'},updateCharacter:(_id:string,update:any)=>setCharacter((previous:any)=>({...previous,...update(previous)})),updateUserProfile:()=>{}};
    return <OSPreviewProvider value={value}>{open?<HomeFigureStudio charId={character.id} startEditing onClose={()=>setOpen(false)} />:<button onClick={()=>setOpen(true)}>重新打开来源页</button>}</OSPreviewProvider>;
}
const root=createRoot(document.getElementById('root')!);root.render(new URLSearchParams(location.search).has('source')?<SourceApp />:<App />);
import.meta.hot?.dispose(()=>root.unmount());
