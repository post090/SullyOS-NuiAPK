import type { CharacterProfile, VRRoomId, VRSARActivity } from '../../types';

/** Only executable activities belong here; user-only collections/NPC stories are not destinations. */
export const ORDINARY_ACTIVITIES: { id: VRRoomId; name: string; description: string }[] = [
    { id:'library', name:'图书馆', description:'读书、留下批注' },
    { id:'theater', name:'剧院', description:'即兴写剧本投稿' },
    { id:'music', name:'听歌房', description:'点歌、听歌与锐评' },
    { id:'guestbook', name:'留言簿', description:'发帖、回复和版聊' },
    { id:'gym', name:'娱乐室', description:'游戏、学习或随意玩耍' },
    { id:'postoffice', name:'邮局', description:'写信、读信与回信' },
];
export const SAR_ACTIVITIES: { id: VRSARActivity; name: string; description: string }[] = [
    { id:'cabinet', name:'抽芯片演绎', description:'抽临时芯片，推演故事并写随笔' },
    { id:'module-shop', name:'模块商店', description:'研究、购买或装载模块' },
    { id:'fishing', name:'水域钓鱼', description:'钓一竿，决定鱼获去留' },
    { id:'market', name:'布告板', description:'看行情、交易、发需求或留言' },
    { id:'garden', name:'恐龙箱庭', description:'摆弄庭院、续写小剧场与留便签' },
];

export function sarActivityPool(char: Pick<CharacterProfile,'vrState'>, gardenAvailable: boolean, manual = false): { id: VRSARActivity; weight: number }[] {
    if (!manual && char.vrState?.excludedAutoRooms?.includes('sar')) return [];
    // Preserve existing probabilities before filtering: garden's 20% replaces part of the shop's 21%.
    const pool: { id: VRSARActivity; weight: number }[] = [
        {id:'fishing',weight:30}, {id:'market',weight:20},
        ...(gardenAvailable ? [{id:'garden' as const,weight:20}] : []),
        {id:'module-shop',weight:gardenAvailable ? 1 : 21}, {id:'cabinet',weight:29},
    ];
    const excluded = manual ? [] : char.vrState?.excludedAutoSARActivities || [];
    return pool.filter(a => !excluded.includes(a.id));
}

export function rollSARActivity(char: Pick<CharacterProfile,'vrState'>, gardenAvailable: boolean, manual = false, forced?: VRSARActivity, random:()=>number = Math.random): VRSARActivity | null {
    // A manual invitation still goes through the selected activity's real preconditions at execution time.
    if (manual && forced) return SAR_ACTIVITIES.some(a=>a.id===forced) ? forced : null;
    const pool = sarActivityPool(char,gardenAvailable,manual);
    if (forced) return pool.some(a=>a.id===forced) ? forced : null;
    if (!pool.length) return null;
    const n = Number(random());
    let cursor = (Number.isFinite(n) ? Math.max(0,Math.min(.999999999,n)) : 0) * pool.reduce((sum,a)=>sum+a.weight,0);
    for (const item of pool) { cursor -= item.weight; if (cursor < 0) return item.id; }
    return pool.at(-1)!.id;
}
