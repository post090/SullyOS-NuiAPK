import type { SARCastExpressions, SARExpression } from '../sarArt';

export type FamiliarityNpc = 'caian' | 'aiven';
export type FamiliarityRank = 1 | 2 | 3;
export interface FamiliarityLine {
    speaker: FamiliarityNpc | 'narrator' | 'sully';
    text: string;
    expression?: SARExpression;
    /** Optional authored expressions for the individual sentence pages of this line. */
    sentenceExpressions?: SARExpression[];
    castExpressions?: Partial<SARCastExpressions>;
}
export type FamiliarityReward =
    | { kind: 'module'; title: string; count?: number }
    | { kind: 'coupon'; percent: number; count: number }
    | { kind: 'dinosaur'; speciesId?: string }
    | { kind: 'egg' }
    | { kind: 'title'; title: string }
    | { kind: 'unlock'; feature: 'titles' | 'eggs' | 'abnormal-catch' | 'environment' | 'cross-system' }
    | { kind: 'souvenir'; id: string; title: string; description: string }
    | { kind: 'discount'; percent: number; scope: 'all' | 'random-module'; minutes: number }
    | { kind: 'sully-message'; text: string };
export type FamiliarityEffect = {
    kind: 'admin-card' | 'membership-card' | 'meeting-record' | 'photo-studio' | 'memory-card' | 'confetti' | 'coupon-rain' | 'discount' | 'loot-burst' | 'chimera' | 'notice' | 'mystery-button';
    title?: string;
    text?: string;
    items?: string[];
    /** Effect renderer asks for confirmation before continuing. */
    interactive?: boolean;
};
export interface FamiliarityChoice { label: string; next: string; flags?: Record<string, string | boolean> }
export interface FamiliarityNode {
    lines: FamiliarityLine[];
    choices?: FamiliarityChoice[];
    next?: string;
    effect?: FamiliarityEffect;
    /** Authored line that reveals the prop; defaults to the first line (or an empty-node beat). */
    effectLine?: number;
    /** Collected along the chosen route and applied once on scene completion; replay never grants. */
    rewards?: FamiliarityReward[];
}
export interface FamiliarityScene {
    id: string;
    npc: FamiliarityNpc;
    rank: FamiliarityRank;
    kind: 'topic' | 'event' | 'easter' | 'encounter';
    title: string;
    start: string;
    nodes: Record<string, FamiliarityNode>;
    requires?: string[];
    condition?: 'sully-in-sar';
}
export interface FamiliarityDailyLines {
    time: Record<'morning' | 'noon' | 'evening' | 'night', string[]>;
    weather: Record<'clear' | 'rain' | 'cloudy', string[]>;
    weekday: string[][];
}
