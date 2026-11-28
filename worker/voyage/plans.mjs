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
  required: [...Object.keys(fields), 'sources'],
  properties: {
    ...Object.fromEntries(Object.entries(fields).map(([k, maxLength]) => [k, { type: 'string', maxLength }])),
    sources: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', format: 'uri' } },
  },
};
function validateDraft(value) {
  if (!value || !Array.isArray(value.sources) || !value.sources.length || value.sources.length > 12)
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
  return draft;
}
export async function createRequest(db, owner, id, input) {
  checkId(id);
  const brief = cleanText(input, 2000);
  const now = Date.now();
  const event = await digest(JSON.stringify([owner, id, 0]));
  await db.batch([
    db
      .prepare(
        "INSERT INTO requests(owner,id,brief,state,created) VALUES(?,?,?,'requested',?) ON CONFLICT DO NOTHING",
      )
      .bind(owner, id, brief, now),
    db
      .prepare(
        'INSERT INTO events SELECT ?,owner,id,created FROM requests WHERE owner=? AND id=? AND brief=? ON CONFLICT DO NOTHING',
      )
      .bind(event, owner, id, brief),
  ]);
  const row = await db.prepare('SELECT brief FROM requests WHERE owner=? AND id=?').bind(owner, id).first();
  if (row.brief !== brief) throw new InputError('同一申请已提交其他内容', 409);
}
export async function getRequest(db, owner, id) {
  const row = await db
    .prepare('SELECT id,brief,state,version,approved,feedback FROM requests WHERE owner=? AND id=?')
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
export async function review(db, owner, id, input) {
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
      "UPDATE requests SET state=?,feedback=?,approved=CASE WHEN ?='approved' THEN version ELSE approved END WHERE owner=? AND id=? AND version=? AND state='draft' AND EXISTS (SELECT 1 FROM drafts WHERE owner=? AND id=? AND version=? AND digest=?)",
    )
    .bind(state, feedback, state, owner, id, version, owner, id, version, hash);
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
