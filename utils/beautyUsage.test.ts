import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ DB: { getAsset: vi.fn(), saveAsset: vi.fn() } }));
import { DB } from './db';
import { BEAUTY_REPO_DELAY, dueBeautyRepo, readBeautyUsage, startBeautyUsage, stopBeautyForThemeChange, stopBeautyUsage, markBeautyRepoPrompt, setBeautyRepoDisabled } from './beautyUsage';
import { validateBeautyRepo } from './beautyShareContract';
import { readBeautyRepoStatus, setBeautyRepoStatus } from './beautyRepoStatus';
const share = { code: 'S-0123456789AB', revision: 'a'.repeat(32), metadata: { name: '月光', credit: '作者' } };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('window', new EventTarget()); });
describe('美化 Repo 使用时间与隐私边界', () => {
  it('当面完成和已提交均停止提醒，取消当面标记可恢复；按作品而非版本记录', async () => {
    vi.mocked(DB.getAsset).mockResolvedValue(JSON.stringify(share));
    await startBeautyUsage('preset', 'appearance');
    const now = Date.now() + BEAUTY_REPO_DELAY * 2;
    setBeautyRepoStatus(share.code, 'manual');
    expect(readBeautyRepoStatus(share.code)).toBe('manual');
    expect(dueBeautyRepo(readBeautyUsage(), now, ['appearance'])).toBeUndefined();
    setBeautyRepoStatus(share.code, null);
    expect(dueBeautyRepo(readBeautyUsage(), now, ['appearance'])?.share.code).toBe(share.code);
    setBeautyRepoStatus(share.code, 'submitted');
    await startBeautyUsage('another-copy', 'chat:a');
    expect(dueBeautyRepo(readBeautyUsage(), now, ['appearance', 'chat:a'])).toBeUndefined();
    expect(DB.saveAsset).not.toHaveBeenCalled();
  });
  it('保存来源不等于已使用，实际应用才开始计时', async () => {
    expect(dueBeautyRepo(readBeautyUsage(), Date.now(), ['appearance'])).toBeUndefined();
    vi.mocked(DB.getAsset).mockResolvedValue(JSON.stringify(share));
    await startBeautyUsage('preset', 'appearance');
    const state = readBeautyUsage(); const start = state.uses[0].startedAt;
    expect(dueBeautyRepo(state, start + BEAUTY_REPO_DELAY, ['appearance'])).toBeUndefined();
    expect(dueBeautyRepo(state, start + BEAUTY_REPO_DELAY + 1, ['appearance'])?.share.code).toBe(share.code);
    expect(dueBeautyRepo(state, start - 100, ['appearance'])).toBeUndefined();
    expect(dueBeautyRepo(state, start + BEAUTY_REPO_DELAY + 1, [])).toBeUndefined();
  });
  it('换成本地无来源的预设后不再提醒上一款', async () => {
    vi.mocked(DB.getAsset).mockResolvedValueOnce(JSON.stringify(share)).mockResolvedValueOnce(null);
    await startBeautyUsage('shared', 'appearance'); await startBeautyUsage('local', 'appearance');
    expect(readBeautyUsage().uses).toEqual([]);
  });
  it('修改外观停止对应计时，普通角色资料和其他目标不受影响', async () => {
    vi.mocked(DB.getAsset).mockResolvedValue(JSON.stringify(share));
    await startBeautyUsage('a', 'appearance'); await startBeautyUsage('b', 'chat:b');
    stopBeautyForThemeChange({ soundVolume: 0.5 }); expect(readBeautyUsage().uses).toHaveLength(2);
    stopBeautyForThemeChange({ wallpaper: 'other' }); expect(readBeautyUsage().uses.map(x => x.target)).toEqual(['chat:b']);
    stopBeautyUsage('chat:*'); expect(readBeautyUsage().uses).toHaveLength(0);
  });
  it('同一作品只提醒一次，关闭开关后不提醒', async () => {
    vi.mocked(DB.getAsset).mockResolvedValue(JSON.stringify(share)); await startBeautyUsage('x', 'appearance');
    markBeautyRepoPrompt(share.code);
    expect(dueBeautyRepo(readBeautyUsage(), Date.now() + BEAUTY_REPO_DELAY * 3, ['appearance'])).toBeUndefined();
    setBeautyRepoDisabled(true); expect(readBeautyUsage().disabled).toBe(true);
  });
  it('Repo 要求明确同意与非空署名文字，只收取允许字段', () => {
    const input = { code: share.code, revision: share.revision, deviceId: 'b'.repeat(32), requestId: 'c'.repeat(32), signature: '读者', message: '谢谢作者', consent: true, chats: ['不应上传'], character: '不应上传' };
    expect(validateBeautyRepo(input)).not.toHaveProperty('chats');
    for (const patch of [{ consent: false }, { signature: ' ' }, { message: '' }, { message: 'x'.repeat(1201) }, { code: 'bad' }]) expect(() => validateBeautyRepo({ ...input, ...patch })).toThrow();
  });
});

it('tracks app skins independently and stops only the skin whose settings changed',async()=>{
 vi.mocked(DB.getAsset).mockResolvedValue(JSON.stringify(share));
 await startBeautyUsage('schedule','appearance:schedule');await startBeautyUsage('journal','appearance:journal');
 stopBeautyForThemeChange({scheduleCardAppearance:{preset:'original'}});
 expect(readBeautyUsage().uses.map(item=>item.target)).toEqual(['appearance:journal']);
 expect(dueBeautyRepo(readBeautyUsage(),Date.now()+BEAUTY_REPO_DELAY+10,['appearance:journal'])?.share.code).toBe(share.code);
 stopBeautyForThemeChange({journalAppearance:undefined});expect(readBeautyUsage().uses).toEqual([]);
});
