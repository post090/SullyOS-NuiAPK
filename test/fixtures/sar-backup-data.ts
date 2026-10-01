import { DB } from '../../utils/db';
import { putImageBlob, dataUrlToBlob, getBlobForRef } from '../../utils/blobRef';
import { collectSARLocalBackup } from '../../utils/vrWorld/sarBackup';
import { createFishingMarketState, ensureActorAccounts, saveFishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { ensureDinosaurGarden, editDino, gardenResidents } from '../../utils/vrWorld/dinosaurGarden';
import { freshFamiliarity } from '../../utils/vrWorld/sarFamiliarity/storageTypes';
import { ensureSARCommerce, drawSARModuleWithPayment } from '../../utils/vrWorld/sarCommerce';
import { loadChatInputPreferences, saveChatInputPreferences } from '../../utils/chatInputPreferences';
import { ANNIVERSARY_SEEN_KEY, ANNIVERSARY_WALLPAPERS, createAnniversaryTheme } from '../../utils/anniversaryGifts';
import { SAR_UPDATE_KEY } from '../../utils/sarUpdate';
import { SAR_MODULE_CATALOG } from '../../utils/vrWorld/sarModuleShop';
import { installSARModuleOnCharacter } from '../../utils/vrWorld/sarModuleRuntime';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWWQAAAAASUVORK5CYII=';
export async function seedSARBackup(os: any) {
    const at = 1790000000000;
    const photo = await putImageBlob(dataUrlToBlob(png));
    const runtime = installSARModuleOnCharacter(SAR_MODULE_CATALOG[0], at);
    const theme = createAnniversaryTheme({ id:'qa-base', name:'QA', ai:{}, user:{} } as any, 'qa-sar-backup');
    const char = { ...os.characters[0], id:'qa-sar-backup', name:'备份测试角色', chatBackground:ANNIVERSARY_WALLPAPERS[1].url, bubbleStyle:theme.id,
        vrState:{ enabled:false, currentRoom:'sar', sarActivity:'garden', title:'测试称号', sarModule:runtime } };
    await DB.saveCharacter(char);
    await DB.saveTheme(theme);
    await DB.saveUserProfile({ ...os.userProfile, name:'备份测试用户', vrState:{ enabled:false, currentRoom:'sar', title:'测试称号', sarModule:runtime } });
    await os.updateTheme({ wallpaper:ANNIVERSARY_WALLPAPERS[0].url });
    await DB.saveMessage({ charId:char.id, role:'assistant', type:'text', content:'真意', timestamp:at, metadata:{ sarModuleSurface:{ moduleId:runtime.moduleId, moduleTitle:runtime.moduleTitle, surface:'表面说法', trueText:'真意' } } } as any);
    const actor = { id:'user', name:'我', kind:'user' as const };
    let market = ensureDinosaurGarden(ensureActorAccounts(createFishingMarketState(42),[actor]),actor,at);
    market = editDino(market,actor,gardenResidents(market)[0].catchId,{paint:{body:'#112233',accent:'#ddccaa'}});
    market.sarFamiliarity = freshFamiliarity();
    market.sarFamiliarity.npcs.caian = { stars:1, completed:{'C1-01':{at,flags:{answer:'保留'}}}, day:'2026-09-11', offerId:'C1-02', queuedSceneIds:['qa-pending'],
        pending:{runId:'qa-run',sceneId:'C1-02',nodeId:'start',line:1,revision:2,startedAt:at,flags:{},drafts:{qa:{text:'未完成草稿'}},userName:'备份测试用户'} };
    market.sarFamiliarity.applied = ['qa-reward'];
    market.sarFamiliarity.souvenirs = [{id:'qa-photo',title:'测试照片',description:'测试纪念',npc:'caian',sceneId:'C1-01',nodeId:'finish',at,userName:'我',flags:{},draft:{photo,legacyPhoto:png}}];
    saveFishingMarketState(market);
    await ensureSARCommerce();
    await drawSARModuleWithPayment('story',{requestId:'qa-draw',maxCost:0,now:new Date(at),random:()=>0.2});
    localStorage.setItem('vr_sar_club_state_v1',JSON.stringify({version:1,updateSeenVersion:1,npcPreference:'hide',caianMet:true,roomView:'characters-hidden'}));
    localStorage.setItem('vr_sar_simulations_v1',JSON.stringify({version:1,records:[{id:'qa-story',story:'已保存推演',draft:'输入草稿',photo}]}));
    localStorage.setItem('vr_fishing_simple_mode','true');
    localStorage.setItem('vr_sar_session_theme_v1','light');
    localStorage.setItem('sar-garden-guide-v1','done');
    localStorage.setItem(ANNIVERSARY_SEEN_KEY,'1');
    localStorage.setItem(SAR_UPDATE_KEY,'1');
    saveChatInputPreferences({sendButtonGenerates:true,enterToSend:false,autoReply:true,emojiSuggestions:true});
}
export async function readSARBackup() {
    const sar = collectSARLocalBackup();
    const draft = (sar.fishingMarket as any)?.sarFamiliarity?.souvenirs[0]?.draft;
    const imageBytes = async (value: string) => {
        const blob = value?.startsWith('blobref:') ? await getBlobForRef(value) : value?.startsWith('data:') ? dataUrlToBlob(value) : null;
        return blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null;
    };
    return {
        sar, input:loadChatInputPreferences(), char:(await DB.getAllCharacters()).find(c=>c.id==='qa-sar-backup'),
        user:await DB.getUserProfile(), themes:(await DB.getThemes()).filter(t=>t.id==='anniversary-frame-qa-sar-backup'),
        messages:await DB.getRecentMessagesByCharId('qa-sar-backup',20),
        flags:{anniversary:localStorage.getItem(ANNIVERSARY_SEEN_KEY),release:localStorage.getItem(SAR_UPDATE_KEY)},
        photoBytes:await imageBytes(draft?.photo), legacyBytes:await imageBytes(draft?.legacyPhoto),
    };
}
