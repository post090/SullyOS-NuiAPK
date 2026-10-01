import type { CharacterProfile, VRCardMeta } from '../../types';
import { DB } from '../db';
import { logMarketEvent, mutateFishingMarket, readFishingMarketState, speciesById, type FishingTrip } from './fishingMarket';
import { AIVEN_FISH_SALE_REPLIES } from './fishingSale';

export function fishingTripCard(trip: FishingTrip) {
    const c = trip.catch, result = trip.result!;
    const reply = trip.sale ? AIVEN_FISH_SALE_REPLIES[trip.sale.replyIndex] : undefined;
    const activity = `${c.ownerName}在${c.weatherLabel}的彼方水域钓到${speciesById(c.speciesId)!.name}（${c.sizeCm} cm，${c.quality} 星），${result.disposition === 'release' ? '已放生' : trip.sale ? `已卖给艾文，获得 ${trip.sale.amount} 鳞币` : '已保留'}。`;
    const metadata: VRCardMeta = { vrCard: true, room: 'sar', activity, behavior: result.reaction, marketActivity: true,
        fishing: { catchId: c.id, speciesId: c.speciesId, speciesName: speciesById(c.speciesId)!.name, sizeCm: c.sizeCm, quality: c.quality,
            weatherLabel: c.weatherLabel, weatherSource: c.weatherSource, decision: result.disposition,
            ...(trip.sale && reply ? { sale: { ...trip.sale, reply: reply.text, expression: reply.expression, sellerWords: result.saleWords } } : {}) } };
    const content = ['「彼方 · 水域」', '程序事实：' + activity,
        `天气来源：${c.weatherSource === 'real' ? '同步用户真实天气' : '彼方模拟天气，不代表现实'}。`,
        '角色反应（主观表达）：' + result.reaction,
        ...(trip.sale && reply ? [
            ...(result.saleWords ? ['交鱼时的原话：' + JSON.stringify(result.saleWords)] : []),
            `艾文的成交回应（${reply.expression}）：${JSON.stringify(reply.text)}`,
        ] : []),
        result.shareToUser ? '角色选择另外私聊分享；是否送达以聊天中的实际消息为准。' : '角色没有选择私聊分享。'].join('\n');
    return { activity, metadata, content };
}

let chain: Promise<unknown> = Promise.resolve();
/** Outbox delivery is local DB work only. No extra generation and no replayed fishing actions. */
export function flushFishingDeliveries(characters: CharacterProfile[]): Promise<void> {
    const run = async () => {
        let failed = false;
        const state = readFishingMarketState();
        for (const entry of state.collectionEntries || []) {
            const announcement = entry.announcement;
            if (!announcement || announcement.published) continue;
            const author = characters.find(c => c.id === entry.actorId);
            if (!author) continue;
            const text = `${author.name}首次解锁了水域图鉴「${speciesById(entry.speciesId)!.name}」！`;
            try {
                await DB.appendVRGuestbookMessages([{ id: announcement.id, authorId: 'sar-discovery', authorName: '彼方播报', kind: 'collection-unlock', content: text, createdAt: entry.firstObtainedAt }]);
                await mutateFishingMarket(s => {
                    const next = s.ledger.some(e => e.id === announcement.id) ? s : logMarketEvent(s, '彼方公共留言簿播报：' + text, characters.filter(c => c.vrState?.enabled).map(c => c.id), undefined, entry.firstObtainedAt);
                    if (next !== s) next.ledger[next.ledger.length - 1].id = announcement.id;
                    return { ...next, collectionEntries: next.collectionEntries!.map(e => e.announcement?.id === announcement.id ? { ...e, announcement: { ...e.announcement, published: true } } : e) };
                });
            } catch { failed = true; }
        }
        for (const trip of state.fishingTrips || []) {
            if (trip.status !== 'settled' || !trip.result || !characters.some(c => c.id === trip.catch.ownerId)) continue;
            try {
                if (!trip.cardSent) {
                    const card = fishingTripCard(trip);
                    await DB.saveMessageOnce('fishing_card_' + trip.catch.id, { charId: trip.catch.ownerId, role: 'assistant', type: 'vr_card', content: card.content, metadata: card.metadata });
                    await mutateFishingMarket(s => ({ ...s, fishingTrips: s.fishingTrips!.map(t => t.catch.id === trip.catch.id ? { ...t, cardSent: true } : t) }));
                }
                if (trip.result.shareToUser && !trip.shareSent) {
                    await DB.saveMessageOnce('fishing_share_' + trip.catch.id, { charId: trip.catch.ownerId, role: 'assistant', type: 'text', content: trip.result.shareToUser.text,
                        metadata: { fishingShare: { catchId: trip.catch.id, speciesId: trip.catch.speciesId, disposition: trip.result.disposition } } });
                    await mutateFishingMarket(s => ({ ...s, fishingTrips: s.fishingTrips!.map(t => t.catch.id === trip.catch.id ? { ...t, shareSent: true } : t) }));
                }
            } catch { failed = true; }
        }
        if (failed) throw new Error('鱼获已保存，部分分享或播报待重试');
    };
    const locked = async (): Promise<void> => {
        if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('vr-fishing-deliveries', run);
        else await run();
    };
    const next = chain.then(locked, locked); chain = next.catch(() => {}); return next;
}
