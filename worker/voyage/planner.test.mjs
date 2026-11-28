import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @vitest-environment node
import { test, onTestFinished, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createRequest, digest, enableChatReview, getRequest, review, submitDraft, supplementPhotos } from './plans.mjs';
import { deliverPending, subscription, subscribedGrants } from './events.mjs';
import { recordChatReview, referencePage } from './chat-review.mjs';
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
  itinerary: { timeZone: 'Asia/Shanghai', stops: [{
    day: 1, startLocal: '10:30', durationMinutes: 40, place: '测试园林北门', route: '从车站步行约十分钟到北门',
    cost: '票价待核实', weatherPlan: '下雨时改走入口连廊', placeNotes: '园林导览标出了回廊和水池',
    scene: '若水面平静，可留意回廊的倒影', choices: ['在水池边多坐一会', '沿回廊看窗格'], sourceNumbers: [1],
    visuals: { photos: [], unavailableReason: '园林公开目录未标明摄影作品的授权' },
  }] },
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
  assert.equal((await subscribedGrants(env, owner)).length, 0);
  const sub = await subscription(env, owner, 'events/subscribe', params, 'test-grant', receiver);
  assert.equal(
    (await subscription(env, owner, 'events/subscribe', params, 'test-grant', receiver)).id,
    sub.id,
  );
  assert.equal((await subscribedGrants(env, owner)).length, 1);
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
  assert.equal((await subscribedGrants(env, owner)).length, 0);
  await createRequest(env.DB, owner, 'second-test', 'brief');
  await deliverPending(env, owner, receiver);
  assert.equal(ids.length, 3);
  await subscription(env, owner, 'events/unsubscribe', params, 'test-grant', receiver);
  assert.equal(
    env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE owner=?').bind(owner).first().n,
    0,
  );
});

