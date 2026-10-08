import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OSPreviewProvider} from '../../context/OSContext';
import {VRActivityPicker} from '../../apps/vrWorld/VRActivityPicker';
import {runCollaborationTurn} from '../../features/collaboration/engine';
import {saveMcpServers,setMcpUseNativeTools} from '../../utils/mcpClient';
if(location.port!=='5190')throw Error('请使用独立测试端口 5190');
saveMcpServers([{id:'qa-mcp',name:'GitHub 演示工具',url:location.origin+'/__qa_mcp__',enabled:true,charIds:['qa-colleague'],updatedAt:1,tools:[{name:'read_file',description:'读取演示 README',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}}]}]);
setMcpUseNativeTools(true);
const original=window.fetch.bind(window),calls:string[]=[];
window.fetch=async(input,init)=>{
 const url=String(input);
 if(!url.includes('/__qa_'))return original(input,init);
 const body=JSON.parse(String(init?.body));
 if(url.includes('/__qa_mcp__')){
  calls.push(body.method);
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  if(body.method==='tools/call')await new Promise(resolve=>setTimeout(resolve,1200));
  return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:body.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'qa',version:'1'}}:{content:[{type:'text',text:'SullyOS 演示仓库使用 React + TypeScript + Vite。'}]}}),{headers:{'Content-Type':'application/json'}});
 }
 const result=body.messages.find((message:any)=>message.role==='tool');
 if(result&&!result.content.includes('React + TypeScript + Vite'))throw Error('工具结果未正确回传');
 return new Response(JSON.stringify({choices:[{message:result?{content:'已实际读取演示 README：项目使用 React + TypeScript + Vite。'}:{content:'',tool_calls:[{id:'qa-read',type:'function',function:{name:'read_file',arguments:'{"path":"README.md"}'}}]}}]}),{headers:{'Content-Type':'application/json'}});
};
const os={registerBackHandler:()=>()=>{}} as any;
function Review(){const [picker,setPicker]=useState(false),[status,setStatus]=useState(''),[result,setResult]=useState(''),[pressed,setPressed]=useState('');
 return <OSPreviewProvider value={os}><main><h1>活动选择器 / 协同 MCP</h1><p>隔离演示：不连接真实 GitHub，不使用用户 API 或聊天。</p><button onClick={()=>setPicker(true)}>打开活动选择器</button><button onClick={async()=>{calls.length=0;setResult('');try{const reply=await runCollaborationTurn({characterId:'qa-colleague',profile:{baseUrl:'/__qa_model__',apiKey:'',model:'mock',stream:false,temperature:.5},contextSnapshot:'协同测试',messages:[{id:'u',sessionId:'s',role:'user',content:'看一下仓库的 README',createdAt:1}],onStatus:setStatus});setResult(reply.content+'\n协议步骤：'+calls.join(' → '));}catch(error){setResult(String(error));}}}>运行协同 MCP 验收</button><output role="status">{status||result}</output></main>{picker&&<div onPointerDownCapture={event=>{const button=(event.target as HTMLElement).closest('footer button');if(button)setPressed('按下时亮度：'+getComputedStyle(button).filter);}}><VRActivityPicker char={{id:'qa-colleague',name:'小栗'} as any} libraryAvailable={false} gardenReason="桌上还没有恐龙" onGo={()=>{}} onClose={()=>setPicker(false)}/><output id="hover-proof">{pressed||'鼠标悬停保持紫色，按下才变暗。'}</output></div>}</OSPreviewProvider>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Review/>);import.meta.hot?.dispose(()=>{root.unmount();window.fetch=original;});
