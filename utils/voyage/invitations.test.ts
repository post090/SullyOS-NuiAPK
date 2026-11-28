import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { DB, openDB } from '../db';
import { exportActivityTextAsset, isActivityTextAsset } from '../activityBackup';
import { assembleV2Backup, writeV2Backup } from '../backupFormat';
import { streamBackupArrayStore } from '../backupStoreStreaming';
import { createIndependentUserRemap } from '../independentUserRemap';
import { exportUserSpaces, importUserSpaces } from '../userSpaceBackup';
import { saveUserSpaces } from '../userSpaces';
import { listInvitations, saveApprovedPlan, saveInvitationReply, sendInvitation } from './invitations';
import { parseInvitationReply, VOYAGE_CONTEXT_PREFIX, VOYAGE_INVITE_PREFIX, type TripDraft } from './letter';
import { plannerRequestId } from './planner';
import { availableVoyageBooks, buildVoyageReference, readContextChoice, saveContextChoice } from './characterContext';

const inboxId = 'example-letter';
const firstChar = 'example-recipient';
const secondChar = 'second-recipient';
const draft: TripDraft = {
    version: 1, digest: 'a'.repeat(64), content: {
        destination: '测试城市', outline: '沿河散步', weather: '临近出发再查当地预报',
        alternatives: '雨天可选展馆', sources: ['https://example.org/guide'],
        itinerary: { timeZone: 'Asia/Shanghai', stops: [{ day: 1, startLocal: '10:00', durationMinutes: 45,
            place: '河边', route: '从车站步行十分钟', cost: '步行免费，茶饮价格待核实', weatherPlan: '降雨时可选展馆',
            placeNotes: '导览收录了沿岸的旧桥', scene: '天气好时可以沿河辨认旧桥', choices: ['到桥头看桥拱', '在步道休息'], sourceNumbers: [1],
            visuals: { photos: [{ imageUrl:'https://media.example.org/bridge.jpg', sourceUrl:'https://example.org/works/bridge',
                caption:'河岸旧桥', credit:'测试摄影者', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/' }] } }] }
    }
};
async function clearRecords() {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['assets', 'characters', 'messages'], 'readwrite');
        for (const name of ['assets', 'characters', 'messages']) tx.objectStore(name).clear();
        tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error);
    });
}
beforeEach(async () => {
    localStorage.clear();
    saveUserSpaces([{ id: 'default', name: '测试' }]);
    await clearRecords();
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('characters', 'readwrite');
        for (const id of [firstChar, secondChar]) tx.objectStore('characters').put({ id, name: '收件人', memories: [] });
        tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error);
    });
});
const send = () => sendInvitation(inboxId, firstChar, 'birthday', '慢慢选一个想去的地方。');
async function acceptAndApprove() {
    await send();
    await saveInvitationReply(inboxId, firstChar, { decision: 'accept', text: '我想去看看。' });
    return saveApprovedPlan(inboxId, firstChar, draft);
}