test('real OAuth PKCE keeps legacy approvals on the device and permits chat review only for device-authorized requests', async () => {
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
  const nextId = 'chat-review-flow';
  const reference = '【角色主提示词】\n' + '持'.repeat(5988) + '🎒\n【世界书 · 自选】\n  原文  ';
  const newPath = '/device/requests/' + nextId;
  const deviceRow = await (await api(newPath, deviceCode, { brief: '半日', referenceText: reference, reviewMode: 'chat' })).json();
  assert.equal(deviceRow.reviewMode, 'chat');
  const callTool = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;
  const readResult = async (name, args) => JSON.parse((await callTool(name, args)).content[0].text);
  const row = await readResult('get_trip_request', { requestId: nextId });
  const rest = await readResult('get_trip_reference', { requestId: nextId, offset: row.reference.nextOffset });
  assert.equal(row.reference.text + rest.text, reference);
  const receipt = await readResult('submit_draft', { requestId: nextId, baseVersion: 0, draft });
  const picture = { imageUrl:'https://media.example.org/pool.jpg', sourceUrl:'https://example.org/works/pool',
    caption:'回廊旁的水池', credit:'测试摄影者', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/' };
  const illustrated = await readResult('supplement_stop_photos', { requestId: nextId, baseVersion:receipt.version, baseDigest:receipt.digest,
    stops:[{stopNumber:1, visuals:{photos:[picture]}}] });
  const deviceView = await (await api(newPath, deviceCode)).json();
  assert.deepEqual(deviceView.draft.content.itinerary.stops[0].visuals.photos, [picture]);
  assert.equal(deviceView.approvedDraft, null);
  const chat = { requestId: nextId, ...illustrated, decision: 'approve' };
  assert.equal((await callTool('record_chat_review', { ...chat, ownerReply: '看起来不错' })).isError, true);
  assert.equal((await (await api(newPath, deviceCode)).json()).state, 'draft');
  const decision = await readResult('record_chat_review', { ...chat, ownerReply: '通过' });
  assert.equal(decision.state, 'approved');
  assert.equal((await (await api(newPath, deviceCode)).json()).approvedDraft.digest, illustrated.digest);
});

test('pins the owner, grant, reply and shown version across revisions and concurrent trips', async () => {
  const { DB: db } = fixture();
  await createRequest(db, owner, id, '散步', '  主设原文\n');
  const v1 = await submitDraft(db, owner, id, 0, draft);
  const decision = { requestId: id, ...v1, ownerReply: '通过', decision: 'approve' };
  const apply = (args = decision, account = owner, grant = 'chosen') => recordChatReview(db, account, grant, args);
  await assert.rejects(apply(), /授权/);
  await enableChatReview(db, owner, id, 'chosen');
  await assert.rejects(apply(decision, 'another'), /授权/);
  await assert.rejects(apply(decision, owner, 'other-grant'), /授权/);
  for (const ownerReply of ['不错', '不通过', '如果通过呢？', '通过第2版']) await assert.rejects(apply({ ...decision, ownerReply }), /明确回复/);
  const feedback = { ...decision, decision: 'return', ownerReply: '把博物馆放到上午' };
  assert.equal((await apply(feedback)).feedback, feedback.ownerReply);
  assert.equal((await apply(feedback)).state, 'returned');
  const v2 = await submitDraft(db, owner, id, 1, { ...draft, outline: '上午参观博物馆' });
  await assert.rejects(apply(), /刷新/);
  await createRequest(db, owner, 'second-trip', '另一份', '', 'chosen');
  await submitDraft(db, owner, 'second-trip', 0, { ...draft, destination: '另一座园林' });
  const pending = { ...decision, ...v2 };
  await assert.rejects(apply(pending), /多份/);
  await assert.rejects(apply({ ...pending, ownerReply: '分站版通过' }), /多份/);
  await assert.rejects(apply({ ...pending, ownerReply: '通过另一座园林' }), /明确回复/);
  assert.equal((await apply({ ...pending, ownerReply: '测试园林，通过' })).approvedDraft.version, 2);
  assert.equal((await apply({ ...pending, ownerReply: '测试园林，通过' })).approvedDraft.version, 2);
  await assert.rejects(createRequest(db, owner, id, '散步', '换了资料'), /其他内容/);
  assert.equal((await getRequest(db, owner, id)).referenceText, '  主设原文\n');
});
test('long character reference pages round-trip intact, including supplementary characters', () => {
  const text = 'a'.repeat(5999) + '🎒后续';
  const first = referencePage(text);
  assert.equal(first.nextOffset, 5999);
  assert.equal(first.text + referencePage(text, first.nextOffset).text, text);
  assert.throws(() => referencePage(text, 6000), /起点/);
});
test('requires both layers per stop on new submissions and preserves prior-format drafts', async () => {
  const { DB: db } = fixture();
  await createRequest(db, owner, id, '慢慢走');
  const { itinerary, ...old } = draft;
  await assert.rejects(submitDraft(db, owner, id, 0, old), /每站/);
  const stop = itinerary.stops[0];
  for (const change of [{ scene: '' }, { cost: '' }, { choices: ['走走'] }, { sourceNumbers: [2] }, { startLocal: '24:10' }]) {
    await assert.rejects(submitDraft(db, owner, id, 0, { ...draft, itinerary: { ...itinerary, stops: [{ ...stop, ...change }] } }));
  }
  const saved = JSON.stringify(old), hash = await digest(saved);
  db.prepare('INSERT INTO drafts(owner,id,version,digest,content) VALUES(?,?,1,?,?)').bind(owner, id, hash, saved).run();
  db.prepare("UPDATE requests SET version=1,state='draft' WHERE owner=? AND id=?").bind(owner,id).run();
  assert.deepEqual(await submitDraft(db, owner, id, 0, old), { version: 1, digest: hash });
  assert.deepEqual((await getRequest(db, owner, id)).draft.content, old);
  await enableChatReview(db, owner, id, 'chosen');
  const detailedId = 'another-lake-trip';
  await createRequest(db, owner, detailedId, '同一座园林的分站版', '', 'chosen');
  const detailedVersion = await submitDraft(db, owner, detailedId, 0, draft);
  const reply = { requestId: detailedId, ...detailedVersion, decision: 'approve', ownerReply: '分站版通过' };
  await assert.rejects(recordChatReview(db, owner, 'chosen', { ...reply, requestId:id, digest:hash }), /明确回复/);
  assert.equal((await recordChatReview(db, owner, 'chosen', reply)).state, 'approved');
  assert.equal((await getRequest(db, owner, id)).state, 'draft');
  await review(db, owner, id, { decision:'return', version:1, digest:hash, feedback:'补充具体资料' });
  const updated = await submitDraft(db, owner, id, 1, draft);
  assert.equal(updated.version, 2);
  assert.deepEqual((await getRequest(db, owner, id)).draft.content.itinerary, itinerary);
});

test('preserves old signed stops and adds attributed photos only to the reviewed base, once', async () => {
  const { DB: db } = fixture();
  await createRequest(db, owner, id, '旧分站稿');
  const old = structuredClone(draft);
  delete old.itinerary.stops[0].visuals;
  await assert.rejects(submitDraft(db, owner, id, 0, old), /参考照/);
  const content = JSON.stringify(old), baseDigest = await digest(content);
  db.prepare('INSERT INTO drafts(owner,id,version,digest,content) VALUES(?,?,1,?,?)').bind(owner,id,baseDigest,content).run();
  db.prepare("UPDATE requests SET version=1,state='draft' WHERE owner=? AND id=?").bind(owner,id).run();
  assert.deepEqual(await submitDraft(db, owner, id, 0, old), { version:1, digest:baseDigest });
  const photo = { imageUrl:'https://media.example.org/garden.jpg', sourceUrl:'https://example.org/work/garden',
    caption:'园林北门的回廊', credit:'摄影者', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/' };
  const stops = [{ stopNumber:1, visuals:{ photos:[photo] } }];
  const add = (items, account=owner, hash=baseDigest) => supplementPhotos(db, account, id, 1, hash, items);
  for (const change of [{ imageUrl:'data:image/jpeg;base64,AAAA' }, { imageUrl:photo.sourceUrl },
    { sourceUrl:'https://127.0.0.1/work' }, { licenseUrl:'javascript:alert(1)' }, { credit:'' }, { license:'' }])
    await assert.rejects(add([{ stopNumber:1, visuals:{ photos:[{ ...photo, ...change }] } }]));
  await assert.rejects(add([{ stopNumber:1, visuals:{ photos:[] } }]), /原因/);
  await assert.rejects(add(stops,'other'), /刷新/);
  await assert.rejects(add(stops,owner,'f'.repeat(64)), /刷新/);
  const [receipt, retry] = await Promise.all([add(stops), add(stops)]);
  assert.deepEqual(receipt, retry);
  const pending = await getRequest(db, owner, id);
  assert.equal(receipt.version, 2);
  assert.equal(pending.state, 'draft');
  assert.equal(pending.approvedDraft, null);
  assert.deepEqual(pending.draft.content, { ...old, itinerary:{ ...old.itinerary, stops:[{ ...old.itinerary.stops[0], visuals:stops[0].visuals }] } });
  await assert.rejects(review(db,owner,id,{ version:1, digest:baseDigest, decision:'approve' }), /刷新/);
  await review(db,owner,id,{ ...receipt, decision:'approve' });
  await assert.rejects(supplementPhotos(db,owner,id,2,receipt.digest,stops), /已有照片/);
  await assert.rejects(add([{ stopNumber:1, visuals:{photos:[], unavailableReason:'没有授权'} }]), /版本/);
  assert.equal((await getRequest(db, owner, id)).approvedDraft.digest, receipt.digest);
});
