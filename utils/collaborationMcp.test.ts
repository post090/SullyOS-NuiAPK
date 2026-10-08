import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import * as mcp from './mcpClient';
import * as api from './safeApi';
import {runCollaborationTurn} from '../features/collaboration/engine';
import {buildMcpOpenAITools} from './mcpToolBridge';

const profile={baseUrl:'https://model.example/v1',apiKey:'model-key',model:'test',temperature:.5,stream:true};
const messages=[{id:'u',sessionId:'s',role:'user' as const,content:'查看仓库里的 README',createdAt:1}];
const server=(id:string,charIds?:string[]):mcp.McpServerConfig=>({id,name:id,url:'https://tools.example/'+id,enabled:true,charIds,token:'tool-secret',updatedAt:1,tools:[{name:'read.file',description:'读取文件',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}}]});
const answer=(content:string)=>({choices:[{message:{role:'assistant',content}}]});
const native=(name:string,args='{"path":"README.md"}')=>({choices:[{message:{content:'我看看仓库。',tool_calls:[{id:'',type:'function',function:{name,arguments:args}}]}}]});
let request:ReturnType<typeof vi.spyOn>,tool:ReturnType<typeof vi.spyOn>;
beforeEach(()=>{localStorage.removeItem('aetheros.mcp.servers');mcp.setMcpUseNativeTools(true);mcp.saveMcpServers([server('github',['char-a'])]);request=vi.spyOn(api,'safeFetchJson');tool=vi.spyOn(mcp,'callMcpTool').mockResolvedValue({success:true,data:{text:'README 内容来自工具'}});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const turn=(extra={})=>runCollaborationTurn({profile,contextSnapshot:'当前协同任务',messages,characterId:'char-a',userName:'用户',...extra});
const body=(index:number)=>JSON.parse(request.mock.calls[index][1].body);
const name=()=>buildMcpOpenAITools('char-a').tools[0].function.name;

it('executes real mapped tools, returns linked results, and only exposes the final reply',async()=>{
 mcp.saveMcpServers([server('github',['char-a']),server('private',['char-b']),{...server('off'),enabled:false}]);
 const delta=vi.fn(),status=vi.fn(),abort=new AbortController();request.mockResolvedValueOnce(native(name())).mockResolvedValueOnce(answer('读到了 README。'));
 const reply=await turn({onDelta:delta,onStatus:status,thinkingEnabled:true,signal:abort.signal});
 expect(reply.content).toBe('读到了 README。');expect(body(0).tools).toHaveLength(1);expect(body(0).thinking).toBeUndefined();expect(JSON.stringify(body(0))).not.toContain('tool-secret');
 expect(tool).toHaveBeenCalledWith(expect.objectContaining({id:'github'}),'read.file',{path:'README.md'},abort.signal);
 const history=body(1).messages,result=history.find((m:any)=>m.role==='tool');expect(result.name).toBe(name());expect(result.tool_call_id).toBeTruthy();expect(result.content).toContain('README 内容来自工具');
 expect(delta.mock.calls).toEqual([['读到了 README。']]);expect(request.mock.calls[0][5]).toBeUndefined();expect(status).toHaveBeenCalledWith(expect.stringContaining('github'));
});
it('supports text compatibility mode without probing native tools first',async()=>{
 mcp.setMcpUseNativeTools(false);request.mockResolvedValueOnce(answer(`${name()}({"path":"README.md"})`)).mockResolvedValueOnce(answer('读取成功。'));
 await turn();expect(body(0).tools).toBeUndefined();expect(JSON.stringify(body(0))).toContain('MCP 兼容模式');expect(tool).toHaveBeenCalledOnce();expect(JSON.stringify(body(1))).toContain('README 内容来自工具');
});
it('falls back once when the API rejects tools',async()=>{
 request.mockRejectedValueOnce(new Error('HTTP 400 unsupported tools')).mockResolvedValueOnce(answer(`${name()}({"path":"README.md"})`)).mockResolvedValueOnce(answer('已读到内容。'));
 await turn();expect(body(0).tools).toHaveLength(1);expect(body(1).tools).toBeUndefined();expect(tool).toHaveBeenCalledOnce();
});
it('never executes invalid arguments or an unknown tool',async()=>{
 request.mockResolvedValueOnce(native(name(),'{broken')).mockResolvedValueOnce(native('not_enabled')).mockResolvedValueOnce(answer('无法读取。'));
 await turn();expect(tool).not.toHaveBeenCalled();expect(JSON.stringify(body(1))).toContain('有效的 JSON');expect(JSON.stringify(body(2))).toContain('未知或未授权');
});
it('reports tool failure back to the model instead of claiming success',async()=>{
 tool.mockResolvedValueOnce({success:false,error:'服务器拒绝访问'});request.mockResolvedValueOnce(native(name())).mockResolvedValueOnce(answer('服务器拒绝访问。'));
 expect((await turn()).content).toBe('服务器拒绝访问。');expect(JSON.stringify(body(1))).toContain('失败：服务器拒绝访问');
});
it('stops immediately after cancellation during a tool call with no follow-up model request',async()=>{
 const abort=new AbortController();request.mockResolvedValueOnce(native(name()));tool.mockImplementationOnce(async()=>{abort.abort(new DOMException('stop','AbortError'));return {success:true,data:'late'};});
 await expect(turn({signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});expect(request).toHaveBeenCalledOnce();
});
it('does not reexecute identical requests in stalled rounds',async()=>{
 request.mockResolvedValueOnce(native(name())).mockResolvedValueOnce(native(name())).mockResolvedValueOnce(native(name())).mockResolvedValueOnce(answer('已根据第一次返回完成。'));
 await turn();expect(tool).toHaveBeenCalledOnce();expect(request).toHaveBeenCalledTimes(4);expect(body(3).tools).toBeUndefined();
});
it('preserves ordinary streaming and thinking when no tools are available for the character',async()=>{
 request.mockResolvedValueOnce(answer('正常回复'));const delta=vi.fn();await turn({characterId:'char-b',thinkingEnabled:true,onDelta:delta});
 expect(body(0).tools).toBeUndefined();expect(body(0).thinking).toBeTruthy();expect(request.mock.calls[0][5]).toBeTruthy();expect(tool).not.toHaveBeenCalled();
});
it('caps progressing calls and refuses to deliver another call as a completed answer',async()=>{
 let index=0;request.mockImplementation(async()=>native(name(),JSON.stringify({path:`file-${index++}`})));
 await expect(turn()).rejects.toThrow('工具调用已达到');expect(tool).toHaveBeenCalledTimes(12);expect(request).toHaveBeenCalledTimes(13);
});
it('does not execute tool-like private reasoning',async()=>{
 request.mockResolvedValueOnce({choices:[{message:{content:'这个任务不需要查工具。',reasoning_content:`${name()}({"path":"README.md"})`}}]});
 await turn();expect(tool).not.toHaveBeenCalled();
});
it('runs the real SSE parser and MCP handshake/call transport end to end',async()=>{
 request.mockRestore();tool.mockRestore();mcp.saveMcpServers([server('transport',['char-a'])]);
 const rpc:string[]=[],models:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any)=>{
  const payload=JSON.parse(init.body);
  if(String(url).includes('tools.example')){
   rpc.push(payload.method);
   if(payload.method==='notifications/initialized')return new Response(null,{status:202});
   expect(init.signal).toBeTruthy();
   const result=payload.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'mock',version:'1'}}:{content:[{type:'text',text:'transport-readme-proof'}]};
   return new Response(JSON.stringify({jsonrpc:'2.0',id:payload.id,result}),{headers:{'Content-Type':'application/json','Mcp-Session-Id':'collab-test-session'}});
  }
  models.push(payload);
  if(models.length===1){
   const chunks=[{choices:[{delta:{tool_calls:[{index:0,id:'sse-call',type:'function',function:{name:name(),arguments:'{"path":'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{arguments:'"README.md"}'}}]},finish_reason:'tool_calls'}]}];
   return new Response(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }
  expect(payload.messages.find((m:any)=>m.role==='tool').content).toContain('transport-readme-proof');
  return new Response(JSON.stringify(answer('真实工具返回已收到。')),{headers:{'Content-Type':'application/json'}});
 }));
 expect((await turn({signal:new AbortController().signal})).content).toBe('真实工具返回已收到。');
 expect(rpc).toEqual(['initialize','notifications/initialized','tools/call']);expect(models).toHaveLength(2);
});
