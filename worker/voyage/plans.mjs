import { MAX_VOYAGE_REFERENCE_BYTES } from '../../utils/voyage/referenceLimits.js';
import { itinerarySchema, MAX_VOYAGE_SOURCES, readItinerary } from '../../utils/voyage/itinerary.ts';
const encoder = new TextEncoder();
export async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function cleanText(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new InputError('文字缺失或过长');
  return value.trim();
}
export function checkId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,96}$/.test(id)) throw new InputError('申请编号无效');
  return id;
}
const fields = { destination: 140, outline: 7000, weather: 2200, alternatives: 2200 };
export const draftSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...Object.keys(fields), 'sources', 'itinerary'],
  properties: {
    ...Object.fromEntries(Object.entries(fields).map(([k, maxLength]) => [k, { type: 'string', maxLength }])),
    outline: { type: 'string', maxLength: fields.outline, description: '供出发前了解的大概安排和节奏；分站时间、在地资料与探索选择单独放在 itinerary。' },
    sources: { type: 'array', minItems: 1, maxItems: MAX_VOYAGE_SOURCES, items: { type: 'string', format: 'uri' } },
    itinerary: itinerarySchema,
  },
};
function validateDraft(value) {
  if (!value || !Array.isArray(value.sources) || !value.sources.length || value.sources.length > MAX_VOYAGE_SOURCES)
    throw new InputError('请列出资料来源');
  const draft = Object.fromEntries(
    Object.entries(fields).map(([key, max]) => [key, cleanText(value[key], max)]),
  );
  draft.sources = value.sources.map((source) => {
    const url = URL.parse(cleanText(source, 500));
    if (!url || url.protocol !== 'https:' || url.username || url.password)
      throw new InputError('资料来源须为 HTTPS 链接');
    return url.href;
  });
  if (value.itinerary !== undefined) {
    try { draft.itinerary = readItinerary(value.itinerary, draft.sources.length); }
    catch (error) { throw new InputError(error.message); }
  }
  return draft;
}
export async function createRequest(db, owner, id, input, referenceText = '', reviewerGrant = null) {
  checkId(id);
  const brief = cleanText(input, 2000);
  if (typeof referenceText !== 'string' || encoder.encode(referenceText).length > MAX_VOYAGE_REFERENCE_BYTES)
    throw new InputError('角色资料超过 256 KiB，请减少所选条目', 413);
  const now = Date.now();
  const event = await digest(JSON.stringify([owner, id, 0]));
  await db.batch([
    db
      .prepare(
        "INSERT INTO requests(owner,id,brief,state,created) VALUES(?,?,?,'requested',?) ON CONFLICT DO NOTHING",
      )
      .bind(owner, id, brief, now),
    db.prepare(
      'INSERT INTO request_options(owner,id,reference_text,reviewer_grant) SELECT owner,id,?,? FROM requests WHERE owner=? AND id=? AND changes()=1',
    ).bind(referenceText, reviewerGrant, owner, id),
    db
      .prepare(
        'INSERT INTO events SELECT ?,owner,id,created FROM requests WHERE owner=? AND id=? AND brief=? ON CONFLICT DO NOTHING',
      )
      .bind(event, owner, id, brief),
  ]);
  const row = await db.prepare(
    "SELECT r.brief,COALESCE(o.reference_text,'') AS referenceText FROM requests r LEFT JOIN request_options o USING(owner,id) WHERE r.owner=? AND r.id=?",
  ).bind(owner, id).first();
  if (row.brief !== brief || row.referenceText !== referenceText) throw new InputError('同一申请已提交其他内容', 409);
}
export async function enableChatReview(db, owner, id, grant) {
  const result = await db.prepare(
    "INSERT INTO request_options(owner,id,reviewer_grant) SELECT owner,id,? FROM requests WHERE owner=? AND id=? AND state!='approved' ON CONFLICT(owner,id) DO UPDATE SET reviewer_grant=excluded.reviewer_grant RETURNING id",
  ).bind(grant, owner, checkId(id)).first();
  if (!result) throw new InputError('这份申请已定稿或不存在', 409);
}
export async function getRequest(db, owner, id) {
  const row = await db
    .prepare(
      "SELECT r.id,r.brief,r.state,r.version,r.approved,r.feedback,COALESCE(o.reference_text,'') AS referenceText,CASE WHEN o.reviewer_grant IS NULL THEN 'device' ELSE 'chat' END AS reviewMode FROM requests r LEFT JOIN request_options o USING(owner,id) WHERE r.owner=? AND r.id=?",
    )
    .bind(owner, checkId(id))
    .first();
  if (!row) throw new InputError('找不到申请', 404);
  const load = async (version) => {
    if (!version) return null;
    const d = await db
      .prepare('SELECT version,digest,content FROM drafts WHERE owner=? AND id=? AND version=?')
      .bind(owner, id, version)
      .first();
    return d && { version: d.version, digest: d.digest, content: JSON.parse(d.content) };
  };
  const draft = await load(row.version);
  return { ...row, draft, approvedDraft: row.approved === row.version ? draft : await load(row.approved) };
}
export async function submitDraft(db, owner, id, baseVersion, value) {
  checkId(id);
  if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) throw new InputError('草稿基础版本无效');
  const content = JSON.stringify(validateDraft(value));
  const hash = await digest(content);
  const version = baseVersion + 1;
  if (value.itinerary === undefined) {
    // A pre-upgrade client may retry a draft that D1 already saved before its connection dropped.
    const previous = await db.prepare('SELECT digest FROM drafts WHERE owner=? AND id=? AND version=?')
      .bind(owner, id, version).first();
    if (previous?.digest === hash) return { version, digest: hash };
    throw new InputError('新草稿需要每站的路线、费用、天气、现场资料和可选行动');
  }
  await db.batch([
    db
      .prepare(
        "INSERT INTO drafts SELECT owner,id,?,?,? FROM requests WHERE owner=? AND id=? AND version=? AND state IN ('requested','returned') ON CONFLICT DO NOTHING",
      )
      .bind(version, hash, content, owner, id, baseVersion),
    db
      .prepare(
        "UPDATE requests SET state='draft', version=? WHERE owner=? AND id=? AND version=? AND state IN ('requested','returned') AND EXISTS(SELECT 1 FROM drafts WHERE owner=? AND id=? AND version=? AND digest=?)",
      )
      .bind(version, owner, id, baseVersion, owner, id, version, hash),
  ]);
  const row = await db
    .prepare('SELECT digest FROM drafts WHERE owner=? AND id=? AND version=?')
    .bind(owner, id, version)
    .first();
  if (row?.digest !== hash) throw new InputError('申请不存在或版本已改变', 409);
  return { version, digest: hash };
}
export async function review(db, owner, id, input, reviewerGrant = null) {
  const { decision, version, digest: hash } = input;
  if (
    !['approve', 'return'].includes(decision) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    typeof hash !== 'string'
  )
    throw new InputError('审批参数无效');
  const feedback = decision === 'return' ? cleanText(input.feedback, 1000) : null;
  const state = decision === 'approve' ? 'approved' : 'returned';
  const event = await digest(JSON.stringify([owner, checkId(id), version]));
  const change = db
    .prepare(
      "UPDATE requests SET state=?,feedback=?,approved=CASE WHEN ?='approved' THEN version ELSE approved END WHERE owner=? AND id=? AND version=? AND state='draft' AND EXISTS (SELECT 1 FROM drafts WHERE owner=? AND id=? AND version=? AND digest=?) AND (? IS NULL OR EXISTS (SELECT 1 FROM request_options o WHERE o.owner=requests.owner AND o.id=requests.id AND o.reviewer_grant=?))",
    )
    .bind(state, feedback, state, owner, id, version, owner, id, version, hash, reviewerGrant, reviewerGrant);
  const statements = [change];
  if (state === 'returned')
    statements.push(
      db
        .prepare(
          "INSERT INTO events SELECT ?,owner,id,? FROM requests WHERE owner=? AND id=? AND version=? AND state='returned' AND changes()=1 ON CONFLICT DO NOTHING",
        )
        .bind(event, Date.now(), owner, id, version),
    );
  await db.batch(statements);
  const r = await getRequest(db, owner, id);
  if (r.version !== version || r.draft?.digest !== hash || r.state !== state || r.feedback !== feedback)
    throw new InputError('请刷新后审阅当前版本', 409);
  return r;
}
