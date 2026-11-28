import { OAuthProvider, getOAuthApi } from '@cloudflare/workers-oauth-provider';
import {
  checkId,
  createRequest,
  digest,
  draftSchema,
  getRequest,
  InputError,
  review,
  submitDraft,
} from './plans.mjs';
import { CallbackVerificationError, catalog, deliverPending, subscription, subscriptionCount } from './events.mjs';

const scope = 'travel:plan';
const noArgs = { type: 'object', properties: {}, additionalProperties: false };
const idArg = { type: 'string', minLength: 8, maxLength: 96 };
const tools = [
  {
    name: 'list_pending_requests',
    description: '列出当前账户待策划的虚拟旅行申请。',
    inputSchema: noArgs,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_trip_request',
    description: '读取一份申请、用户意见和草稿版本。',
    inputSchema: {
      type: 'object',
      required: ['requestId'],
      properties: { requestId: idArg },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'submit_draft',
    description: '提交旅行草稿供用户审阅。调查目的地分时天气、开放时间、可执行的替代路线及资料来源。',
    inputSchema: {
      type: 'object',
      required: ['requestId', 'baseVersion', 'draft'],
      additionalProperties: false,
      properties: { requestId: idArg, baseVersion: { type: 'integer', minimum: 0 }, draft: draftSchema },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];
const rpc = (id, result) => Response.json({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
async function jsonBody(req, max = 64000) {
  if (Number(req.headers.get('content-length')) > max) throw new InputError('请求过大', 413);
  const reader = req.body?.getReader();
  if (!reader) throw new InputError('缺少正文');
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new InputError('请求过大', 413);
    }
    parts.push(value);
  }
  try {
    return JSON.parse(await new Blob(parts).text());
  } catch {
    throw new InputError('无效 JSON');
  }
}
const planner = {
  async fetch(req, env, ctx) {
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    if (!ctx.props?.owner || !ctx.auth?.scope?.includes(scope)) return new Response(null, { status: 403 });
    const { owner } = ctx.props;
    let id = null,
      method = '';
    try {
      const input = await jsonBody(req);
      if (input?.jsonrpc !== '2.0' || typeof input.method !== 'string')
        return rpcError(null, -32600, 'Invalid request');
      ({ method, id = null } = input);
      const params = input.params ?? {};
      if (method.startsWith('notifications/') && input.id === undefined)
        return new Response(null, { status: 202 });
      if (method === 'initialize')
        return rpc(id, {
          protocolVersion: ['2025-03-26', '2025-06-18', '2025-11-25'].includes(params.protocolVersion)
            ? params.protocolVersion
            : '2025-11-25',
          capabilities: { tools: {}, events: {} },
          serverInfo: { name: 'sully-voyage', version: '1.0.0' },
        });
      if (method === 'ping') return rpc(id, {});
      if (method === 'tools/list') return rpc(id, { tools });
      if (method === 'events/list') {
        console.info('voyage.events', method);
        return rpc(id, catalog);
      }
      if (method === 'events/subscribe' || method === 'events/unsubscribe') {
        console.info('voyage.events', method, 'received');
        const grant = await env.OAUTH_PROVIDER.unwrapToken(ctx.auth.token);
        const sub = await subscription(env, owner, method, params, grant?.grantId);
        console.info('voyage.events', method, 'saved');
        if (method === 'events/subscribe') ctx.waitUntil(deliverPending(env, owner));
        return rpc(id, sub);
      }
      if (method !== 'tools/call') return rpcError(id, -32601, 'Method not found');
      const args = params.arguments ?? {};
      let result;
      if (params.name === 'list_pending_requests') {
        result = (
          await env.DB.prepare(
            "SELECT id,version,state,created FROM requests WHERE owner=? AND state IN ('requested','returned') ORDER BY created LIMIT 100",
          )
            .bind(owner)
            .all()
        ).results;
      } else if (params.name === 'get_trip_request') result = await getRequest(env.DB, owner, args.requestId);
      else if (params.name === 'submit_draft')
        result = await submitDraft(env.DB, owner, args.requestId, args.baseVersion, args.draft);
      else return rpcError(id, -32602, 'Unknown tool');
      return rpc(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (e) {
      const message = e instanceof InputError ? e.message : '处理失败，请重试';
      if (method === 'tools/call')
        return rpc(id, { isError: true, content: [{ type: 'text', text: message }] });
      if (method === 'events/subscribe' || method === 'events/unsubscribe') {
        if (e instanceof CallbackVerificationError) {
          console.warn('voyage.events', method, e.reason, e.httpStatus ?? 0);
          return rpcError(id, -32015, 'CallbackEndpointError', { reason: e.reason });
        }
        console.warn('voyage.events', method, e instanceof InputError ? e.message : 'internal_error');
      }
      return rpcError(id, e instanceof InputError ? -32602 : -32603, message);
    }
  },
};

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => '&#' + char.charCodeAt(0) + ';');
async function authorize(req, env) {
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === 'GET') {
    const auth = await oauth.parseAuthRequest(req);
    const info = await oauth.describeConsent(auth);
    const consent = await oauth.beginConsent(auth);
    consent.headers.set('Content-Type', 'text/html; charset=utf-8');
    consent.headers.set('Cache-Control', 'no-store');
    const body =
      '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>旅迹 · 连接 Dot</title>' +
      '<main style="max-width:30em;margin:12vh auto;padding:1em;font:16px/1.6 system-ui"><h1>连接旅行策划</h1><p>' +
      escape(info.clientName) +
      ' 可读取你的旅行简报并交回草稿。审批由你完成。</p>' +
      '<p>授权返回 ' +
      escape(info.redirectHost) +
      '</p>' +
      (info.clientDomain ? '<p>客户端域名 ' + escape(info.clientDomain) + '</p>' : '') +
      (info.redirectIsLoopback ? '<p>授权将返回此设备上的客户端。</p>' : '') +
      '<form method="post"><input type="hidden" name="handle" value="' +
      escape(consent.handle) +
      '"><label>旅行策划配对码 <input type="password" name="code" maxlength="100" autocomplete="off"></label><p><button name="decision" value="allow">同意连接</button> <button name="decision" value="deny">取消</button></p></form></main></html>';
    return new Response(body, { headers: consent.headers });
  }
  if (req.method !== 'POST' || req.headers.get('origin') !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  const form = await req.formData(),
    handle = String(form.get('handle') ?? '');
  if (form.get('decision') !== 'allow') {
    const denied = await oauth.denyConsent(req, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  const owner = await lookup(env, 'consent_hash', form.get('code'));
  if (!owner)
    return new Response('配对码不正确。请返回重试。', {
      status: 403,
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' },
    });
  const grant = await oauth.approveConsent(req, handle);
  const granted = grant.request.scope.filter((s) => s === scope || s === 'offline_access');
  if (!grant.request.scope.length) granted.push(scope);
  if (!granted.includes(scope)) return new Response('这项连接需要 travel:plan 授权。', { status: 403 });
  const result = await oauth.completeAuthorization({
    request: grant.request,
    userId: owner,
    scope: granted,
    metadata: { label: '旅行策划' },
    props: { owner },
  });
  grant.headers.set('Location', result.redirectTo);
  return new Response(null, { status: 302, headers: grant.headers });
}
async function lookup(env, column, code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{36,96}$/.test(code)) return null;
  const sql =
    column === 'consent_hash'
      ? 'SELECT id FROM accounts WHERE consent_hash=?'
      : 'SELECT id FROM accounts WHERE device_hash=?';
  return (
    (
      await env.DB.prepare(sql)
        .bind(await digest(code))
        .first()
    )?.id ?? null
  );
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};
async function device(req, env, ctx) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const owner = await lookup(
    env,
    'device_hash',
    (req.headers.get('authorization') || '').replace(/^Bearer /, ''),
  );
  const json = (value, status = 200) => Response.json(value, { status, headers: cors });
  if (!owner) return json({ error: '设备配对码无效' }, 401);
  const path = new URL(req.url).pathname;
  try {
    if (path === '/device/status' && req.method === 'GET') {
      return json({ subscriptions: await subscriptionCount(env, owner) });
    }
    const match = /^\/device\/requests\/([A-Za-z0-9_-]+)(\/review)?$/.exec(path);
    if (!match) return json({ error: '不存在的入口' }, 404);
    const id = checkId(match[1]);
    if (req.method === 'POST' && match[2]) {
      const row = await review(env.DB, owner, id, await jsonBody(req, 5000));
      if (row.state === 'returned') ctx.waitUntil(deliverPending(env, owner));
      return json(row);
    }
    if (req.method === 'POST') {
      await createRequest(env.DB, owner, id, (await jsonBody(req, 10000)).brief);
      ctx.waitUntil(deliverPending(env, owner));
    } else if (req.method !== 'GET' || match[2]) return json({ error: '请求方式无效' }, 405);
    const row = await getRequest(env.DB, owner, id);
    if (req.method === 'GET' && ['requested', 'returned'].includes(row.state))
      ctx.waitUntil(deliverPending(env, owner));
    return json(row);
  } catch (e) {
    return json(
      { error: e instanceof InputError ? e.message : '暂时无法处理，请重试' },
      e instanceof InputError ? e.status : 500,
    );
  }
}
const fallback = {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname;
    if (path === '/authorize') return authorize(req, env);
    if (path.startsWith('/device/')) return device(req, env, ctx);
    if (path === '/health') return Response.json({ service: 'sully-voyage', protocol: 1 });
    return new Response(null, { status: 404 });
  },
};
const options = {
  apiRoute: '/mcp',
  apiHandler: planner,
  defaultHandler: fallback,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: [scope, 'offline_access'],
  requiredScopes: [scope],
  clientIdMetadataDocumentEnabled: true,
};
export default {
  async fetch(req, env, ctx) {
    const origin = new URL(req.url).origin;
    const provider = new OAuthProvider({
      ...options,
      resourceMetadata: { resource: origin + '/mcp', authorization_servers: [origin] },
    });
    return provider.fetch(req, env, ctx);
  },
  async scheduled(_event, env) {
    const now = Date.now();
    const { results } = await env.DB.prepare(
      `SELECT s.owner FROM deliveries d JOIN subscriptions s ON s.id=d.sub
        JOIN events e ON e.id=d.event JOIN requests r ON r.owner=e.owner AND r.id=e.request_id
        WHERE d.received IS NULL AND d.attempts<12 AND d.lease_until<=? AND s.expires>? AND r.state IN ('requested','returned')
        AND e.rowid=(SELECT MAX(x.rowid) FROM events x WHERE x.owner=e.owner AND x.request_id=e.request_id)
        GROUP BY s.owner ORDER BY MIN(d.lease_until) LIMIT 8`,
    )
      .bind(now, now)
      .all();
    if (!results.length) return;
    const retryEnv = { ...env, OAUTH_PROVIDER: getOAuthApi(options, env) };
    for (const { owner } of results) await deliverPending(retryEnv, owner);
  },
};
