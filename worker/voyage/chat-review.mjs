import { checkId, cleanText, InputError, review } from './plans.mjs';

const normalize = text => text.normalize('NFKC').trim().toLowerCase();
function approvalLabel(reply, version) {
  const words = normalize(reply).replace(/[。.!！]+$/u, '').trim();
  const terms = ['第' + version + '版通过', '通过第' + version + '版', '确认通过', '确认批准', '就按这版走', '按这版走', '批准', '通过', 'approved', 'approve'];
  if (terms.includes(words)) return '';
  if (/^(?:第\d+版通过|通过第\d+版)$/u.test(words)) return null;
  for (const term of terms) {
    if (words.endsWith(term)) return words.slice(0, -term.length).replace(/[\s,:，：]+$/u, '');
    if (words.startsWith(term)) return words.slice(term.length).replace(/^[\s,:，：]+/u, '');
  }
  return null;
}
function identifies(label, row) {
  if (label === '') return true;
  if (label === '[' + normalize(row.id) + ']') return true;
  if (['分站版', '详细版', '详版'].includes(label)) return !!row.detailed;
  if (['简版', '简稿', '简略版'].includes(label)) return !row.detailed;
  // Match the place the person named, without treating a negative or hypothetical reply as a title.
  if (label.length < 2 || /^(?:不想|不要|暂不|还没|没有|绝不|不能|能否|是否|如果|假如|要是)/u.test(label)) return false;
  return normalize(row.destination).includes(label);
}

// A normal reply to a single draft can simply be "通过". Clarify the destination when several await a reply.
export async function recordChatReview(db, owner, grant, args) {
  const id = checkId(args.requestId);
  if (!Number.isSafeInteger(args.version) || args.version < 1 || !/^[a-f0-9]{64}$/.test(args.digest))
    throw new InputError('请指定你展示给用户的草稿版本');
  const target = await db.prepare(
    "SELECT r.id,r.state,json_extract(d.content,'$.destination') AS destination,json_type(d.content,'$.itinerary') IS NOT NULL AS detailed FROM request_options o JOIN requests r USING(owner,id) JOIN drafts d ON d.owner=r.owner AND d.id=r.id AND d.version=? AND d.digest=? WHERE o.owner=? AND o.id=? AND o.reviewer_grant=?",
  ).bind(args.version, args.digest, owner, id, grant).first();
  if (!target) throw new InputError('请核对本次聊天审核的授权和草稿版本', 403);
  const reply = cleanText(args.ownerReply, 1000);
  if (args.decision === 'approve') {
    const label = approvalLabel(reply, args.version);
    if (label === null || !identifies(label, target))
      throw new InputError('需要本人对这版行程明确回复「通过」');
    if (target.state === 'draft') {
      const { results } = await db.prepare(
        "SELECT r.id,json_extract(d.content,'$.destination') AS destination,json_type(d.content,'$.itinerary') IS NOT NULL AS detailed FROM requests r JOIN request_options o USING(owner,id) JOIN drafts d ON d.owner=r.owner AND d.id=r.id AND d.version=r.version WHERE r.owner=? AND o.reviewer_grant=? AND r.state='draft' AND r.id!=?",
      ).bind(owner, grant, id).all();
      if (results.some(other => identifies(label, other)))
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
