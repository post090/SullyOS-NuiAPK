import { checkId, cleanText, InputError, review } from './plans.mjs';

// A normal reply to a single draft can simply be "通过". Clarify the destination when several await a reply.
export async function recordChatReview(db, owner, grant, args) {
  const id = checkId(args.requestId);
  if (!Number.isSafeInteger(args.version) || args.version < 1 || !/^[a-f0-9]{64}$/.test(args.digest))
    throw new InputError('请指定你展示给用户的草稿版本');
  const target = await db.prepare(
    "SELECT r.state,json_extract(d.content,'$.destination') AS destination FROM request_options o JOIN requests r USING(owner,id) JOIN drafts d ON d.owner=r.owner AND d.id=r.id AND d.version=? AND d.digest=? WHERE o.owner=? AND o.id=? AND o.reviewer_grant=?",
  ).bind(args.version, args.digest, owner, id, grant).first();
  if (!target) throw new InputError('请核对本次聊天审核的授权和草稿版本', 403);
  const reply = cleanText(args.ownerReply, 1000);
  if (args.decision === 'approve') {
    const words = reply.normalize('NFKC').trim().replace(/[。.!！]+$/u, '').trim();
    const { destination } = target;
    const label = '[' + id + ']';
    const named = words.startsWith(destination) || words.startsWith(label);
    const decision = named ? words.slice(words.startsWith(label) ? label.length : destination.length).replace(/^[\s，,:：]+/u, '') : words;
    if (!['通过', '批准', '确认通过', '确认批准', '就按这版走', '按这版走', 'approve', 'approved',
      '通过第' + args.version + '版', '第' + args.version + '版通过'].includes(decision.toLowerCase()))
      throw new InputError('需要本人对这版行程明确回复「通过」');
    if (target.state === 'draft') {
      const other = await db.prepare(
        "SELECT 1 AS found FROM requests r JOIN request_options o USING(owner,id) JOIN drafts d ON d.owner=r.owner AND d.id=r.id AND d.version=r.version WHERE r.owner=? AND o.reviewer_grant=? AND r.state='draft' AND r.id!=? AND (?=0 OR json_extract(d.content,'$.destination')=?) LIMIT 1",
      ).bind(owner, grant, id, named ? 1 : 0, destination).first();
      if (other && !words.startsWith(label))
        throw new InputError('有多份待审草稿，请在回复中写明目的地；同名时请写 [申请编号] 通过');
    }
  } else if (args.decision !== 'return') {
    throw new InputError('审核决定无效');
  }
  return review(db, owner, id, {
    decision: args.decision, version: args.version, digest: args.digest, feedback: reply,
  }, grant);
}

// Keep long verbatim references readable via MCP without splitting a Unicode character.
export function referencePage(text, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length ||
      (offset < text.length && /[\uDC00-\uDFFF]/u.test(text[offset]))) throw new InputError('角色资料起点无效');
  let end = Math.min(offset + 6000, text.length);
  if (end < text.length && /[\uDC00-\uDFFF]/u.test(text[end])) end--;
  return { text: text.slice(offset, end), nextOffset: end < text.length ? end : null };
}
