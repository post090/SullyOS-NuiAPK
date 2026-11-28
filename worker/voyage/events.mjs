import { digest, InputError } from './plans.mjs';

const name = 'trip.requested';
const empty = { type: 'object', properties: {}, additionalProperties: false };
export const catalog = {
  events: [
    {
      name,
      description: '一份经用户提交或退回的虚拟旅行申请等待策划。',
      delivery: ['webhook'],
      inputSchema: empty,
      payloadSchema: {
        type: 'object',
        required: ['requestId'],
        properties: { requestId: { type: 'string' } },
        additionalProperties: false,
      },
    },
  ],
};
const utf8 = new TextEncoder();
const decode = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const encode = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
function callbackUrl(raw) {
  const url = typeof raw === 'string' && URL.parse(raw);
  if (
    !url ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !['openai.com', 'chatgpt.com'].some((host) => url.hostname === host || url.hostname.endsWith('.' + host))
  )
    throw new InputError('需要 ChatGPT 的 HTTPS 回调地址');
  return url.href;
}
async function boxKey(env) {
  return crypto.subtle.importKey('raw', decode(env.EVENT_ENCRYPTION_KEY), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
async function seal(env, value, sub) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(sub) },
    await boxKey(env),
    utf8.encode(value),
  );
  return encode(iv) + '.' + encode(data);
}
async function unseal(env, value, sub) {
  const [iv, body] = value.split('.');
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(iv), additionalData: utf8.encode(sub) },
    await boxKey(env),
    decode(body),
  );
  return new TextDecoder().decode(data);
}
async function postSigned(url, sub, id, payload, secrets, send) {
  const body = JSON.stringify(payload);
  const time = String(Math.floor(Date.now() / 1000));
  const signatures = await Promise.all(
    secrets.map(async (secret) => {
      const key = await crypto.subtle.importKey(
        'raw',
        decode(secret.slice(6)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      return 'v1,' + encode(await crypto.subtle.sign('HMAC', key, utf8.encode([id, time, body].join('.'))));
    }),
  );
  return send(callbackUrl(url), {
    method: 'POST',
    // Workers only supports "manual" and "follow". A signed callback must never follow a redirect.
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    body,
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': time,
      'webhook-signature': signatures.join(' '),
      'X-MCP-Subscription-Id': sub,
    },
  });
}
export class CallbackVerificationError extends Error {
  constructor(reason, httpStatus) {
    super(reason);
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}
async function verifyCallback(url, id, secret, send) {
  const challenge = crypto.randomUUID();
  let response, echo;
  try {
    response = await postSigned(
      url, id, crypto.randomUUID(), { type: 'verification', challenge }, [secret], send,
    );
    if (response.ok) echo = (await response.json())?.challenge;
    else await response.body?.cancel();
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'timeout' : 'challenge_failed';
    throw new CallbackVerificationError(reason, response?.status);
  }
  const expected = utf8.encode(challenge);
  const received = typeof echo === 'string' ? utf8.encode(echo) : new Uint8Array();
  let mismatch = expected.length ^ received.length;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ (received[i] ?? 0);
  if (mismatch) throw new CallbackVerificationError('challenge_failed', response.status);
}
export async function subscription(env, owner, method, params, grantId, send = fetch) {
  if (
    params.name !== name ||
    Object.keys(params.arguments ?? {}).length ||
    params.delivery?.mode !== 'webhook'
  )
    throw new InputError('订阅参数无效');
  const url = callbackUrl(params.delivery.url);
  const id = await digest(JSON.stringify([owner, url, name]));
  if (method === 'events/unsubscribe') {
    await env.DB.prepare('DELETE FROM subscriptions WHERE owner=? AND id=?').bind(owner, id).run();
    return {};
  }
  if (!grantId) throw new InputError('缺少旅行策划授权', 403);
  const secret = params.delivery.secret;
  if (typeof secret !== 'string' || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret) || secret.length > 96)
    throw new InputError('签名密钥无效');
  const key = decode(secret.slice(6));
  if (key.length < 24 || key.length > 64) throw new InputError('签名密钥长度无效');
  const ttl = params.ttlMs ?? 7 * 86400000;
  if (!Number.isSafeInteger(ttl) || ttl <= 0) throw new InputError('有效期无效');
  const prev = await env.DB.prepare('SELECT secret,expires FROM subscriptions WHERE id=?').bind(id).first();
  const old = prev && (await unseal(env, prev.secret, id));
  const now = Date.now();
  if (old !== secret || prev.expires <= now) {
    await verifyCallback(url, id, secret, send);
  }
  const expires = now + Math.min(ttl, 7 * 86400000);
  const rotated = old && old !== secret && prev.expires > now;
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO subscriptions(id,owner,url,secret,old_secret,rotate_until,expires) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,old_secret=CASE WHEN excluded.old_secret IS NOT NULL THEN excluded.old_secret ELSE subscriptions.old_secret END,rotate_until=CASE WHEN excluded.old_secret IS NOT NULL THEN excluded.rotate_until ELSE subscriptions.rotate_until END,expires=excluded.expires',
    ).bind(
      id,
      owner,
      url,
      await seal(env, secret, id),
      rotated ? prev.secret : null,
      rotated ? now + 300000 : null,
      expires,
    ),
    env.DB.prepare(
      'INSERT INTO subscription_grants(sub,grant_id) VALUES(?,?) ON CONFLICT(sub) DO UPDATE SET grant_id=excluded.grant_id',
    ).bind(id, grantId),
  ]);
  return { id, refreshBefore: new Date(expires).toISOString(), cursor: null, truncated: false };
}
async function activeGrants(env, owner) {
  const grants = new Set();
  let cursor;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(owner, { limit: 100, cursor });
    for (const grant of page.items) {
      if (grant.scope.includes('travel:plan') && (!grant.expiresAt || grant.expiresAt * 1000 > Date.now()))
        grants.add(grant.id);
    }
    cursor = page.cursor;
  } while (cursor);
  return grants;
}
export async function subscribedGrants(env, owner) {
  const rows = await env.DB.prepare(
    'SELECT g.grant_id FROM subscriptions s JOIN subscription_grants g ON g.sub=s.id WHERE s.owner=? AND s.expires>?',
  )
    .bind(owner, Date.now())
    .all();
  if (!rows.results.length) return [];
  const grants = await activeGrants(env, owner);
  return rows.results.map((row) => row.grant_id).filter((id) => grants.has(id));
}
/** Deliver only still-actionable requests. Stable event IDs survive timeouts and repeated refreshes. */
export async function deliverPending(env, owner, send = fetch) {
  const db = env.DB,
    now = Date.now();
  await db
    .prepare(
      "INSERT INTO deliveries(event,sub) SELECT e.id,s.id FROM events e JOIN subscriptions s ON s.owner=e.owner JOIN requests r ON r.owner=e.owner AND r.id=e.request_id WHERE e.owner=? AND s.expires>? AND r.state IN ('requested','returned') AND e.rowid=(SELECT MAX(x.rowid) FROM events x WHERE x.owner=e.owner AND x.request_id=e.request_id) ON CONFLICT DO NOTHING",
    )
    .bind(owner, now)
    .run();
  const { results } = await db
    .prepare(
      "SELECT d.event,d.sub,e.request_id,e.created,s.url,s.secret,s.old_secret,s.rotate_until,g.grant_id FROM deliveries d JOIN subscriptions s ON s.id=d.sub JOIN subscription_grants g ON g.sub=s.id JOIN events e ON e.id=d.event JOIN requests r ON r.owner=e.owner AND r.id=e.request_id WHERE s.owner=? AND s.expires>? AND d.received IS NULL AND d.lease_until<=? AND d.attempts<12 AND r.state IN ('requested','returned') AND e.rowid=(SELECT MAX(x.rowid) FROM events x WHERE x.owner=e.owner AND x.request_id=e.request_id) ORDER BY e.created LIMIT 8",
    )
    .bind(owner, now, now)
    .all();
  if (!results.length) return;
  const grants = await activeGrants(env, owner);
  await Promise.all(
    results.map(async (row) => {
      if (!grants.has(row.grant_id)) {
        await db
          .prepare(
            'UPDATE deliveries SET lease_until=? WHERE event=? AND sub=? AND received IS NULL AND lease_until<=?',
          )
          .bind(now + 900000, row.event, row.sub, now)
          .run();
        return;
      }
      const lease = await db
        .prepare(
          'UPDATE deliveries SET lease_until=?,attempts=attempts+1 WHERE event=? AND sub=? AND received IS NULL AND lease_until<=? RETURNING attempts',
        )
        .bind(now + 30000, row.event, row.sub, now)
        .first();
      if (!lease) return;
      let status = 0;
      try {
        const keys = [await unseal(env, row.secret, row.sub)];
        if (row.old_secret && row.rotate_until > now) keys.push(await unseal(env, row.old_secret, row.sub));
        const response = await postSigned(
          row.url,
          row.sub,
          row.event,
          {
            eventId: row.event,
            name,
            timestamp: new Date(row.created).toISOString(),
            data: { requestId: row.request_id },
            cursor: null,
          },
          keys,
          send,
        );
        status = response.status;
        await response.body?.cancel();
      } catch {
        /* Retry on the next planner action or refresh. */
      }
      const ok = status >= 200 && status < 300;
      await db
        .prepare(
          'UPDATE deliveries SET status=?,received=?,lease_until=?,attempts=? WHERE event=? AND sub=? AND attempts=?',
        )
        .bind(
          status,
          ok ? Date.now() : null,
          Date.now() + Math.min(3600000, 2000 * 2 ** lease.attempts),
          status === 413 ? 12 : lease.attempts,
          row.event,
          row.sub,
          lease.attempts,
        )
        .run();
      if (status === 410)
        await db
          .prepare('DELETE FROM subscriptions WHERE owner=? AND id=? AND secret=?')
          .bind(owner, row.sub, row.secret)
          .run();
    }),
  );
}
