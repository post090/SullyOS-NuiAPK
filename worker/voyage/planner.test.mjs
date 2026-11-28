import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @vitest-environment node
import { test, onTestFinished, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createRequest, digest, getRequest, review, submitDraft } from './plans.mjs';
import { deliverPending, subscription, subscriptionCount } from './events.mjs';
import voyageWorker from './index.mjs';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

function fixture() {
  const sql = new DatabaseSync(':memory:');
  onTestFinished(() => sql.close());
  sql.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const db = {
    prepare(query) {
      return {
        bind(...params) {
          const statement = sql.prepare(query);
          return {
            run: () => statement.run(...params),
            first: () => statement.get(...params),
            all: () => ({ results: statement.all(...params) }),
          };
        },
      };
    },
    batch(statements) {
      sql.exec('BEGIN');
      try {
        for (const s of statements) s.run();
        sql.exec('COMMIT');
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const grants = [{ id: 'test-grant', scope: ['travel:plan'] }];
  return {
    DB: db,
    EVENT_ENCRYPTION_KEY: btoa('k'.repeat(32)),
    grants,
    OAUTH_PROVIDER: { listUserGrants: async () => ({ items: grants }) },
  };
}
const owner = 'test-space',
  id = 'trip-test-one';
const draft = {
  destination: '测试园林',
  outline: '上午散步',
  weather: '日期未定，临近出发再查分时预报',
  alternatives: '如有雨，在开放的连廊休息',
  sources: ['https://example.org/garden'],
};
test('only the owner can see a draft, revisions require review, same operation is idempotent', async () => {
  const { DB: db } = fixture();
  await createRequest(db, owner, id, '一日步行');
  await createRequest(db, owner, id, '一日步行');
  await assert.rejects(createRequest(db, owner, id, '另一人'), /其他内容/);
  await assert.rejects(getRequest(db, 'other', id), /找不到/);
  const v1 = await submitDraft(db, owner, id, 0, draft);
  assert.deepEqual(await submitDraft(db, owner, id, 0, draft), v1);
  assert.equal((await getRequest(db, owner, id)).approvedDraft, null);
  await assert.rejects(review(db, owner, id, { version: 1, digest: 'wrong', decision: 'approve' }), /刷新/);
  await review(db, owner, id, { ...v1, decision: 'return', feedback: '增加室内备选' });
  const v2 = await submitDraft(db, owner, id, 1, { ...draft, alternatives: '室内展览，闭馆时回酒店' });
  await assert.rejects(submitDraft(db, owner, id, 0, { ...draft, outline: '旧稿' }), /版本/);
  const approved = await review(db, owner, id, { ...v2, decision: 'approve' });
  assert.equal(approved.approvedDraft.digest, v2.digest);
  assert.equal((await review(db, owner, id, { ...v2, decision: 'approve' })).state, 'approved');
});
test('events verify their callback and send only a scoped stable request ID; retries and unsubscribe', async () => {
  const env = fixture();
  const delivery = {
    mode: 'webhook',
    url: 'https://chatgpt.com/test-callback',
    secret: 'whsec_' + btoa('s'.repeat(32)),
  };
  const params = { name: 'trip.requested', arguments: {}, delivery };
  let ids = [],
    challengeCount = 0,
    deliveryStatus = 503;
  async function receiver(url, options) {
    assert.equal(url, delivery.url);
    assert.equal(options.redirect, 'manual');
    const event = JSON.parse(options.body);
    const headers = options.headers;
    const signedData = [headers['webhook-id'], headers['webhook-timestamp'], options.body].join('.');
    const mac = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('s'.repeat(32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign('HMAC', mac, new TextEncoder().encode(signedData)),
    ).toString('base64');
    assert.equal(headers['webhook-signature'], 'v1,' + signature);
    if (event.type === 'verification') {
      challengeCount++;
      return Response.json({ challenge: event.challenge });
    }
    assert.deepEqual(event.data, { requestId: id });
    assert.equal(event.eventId, headers['webhook-id']);
    ids.push(event.eventId);
    return deliveryStatus === 307
      ? Response.redirect('https://example.org/another-receiver', 307)
      : new Response(null, { status: deliveryStatus });
  }
  await assert.rejects(
    subscription(
      env,
      owner,
      'events/subscribe',
      { ...params, delivery: { ...delivery, url: 'https://invalid.test/' } },
      'test-grant',
      receiver,
    ),
  );
  let redirected = 0;
  await assert.rejects(
    subscription(env, owner, 'events/subscribe', params, 'test-grant', async (url, options) => {
      redirected++;
      assert.equal(url, delivery.url);
      assert.equal(options.redirect, 'manual');
      return Response.redirect('https://example.org/another-receiver', 307);
    }),
    /challenge_failed/,
  );
  assert.equal(redirected, 1);
  assert.equal(await subscriptionCount(env, owner), 0);
  const sub = await subscription(env, owner, 'events/subscribe', params, 'test-grant', receiver);
  assert.equal(
    (await subscription(env, owner, 'events/subscribe', params, 'test-grant', receiver)).id,
    sub.id,
  );
  assert.equal(await subscriptionCount(env, owner), 1);
  assert.equal(challengeCount, 1);
  await createRequest(env.DB, owner, id, 'brief');
  await deliverPending(env, owner, receiver);
  env.DB.prepare('UPDATE deliveries SET lease_until=0 WHERE event=?').bind(ids[0]).run();
  deliveryStatus = 307;
  await deliverPending(env, owner, receiver);
  const redirectedDelivery = env.DB.prepare('SELECT status,received FROM deliveries WHERE event=?')
    .bind(ids[0])
    .first();
  assert.equal(redirectedDelivery.status, 307);
  assert.equal(redirectedDelivery.received, null);
  env.DB.prepare('UPDATE deliveries SET lease_until=0 WHERE event=?').bind(ids[0]).run();
  deliveryStatus = 202;
  await deliverPending(env, owner, receiver);
  await deliverPending(env, owner, receiver);
  assert.deepEqual(ids, [ids[0], ids[0], ids[0]]);
  env.grants.length = 0;
  assert.equal(await subscriptionCount(env, owner), 0);
  await createRequest(env.DB, owner, 'second-test', 'brief');
  await deliverPending(env, owner, receiver);
  assert.equal(ids.length, 3);
  await subscription(env, owner, 'events/unsubscribe', params, 'test-grant', receiver);
  assert.equal(
    env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE owner=?').bind(owner).first().n,
    0,
  );
});

test('real OAuth PKCE grants the planner tools while only the independently paired device approves a draft', async () => {
  const { OAUTH_PROVIDER: unused, ...env } = fixture();
  const kv = new Map();
  env.OAUTH_KV = {
    get: async (key, options) => {
      const value = kv.get(key) ?? null;
      return value && (options?.type === 'json' || options === 'json') ? JSON.parse(value) : value;
    },
    put: async (key, value) => {
      kv.set(key, value);
    },
    delete: async (key) => {
      kv.delete(key);
    },
    list: async ({ prefix = '' }) => ({
      keys: [...kv.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };
  const origin = 'https://voyage.example.org';
  const clientRedirect = 'https://client.example.org/approved';
  const deviceCode = 'd'.repeat(43),
    dotCode = 'p'.repeat(43);
  env.DB.prepare('INSERT INTO accounts VALUES(?,?,?)')
    .bind(owner, await digest(deviceCode), await digest(dotCode))
    .run();
  async function call(path, init = {}) {
    const pending = [];
    const request = new Request(new URL(path, origin), init);
    const response = await voyageWorker.fetch(request, env, {
      waitUntil: (promise) => pending.push(promise),
    });
    await Promise.all(pending);
    return response;
  }
  const json = (value) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  const form = (fields) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  assert.equal((await call('/mcp', json({}))).status, 401);
  const registration = await call(
    '/oauth/register',
    json({
      client_name: 'Local test planner',
      redirect_uris: [clientRedirect],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'travel:plan offline_access',
    }),
  );
  assert.equal(registration.status, 201);
  const clientId = (await registration.json()).client_id;
  const verifier = 'v'.repeat(60);
  const challenge = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  ).toString('base64url');
  const authorization = await call(
    '/authorize?' +
      new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: clientRedirect,
        scope: 'travel:plan offline_access',
        state: 'local-test',
        resource: origin + '/mcp',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
  );
  assert.equal(authorization.status, 200);
  const handle = (await authorization.text()).match(/name="handle" value="([^"]+)"/)?.[1];
  assert.ok(handle);
  const consent = form({ handle, code: dotCode, decision: 'allow' });
  consent.headers.Origin = origin;
  consent.headers.Cookie = authorization.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
  const callback = await call('/authorize', consent);
  assert.equal(callback.status, 302);
  const returned = new URL(callback.headers.get('Location'));
  assert.equal(returned.origin, new URL(clientRedirect).origin);
  assert.equal(returned.searchParams.get('state'), 'local-test');
  const tokenResponse = await call(
    '/oauth/token',
    form({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: returned.searchParams.get('code'),
      redirect_uri: clientRedirect,
      code_verifier: verifier,
      resource: origin + '/mcp',
    }),
  );
  assert.equal(tokenResponse.status, 200);
  const { access_token: token, refresh_token: refresh } = await tokenResponse.json();
  assert.ok(token && refresh);
  async function api(path, auth, body) {
    const init = body ? json(body) : { headers: {} };
    init.headers.Authorization = 'Bearer ' + auth;
    return call(path, init);
  }
  const route = '/device/requests/' + id;
  assert.equal((await api(route, dotCode, { brief: '测试' })).status, 401);
  assert.equal((await api(route, deviceCode, { brief: '测试' })).status, 200);
  const rpc = async (method, params) =>
    (await api('/mcp', token, { jsonrpc: '2.0', id: 1, method, params })).json();
  assert.ok((await rpc('tools/list', {})).result.tools.some((tool) => tool.name === 'submit_draft'));
  const delivery = {
    mode: 'webhook',
    url: 'https://chatgpt.com/local-contract-only',
    secret: 'whsec_' + btoa('s'.repeat(32)),
  };
  const delivered = [];
  let verificationTimeout = true;
  vi.stubGlobal('fetch', async (url, init) => {
    assert.equal(url, delivery.url);
    const event = JSON.parse(init.body);
    if (event.type === 'verification') {
      if (verificationTimeout) throw new DOMException('timed out', 'TimeoutError');
      return Response.json({ challenge: event.challenge });
    }
    delivered.push(event.data);
    return new Response(null, { status: 202 });
  });
  onTestFinished(() => vi.unstubAllGlobals());
  const subscribe = { name: 'trip.requested', arguments: {}, delivery };
  const timedOut = await rpc('events/subscribe', subscribe);
  assert.deepEqual(timedOut.error, {
    code: -32015, message: 'CallbackEndpointError', data: { reason: 'timeout' },
  });
  assert.equal((await (await api('/device/status', deviceCode)).json()).subscriptions, 0);
  verificationTimeout = false;
  assert.ok((await rpc('events/subscribe', subscribe)).result.id);
  assert.deepEqual(delivered, [{ requestId: id }]);
  assert.equal((await (await api('/device/status', deviceCode)).json()).subscriptions, 1);
  const submitted = await rpc('tools/call', {
    name: 'submit_draft',
    arguments: { requestId: id, baseVersion: 0, draft },
  });
  const version = JSON.parse(submitted.result.content[0].text);
  assert.equal(version.version, 1);
  assert.equal((await api(route + '/review', token, { ...version, decision: 'approve' })).status, 401);
  assert.equal((await (await api(route, deviceCode)).json()).approvedDraft, null);
  const result = await api(route + '/review', deviceCode, { ...version, decision: 'approve' });
  assert.equal((await result.json()).approvedDraft.digest, version.digest);
});
