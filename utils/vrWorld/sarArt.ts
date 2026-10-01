import type {SARDialogueSpeaker} from './sarClub';

export const SAR_EXPRESSIONS = {
    caian:['normal','happy','curious','embarrassed','serious','shy','aboutaster','Enduring Pain','avoidant','normal2','warm'],
    aiven:['normal','happy','interested','sad','shy','sleeping'],
} as const;
export type CaianExpression = typeof SAR_EXPRESSIONS.caian[number];
export type AivenExpression = typeof SAR_EXPRESSIONS.aiven[number];
export type SARExpression = CaianExpression | AivenExpression;
export type SARCastExpressions = {caian:CaianExpression;aiven:AivenExpression};
export const SAR_NPC_NAMES = {caian:'凯恩',aiven:'艾文'} as const;

/** Repository-relative paths deliberately use the existing CdnImg mirror chain. */
export function sarPortraitPath(who:SARDialogueSpeaker,expression:string='normal') {
    const allowed:readonly string[]=SAR_EXPRESSIONS[who];
    return `SAR/${who==='caian'?'Caian':'Aiven'}/${allowed.includes(expression)?expression:'normal'}.png`;
}
