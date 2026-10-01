/** Local-only QA: real application Worker + SQLite D1 adapter + controllable fake LLM/MCP.
 * Run: node scripts/chat-stop-qa-server.mjs (Node 24+), then pnpm dev --port 5179.
 * Open /test/fixtures/chat-stop.html. No real model or external tool is contacted.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import webpush from 'web-push';
import { ReiClient } from '@rei-standard/amsg-client';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env} }', shortCircuit: true };
  return next(specifier, context);
} });
class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...values) { this.params = values.map(value => value ?? null); return this; }
  async run() { const result = this.db.prepare(this.sql).run(...this.params); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }, results: [] }; }
  async first() { return this.db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params) }; }
}
const database = new DatabaseSync(':memory:');
const d1 = { prepare: sql => new Statement(database, sql), batch: async statements => Promise.all(statements.map(statement => statement.run())) };
const vapid = webpush.generateVAPIDKeys();
const env = { DB: d1, AMSG_MASTER_KEY: crypto.randomBytes(32).toString('hex'), VAPID_EMAIL: 'mailto:qa@example.test', VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey };
const events = [];
const record = (kind, extra = {}) => { const event = { at: Date.now(), kind, ...extra }; events.push(event); console.log(JSON.stringify(event)); };
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://push.test/')) { record('push'); return Promise.resolve(new Response(null, { status: 201 })); }
  if (url.startsWith('https://qa-mcp.example.test/')) return realFetch('http://127.0.0.1:8799/mcp', init);
  return realFetch(input, init);
};
const { default: worker, InstantTickDO } = await import('../worker/amsg/worker.bundle.js');
const instances = new Map();
env.INSTANT_TICK = { idFromName: uuid => uuid, get(uuid) {
  if (!instances.has(uuid)) {
    const data = new Map(); let alarm = null; let instance;
    const storage = { put: async (key,value) => data.set(key,value), get: async key => data.get(key), delete: async key => data.delete(key), getAlarm: async () => alarm, setAlarm: async at => { alarm = at; setTimeout(() => { alarm = null; void instance.alarm().catch(error => record('worker-error', { error: String(error) })); }, 10); } };
    instance = new InstantTickDO({ storage }, env); instances.set(uuid, instance);
  }
  return instances.get(uuid);
} };
let scenario = 'wait';
let nextId = 0;
const releases = new Set();
const waitForRelease = res => new Promise(resolve => { const finish = () => { releases.delete(finish); resolve(); }; releases.add(finish); res.once('close', finish); });
const reply = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const completion = (text, toolCalls) => ({ id: 'qa', object: 'chat.completion', model: 'qa', choices: [{ index: 0, message: { role: 'assistant', content: text, ...(toolCalls ? { tool_calls: toolCalls } : {}) }, finish_reason: toolCalls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
const userId = crypto.randomUUID();
const server = http.createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks); const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/__scenario') { scenario = JSON.parse(raw).scenario; record('scenario', { scenario }); reply(res, { scenario }); return; }
    if (path === '/__release') { for (const release of [...releases]) release(); reply(res, { ok: true }); return; }
    if (path === '/__status') { reply(res, { scenario, events }); return; }
    if (path === '/__config') { reply(res, { userId, workerUrl: 'http://localhost:8799' }); return; }
    if (path.endsWith('/models')) { reply(res, { data: [{ id: 'qa-model' }] }); return; }
    if (path.endsWith('/chat/completions')) {
      const body = JSON.parse(raw); const mode = scenario; const id = ++nextId;
      record('llm-start', { id, scenario: mode, stream: !!body.stream, tools: body.tools?.map(tool => tool.function.name) ?? [] });
      res.once('close', () => record(res.writableEnded ? 'llm-complete' : 'llm-disconnected', { id }));
      if (mode === 'error') { reply(res, { error: { message: 'QA：余额不足，不统一错误码' } }, 402); return; }
      if (mode === 'tool' && !body.messages.some(message => message.role === 'tool')) {
        const tool = body.tools?.find(tool => tool.function.name.includes('pause_test'));
        reply(res, completion('', [{ id: 'qa-tool-call', type: 'function', function: { name: tool?.function.name ?? 'pause_test', arguments: '{}' } }])); return;
      }
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const delta = text => res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`);
        if (mode === 'stream') { delta('这段已经上屏，'); record('stream-prefix', { id }); }
        else res.write(': waiting\n\n');
        if (mode === 'wait' || mode === 'stream') await waitForRelease(res);
        if (res.destroyed) return;
        delta(mode === 'stream' ? '这段尚未收到，停止后不得保存。' : '新一轮回复成功。'); res.end('data: [DONE]\n\n');
      } else {
        if (mode === 'wait') await waitForRelease(res);
        if (!res.destroyed) reply(res, completion(mode === 'multi' ? '第一条已经显示\n第二条尚未显示\n第三条尚未显示' : '新一轮回复成功。'));
      }
      return;
    }
    if (path === '/mcp') {
      const body = JSON.parse(raw); record('mcp', { method: body.method });
      if (String(body.method).startsWith('notifications/')) { res.writeHead(202); res.end(); return; }
      if (body.method === 'initialize') { reply(res, { jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'qa', version: '1' } } }); return; }
      if (body.method === 'tools/call') {
        record('tool-start'); res.once('close', () => record(res.writableEnded ? 'tool-complete' : 'tool-disconnected'));
        await waitForRelease(res); if (res.destroyed) return;
      }
      reply(res, { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '假工具完成' }] } }); return;
    }
    record('worker-request', { method: req.method, path });
    const request = new Request(`http://localhost:8799${req.url}`, { method: req.method, headers: req.headers, body: ['GET','HEAD'].includes(req.method) || !raw.length ? undefined : raw });
    const response = await worker.fetch(request, env, { waitUntil: promise => promise.catch(error => record('waitUntil-error', { error: String(error) })) });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { record('server-error', { error: String(error) }); if (!res.headersSent) reply(res, { error: String(error) }, 500); else res.end(); }
});
await new Promise(resolve => server.listen(8799, '127.0.0.1', resolve));
await realFetch('http://127.0.0.1:8799/init-tenant', { method: 'POST', headers: { 'X-User-Id': userId } });
const client = new ReiClient({ baseUrl: 'http://127.0.0.1:8799', userId }); await client.init();
const receiver = crypto.createECDH('prime256v1'); receiver.generateKeys();
await client.putPushSubscription({ endpoint: 'https://push.test/qa', keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });
record('ready', { port: 8799 });
