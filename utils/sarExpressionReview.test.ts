import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAMILIARITY_SCENES, familiarityScene } from './vrWorld/sarFamiliarity/catalog';
import { dialogueSentences } from './vrWorld/sarFamiliarity/dialogueText';
import {
    EXPRESSION_REVIEW_STORAGE_KEY,
    addressEquals,
    exportExpressionEdits,
    expressionEditKey,
    expressionEditSource,
    expressionEditStaleReason,
    expressionOverrides,
    isExpressionEditStale,
    isExpressionReviewAvailable,
    readExpressionEdits,
    resetExpressionEdit,
    subscribeExpressionEdits,
    writeExpressionEdit,
    type ExpressionAddress,
    type ExpressionEdit,
} from './vrWorld/sarFamiliarity/expressionReview';

import { DEFAULT_DEV_DEBUG_FLAGS, writeDevDebugFlags } from './devDebug';

const address: ExpressionAddress = { sceneId: 'C1-01', nodeId: 'start', line: 0, sentence: 0, npc: 'caian' };
const nextSentence: ExpressionAddress = { ...address, sentence: 1 };
const guest: ExpressionAddress = { ...address, npc: 'aiven' };

const memory = () => {
    const data = new Map<string, string>();
    return {
        getItem: vi.fn((key: string) => data.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
        removeItem: vi.fn((key: string) => { data.delete(key); }),
    };
};
let storage: ReturnType<typeof memory>;
let target: EventTarget;

beforeEach(() => {
    vi.stubEnv('DEV', true);
    storage = memory();
    target = new EventTarget();
    vi.stubGlobal('localStorage', storage);
    Object.defineProperty(target,'localStorage',{value:storage});
    vi.stubGlobal('window', target);
    vi.stubGlobal('__BUILD_BADGE_VISIBLE__', true);
    writeDevDebugFlags({...DEFAULT_DEV_DEBUG_FLAGS,sarExpressionReview:true});
    storage.setItem.mockClear();
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

const saveEnvelope = (edits: unknown[]) => storage.setItem(EXPRESSION_REVIEW_STORAGE_KEY, JSON.stringify({ version: 1, edits }));
const storageEvent = (key: string | null, storageArea: unknown = null) => {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: key }, storageArea: { value: storageArea } });
    target.dispatchEvent(event);
};

