import type { AivenExpression } from './sarArt';

export const AIVEN_FISH_SALE_REPLIES = [
    { text: '感谢惠顾。', expression: 'happy' },
    { text: '看来今天没空军。', expression: 'interested' },
    { text: '鱼在唱歌。', expression: 'interested' },
    { text: '嗯。', expression: 'normal' },
    { text: '它看起来很开心。你也是。', expression: 'happy' },
] as const satisfies readonly { text: string; expression: AivenExpression }[];

/** The program chooses and saves the reply once, together with the actual payment. */
export interface AivenFishSale { amount: number; at: number; replyIndex: number }
export const validAivenFishSale = (sale: AivenFishSale) => !!sale && Number.isSafeInteger(sale.amount) && sale.amount > 0
    && Number.isFinite(sale.at) && Number.isInteger(sale.replyIndex) && sale.replyIndex >= 0 && sale.replyIndex < AIVEN_FISH_SALE_REPLIES.length;