describe('旅行邀请', () => {
    it('previews exact user-selected source text and restores the per-character choice from a text backup', async () => {
        const mounted = { id: 'one', title: '同名条目', content: '  第一段\n第二段  ' };
        const other = { id: 'two', title: '同名条目', content: '不能混入' };
        const books = availableVoyageBooks([mounted]);
        expect([...availableVoyageBooks(undefined)]).toEqual([]);
        expect([...books.keys()]).toEqual([mounted.id]);
        const main = '  主提示词原文\n  保留空格。';
        const choice = { mode: 'main' as const, prompt: ' 自定义\n原文 ', extraNote: ' 留一段自由时间。\n下雨也可以逛书店。 ', worldbookIds: [mounted.id, other.id, 'removed'] };
        expect(buildVoyageReference(main, books, await readContextChoice(firstChar))).toBe('【角色主提示词】\n' + main);
        expect(buildVoyageReference(main, books, choice)).toBe('【角色主提示词】\n' + main + '\n\n【附加叮嘱】\n' + choice.extraNote + '\n\n【世界书 · 同名条目】\n' + mounted.content);
        expect(buildVoyageReference(main, books, { ...choice, mode: 'custom' })).toBe('【自定义提示词】\n' + choice.prompt + '\n\n【世界书 · 同名条目】\n' + mounted.content);
        expect(buildVoyageReference(main, books, { ...choice, extraNote: '  ', worldbookIds: [] })).toBe('【角色主提示词】\n' + main);
        expect(buildVoyageReference(main, books, { ...choice, mode: 'none', worldbookIds: [] })).toBe('');
        await saveContextChoice(firstChar, choice);
        await DB.saveAsset(VOYAGE_CONTEXT_PREFIX + secondChar, JSON.stringify({ mode: 'custom', prompt: '第二位自己的偏好', worldbookIds: [] }));
        const zip = await JSZip.loadAsync(await (await exportUserSpaces('text_only','current')).arrayBuffer());
        await clearRecords();
        await importUserSpaces(zip);
        expect(await readContextChoice(firstChar)).toEqual(choice);
        expect(await readContextChoice(secondChar)).toEqual({ mode: 'custom', prompt: '第二位自己的偏好', extraNote: '', worldbookIds: [] });
        const remap = createIndependentUserRemap(new Map());
        remap.noteCharacter(firstChar); remap.finish();
        const key = VOYAGE_CONTEXT_PREFIX + firstChar;
        expect(remap.row('assets', { id: key, data: JSON.stringify(choice) }).id).toBe(VOYAGE_CONTEXT_PREFIX + remap.newId(firstChar));
        await DB.deleteCharacter(firstChar);
        expect(await DB.getAsset(key)).toBeFalsy();
    });
    it('commits one invitation and one private chat message on concurrent sends, and validates the recipient', async () => {
        const [first, retry] = await Promise.all([send(), send()]);
        expect(retry).toEqual(first);
        await expect(sendInvitation(inboxId, secondChar, 'gift', '')).rejects.toThrow(/不匹配/);
        await expect(sendInvitation('no-recipient', 'missing-recipient', 'gift', '')).rejects.toThrow(/不存在/);
        expect(await listInvitations()).toEqual([first]);
        const chat = await DB.getMessagesByCharId(firstChar);
        expect(chat).toHaveLength(1);
        expect(chat[0]).toMatchObject({ role: 'user', metadata: { voyageInvitationId: inboxId } });
        expect(await DB.getMessagesByCharId(secondChar)).toHaveLength(0);
    });
    it('keeps later as a real choice and allows one subsequent answer to that precise reply', async () => {
        await send();
        const later = await saveInvitationReply(inboxId, firstChar, { decision: 'later', text: '我先看看假期。' });
        const no = { decision: 'decline' as const, text: '这次想留在家。' };
        expect(await saveInvitationReply(inboxId, firstChar, no)).toEqual(later);
        const [accepted, duplicate] = await Promise.all([1,2].map(() => saveInvitationReply(inboxId, firstChar, no, later.reply!.at)));
        expect(accepted.reply?.decision).toBe('decline'); expect(duplicate).toEqual(accepted);
        expect(await DB.getMessagesByCharId(firstChar)).toHaveLength(3);
        await expect(saveApprovedPlan(inboxId, firstChar, draft)).rejects.toThrow(/尚未被接受/);
        expect(() => parseInvitationReply({ decision: 'accept', text: '' })).toThrow();
    });
    it('stores only the approved snapshot without another chat message and rejects inconsistent versions', async () => {
        const saved = await acceptAndApprove();
        expect(await saveApprovedPlan(inboxId, firstChar, draft)).toEqual(saved);
        await expect(saveApprovedPlan(inboxId, firstChar, { ...draft, digest: 'b'.repeat(64) })).rejects.toThrow(/版本/);
        expect(await DB.getMessagesByCharId(firstChar)).toHaveLength(2);
        await sendInvitation('other-letter', secondChar, 'gift', '');
        await DB.deleteCharacter(firstChar);
        expect((await listInvitations()).map(item => item.charId)).toEqual([secondChar]);
    });
    it('rehydrates fields dropped by an old APK only from the exact approved content', async () => {
        const complete = { ...draft, digest:createHash('sha256').update(JSON.stringify(draft.content)).digest('hex') };
        const partial = structuredClone(complete);
        delete partial.content.itinerary!.stops[0].visuals;
        await send();
        await saveInvitationReply(inboxId, firstChar, { decision:'accept', text:'我想去看看。' });
        await saveApprovedPlan(inboxId, firstChar, partial);
        await expect(saveApprovedPlan(inboxId, firstChar, { ...complete, content:{ ...complete.content, outline:'其他内容' } })).rejects.toThrow(/摘要/);
        expect((await listInvitations())[0].approvedPlan).toEqual(partial);
        await saveApprovedPlan(inboxId, firstChar, complete);
        expect((await listInvitations())[0].approvedPlan).toEqual(complete);
        expect(await DB.getMessagesByCharId(firstChar)).toHaveLength(2);
    });
    it('restores the actual text ZIP from the Settings export path', async () => {
        const saved = await acceptAndApprove();
        const zip = new JSZip();
        const textStore = await streamBackupArrayStore(zip, 'assets', 'activityTextAssets', { transform: exportActivityTextAsset });
        await writeV2Backup(zip, { collaborationBackupMode: 'text_only' }, { prewrittenStores: { activityTextAssets: textStore } });
        const reopened = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
        const data = await assembleV2Backup(reopened, JSON.parse(await reopened.file('manifest.json')!.async('string')));
        await clearRecords();
        await DB.importFullData({ timestamp: 1, version: 2, ...data });
        expect(await listInvitations()).toEqual([saved]);
    });
    it.each(['text_only', 'full'] as const)('restores the letter, approval and associated chat through a %s user space ZIP', async mode => {
        const saved = await acceptAndApprove();
        const zip = await JSZip.loadAsync(await (await exportUserSpaces(mode, 'current')).arrayBuffer());
        await clearRecords();
        await importUserSpaces(zip);
        expect(await listInvitations()).toEqual([saved]);
        expect((await DB.getMessagesByCharId(firstChar)).map(m => m.role)).toEqual(['user','assistant']);
    });
    it('retains invitation history when an independent user imports it, with a fresh planner request identity', async () => {
        const saved = await acceptAndApprove();
        const remap = createIndependentUserRemap(new Map());
        remap.noteCharacter(firstChar); remap.finish();
        const key = VOYAGE_INVITE_PREFIX + inboxId;
        expect(isActivityTextAsset(key)).toBe(true);
        const remapped = remap.row('assets', { id: key, data: await DB.getAsset(key) });
        const copy = JSON.parse(remapped.data);
        expect(copy).toEqual({ ...saved, charId: remap.newId(firstChar) });
        expect(await plannerRequestId(copy)).not.toBe(await plannerRequestId(saved));
    });
});