describe('temporary SAR expression review', () => {
    it('persists independent sentence and cast edits, reloads them, and never writes business storage', async () => {
        const businessKey = 'business-state-sentinel';
        const business = '{"wallet":123,"completed":["C1-SPECIAL"]}';
        storage.setItem(businessKey, business);
        storage.setItem.mockClear();
        writeExpressionEdit(address, 'happy', 'curious');
        writeExpressionEdit(nextSentence, 'happy', 'serious');
        writeExpressionEdit(guest, 'normal', 'interested');
        expect(storage.setItem.mock.calls.every(([key]) => key === EXPRESSION_REVIEW_STORAGE_KEY)).toBe(true);
        expect(storage.getItem(businessKey)).toBe(business);
        expect(JSON.parse(storage.getItem(EXPRESSION_REVIEW_STORAGE_KEY)!)).toMatchObject({ version: 1, edits: expect.any(Array) });
        const edits = readExpressionEdits();
        expect(edits).toHaveLength(3);
        expect(expressionOverrides(edits, 'C1-01', 'start', 0, 0)).toEqual({ caian: 'curious', aiven: 'interested' });
        expect(expressionOverrides(edits, 'C1-01', 'start', 0, 1)).toEqual({ caian: 'serious' });
        expect(expressionOverrides(edits, 'C1-01', 'answer-1', 0, 0)).toEqual({});
        expect(expressionOverrides(edits, 'C1-01', 'start', 1, 0)).toEqual({});
        edits[0].after = 'normal';
        expect(readExpressionEdits()[0].after).toBe('curious');
        vi.resetModules();
        const reloaded = await import('./vrWorld/sarFamiliarity/expressionReview');
        expect(reloaded.readExpressionEdits()).toEqual(readExpressionEdits());
    });

    it('keeps the original before value across revisions and removes only the restored address', () => {
        writeExpressionEdit(address, 'happy', 'curious');
        writeExpressionEdit(nextSentence, 'happy', 'serious');
        writeExpressionEdit(guest, 'normal', 'sad');
        // A caller may still be showing the previous preview when changing it again.
        writeExpressionEdit(address, 'curious', 'embarrassed');
        expect(readExpressionEdits().find(edit => addressEquals(edit, address))).toMatchObject({ before: 'happy', after: 'embarrassed' });
        writeExpressionEdit(address, 'embarrassed', 'happy');
        expect(readExpressionEdits().map(expressionEditKey)).toEqual([expressionEditKey(nextSentence), expressionEditKey(guest)]);
        resetExpressionEdit(nextSentence);
        expect(readExpressionEdits()).toHaveLength(1);
        expect(readExpressionEdits()[0].npc).toBe('aiven');
        resetExpressionEdit(address);
        expect(readExpressionEdits()).toHaveLength(1);
        resetExpressionEdit(guest);
        expect(readExpressionEdits()).toEqual([]);
    });

    it('resolves original placeholders and exports only authored text, source addresses and expressions', () => {
        const candidate = FAMILIARITY_SCENES.flatMap(scene => Object.entries(scene.nodes).flatMap(([nodeId, node]) =>
            node.lines.map((line, index) => ({ scene, nodeId, line, index }))))
            .find(entry => /[（(]user名[）)]/i.test(entry.line.text))!;
        expect(candidate).toBeDefined();
        const originalAddress: ExpressionAddress = { sceneId: candidate.scene.id, nodeId: candidate.nodeId, line: candidate.index, sentence: 0, npc: candidate.scene.npc };
        const source = expressionEditSource(originalAddress)!;
        writeExpressionEdit(originalAddress, 'normal', 'happy');
        const extraProperties = { ...readExpressionEdits()[0], userName: '不应导出的用户', wallet: 900, token: 'never-export-this' };
        storage.setItem('fishingMarket', JSON.stringify({ userName: '不应导出的用户', wallet: 900 }));
        const exported = exportExpressionEdits([extraProperties]);
        const result = JSON.parse(exported);
        expect(result).toMatchObject({ version: 1, kind: 'sar-expression-review', build: { branch: 'test', commit: '0000000' } });
        expect(result.edits[0]).toEqual({ ...readExpressionEdits()[0], sourcePath: source.sourcePath, stale: false, staleReason: null });
        expect(result.edits[0].text).toBe(candidate.line.text);
        expect(result.edits[0].sentenceText).toBe(dialogueSentences(candidate.line.text)[0]);
        expect(result.edits[0].text).toMatch(/[（(]user名[）)]/i);
        expect(exported).not.toMatch(/不应导出的用户|never-export-this|wallet|fishingMarket/);
        expect(source.sourcePath).toBe(`utils/vrWorld/sarFamiliarity/${candidate.scene.npc}.ts`);
    });

    it('uses the scene author source path even when editing the other character listening', () => {
        writeExpressionEdit(guest, 'normal', 'happy');
        expect(JSON.parse(exportExpressionEdits(readExpressionEdits())).edits[0].sourcePath).toBe('utils/vrWorld/sarFamiliarity/caian.ts');
    });

    it.each([
        [{ ...address, npc: 'aiven' }, 'normal', 'curious'],
        [address, 'normal', 'sleeping'],
        [address, 'sad', 'happy'],
        [{ ...address, npc: '__proto__' }, 'normal', 'happy'],
        [{ ...address, line: -1 }, 'normal', 'happy'],
        [{ ...address, sentence: .5 }, 'normal', 'happy'],
        [{ ...address, sentence: 99 }, 'normal', 'happy'],
        [{ ...address, nodeId: 'missing' }, 'normal', 'happy'],
        [{ ...address, nodeId: '__proto__' }, 'normal', 'happy'],
    ])('rejects illegal cast expressions or unavailable addresses without writing: %j', (badAddress, before, after) => {
        expect(() => writeExpressionEdit(badAddress as ExpressionAddress, before as never, after as never)).toThrow();
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(readExpressionEdits()).toEqual([]);
    });

    it.each(['not-json', 'null', '{"version":2,"edits":[]}', '{"version":1,"edits":{}}', '{"version":1,"edits":[{}]}'])('preserves corrupt storage instead of overwriting it: %s', raw => {
        storage.setItem(EXPRESSION_REVIEW_STORAGE_KEY, raw);
        expect(() => readExpressionEdits()).toThrow(/记录/);
        expect(() => writeExpressionEdit(address, 'happy', 'curious')).toThrow(/记录/);
        expect(() => resetExpressionEdit(address)).toThrow(/记录/);
        expect(storage.getItem(EXPRESSION_REVIEW_STORAGE_KEY)).toBe(raw);
    });

    it('rejects corrupted illegal and duplicate patches rather than applying ambiguous edits', () => {
        writeExpressionEdit(address, 'happy', 'curious');
        const edit = readExpressionEdits()[0];
        saveEnvelope([{ ...edit, after: 'sleeping' }]);
        expect(() => readExpressionEdits()).toThrow(/无效/);
        expect(expressionOverrides([{ ...edit, after: 'sleeping' }], 'C1-01', 'start', 0, 0)).toEqual({});
        saveEnvelope([edit, { ...edit, after: 'serious' }]);
        expect(() => readExpressionEdits()).toThrow(/重复/);
        expect(() => exportExpressionEdits([edit, edit])).toThrow(/重复/);
    });

    it('disables edits after an authored line changes, retains them for export, and requires explicit reset', () => {
        writeExpressionEdit(address, 'happy', 'curious');
        writeExpressionEdit(guest, 'normal', 'happy');
        const edited = readExpressionEdits()[0];
        const authoredLine = familiarityScene(address.sceneId)!.nodes.start.lines[0];
        const original = authoredLine.text;
        authoredLine.text = '新的一句话。原稿已经移动了。';
        try {
            expect(expressionOverrides(readExpressionEdits(), 'C1-01', 'start', 0, 0)).toEqual({});
            expect(isExpressionEditStale(edited)).toBe(true);
            expect(expressionEditStaleReason(edited)).toMatch(/台词已变化/);
            const exported = JSON.parse(exportExpressionEdits(readExpressionEdits()));
            expect(exported.edits[0]).toMatchObject({ text: original, stale: true, before: 'happy', after: 'curious' });
            expect(() => writeExpressionEdit(address, 'normal', 'serious')).toThrow(/先导出并撤回/);
            expect(readExpressionEdits()[0].text).toBe(original);
            resetExpressionEdit(address);
            writeExpressionEdit(address, 'normal', 'serious');
            expect(expressionOverrides(readExpressionEdits(), 'C1-01', 'start', 0, 0)).toEqual({ caian: 'serious' });
            expect(readExpressionEdits().find(edit => edit.npc === 'aiven')?.text).toBe(original);
        } finally { authoredLine.text = original; }
    });

    it('keeps removed node and changed sentence boundaries as stale review records', () => {
        writeExpressionEdit(address, 'happy', 'curious');
        const edit = readExpressionEdits()[0];
        const removedNode = { ...edit, nodeId: 'previous-node' };
        const movedSentence = { ...edit, sentence: 1 };
        const previousSplit = { ...edit, sentenceText: '旧版分句。' };
        saveEnvelope([removedNode, movedSentence, previousSplit]);
        const read = readExpressionEdits();
        expect(read.every(isExpressionEditStale)).toBe(true);
        expect(expressionOverrides(read, 'C1-01', 'start', 0, 0)).toEqual({});
        expect(expressionOverrides(read, 'C1-01', 'start', 0, 1)).toEqual({});
        expect(JSON.parse(exportExpressionEdits(read)).edits.every((e: { stale: boolean }) => e.stale)).toBe(true);
    });

    it('broadcasts only successfully persisted changes and syncs the correct cross-tab storage key', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeExpressionEdits(listener);
        writeExpressionEdit(address, 'happy', 'curious');
        expect(listener).toHaveBeenCalledTimes(1);
        storageEvent('another-key');
        storageEvent(EXPRESSION_REVIEW_STORAGE_KEY, {}); // sessionStorage or another storage area
        expect(listener).toHaveBeenCalledTimes(1);
        storageEvent(EXPRESSION_REVIEW_STORAGE_KEY, storage);
        storageEvent(null, storage); // localStorage.clear() in another tab
        expect(listener).toHaveBeenCalledTimes(3);
        const persisted = storage.getItem(EXPRESSION_REVIEW_STORAGE_KEY);
        storage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
        expect(() => writeExpressionEdit(address, 'curious', 'serious')).toThrow(/保存失败/);
        expect(storage.getItem(EXPRESSION_REVIEW_STORAGE_KEY)).toBe(persisted);
        expect(listener).toHaveBeenCalledTimes(3);
        storage.setItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
        expect(() => resetExpressionEdit(address)).toThrow(/保存失败/);
        expect(storage.getItem(EXPRESSION_REVIEW_STORAGE_KEY)).toBe(persisted);
        expect(listener).toHaveBeenCalledTimes(3);
        unsubscribe();
        storageEvent(EXPRESSION_REVIEW_STORAGE_KEY);
        resetExpressionEdit(address);
        expect(listener).toHaveBeenCalledTimes(3);
    });

    it('surfaces read permission errors without trying to overwrite storage', () => {
        const get=storage.getItem.getMockImplementation()!;storage.getItem.mockImplementation(key => { if(key===EXPRESSION_REVIEW_STORAGE_KEY)throw new Error('SecurityError');return get(key); });
        expect(() => readExpressionEdits()).toThrow(/无法读取/);
        expect(() => writeExpressionEdit(address, 'happy', 'curious')).toThrow(/无法读取/);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('disables reads, writes, exports, overrides and events in production even when records exist', () => {
        writeExpressionEdit(address, 'happy', 'curious');
        const edits = readExpressionEdits();
        const activeListener = vi.fn();
        const unsubscribe = subscribeExpressionEdits(activeListener);
        vi.stubEnv('DEV', false);
        vi.stubGlobal('__BUILD_BADGE_VISIBLE__', true);
        storage.getItem.mockClear();
        storage.setItem.mockClear();
        expect(isExpressionReviewAvailable()).toBe(false);
        expect(readExpressionEdits()).toEqual([]);
        expect(expressionOverrides(edits, 'C1-01', 'start', 0, 0)).toEqual({});
        expect(() => writeExpressionEdit(address, 'happy', 'serious')).toThrow(/开发模式/);
        expect(() => resetExpressionEdit(address)).toThrow(/开发模式/);
        expect(() => exportExpressionEdits(edits)).toThrow(/开发模式/);
        const inactiveListener = vi.fn();
        const stopInactive = subscribeExpressionEdits(inactiveListener);
        storageEvent(EXPRESSION_REVIEW_STORAGE_KEY);
        expect(activeListener).not.toHaveBeenCalled();
        expect(inactiveListener).not.toHaveBeenCalled();
        expect(storage.getItem).not.toHaveBeenCalled();
        expect(storage.setItem).not.toHaveBeenCalled();
        unsubscribe();
        stopInactive();
    });
});
