import type { MemoryNode } from './types';
import { addLocalDays, parseLocalDateKey } from '../localDate';

/** Strict opt-in. Missing, malformed and old config all preserve the original text. */
export function relativeTimeEnabled(): boolean {
    try { return JSON.parse(localStorage.getItem('os_memory_palace_config') || '{}').relativeTimeAnnotations === true; }
    catch { return false; }
}

const numberPattern = '[0-9零〇一二两三四五六七八九十百千]+';
const expressionPattern = `昨天|昨晚|前天|今天|明天|后天|上周|上个月|去年|${numberPattern}天前|${numberPattern}个月前`;
export interface RelativeTimeAnnotation { start: number; end: number; expression: string; label: string }

function readNumber(text: string): number | null {
    if (/^\d+$/.test(text)) return Number(text);
    const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (!/[十百千]/.test(text)) return Number([...text].map(c => digits[c]).join(''));
    let result = 0, current = 0, previousUnit = Infinity;
    for (const c of text) {
        if (c in digits) { current = digits[c]; continue; }
        const unit = ({ 十: 10, 百: 100, 千: 1000 } as Record<string, number>)[c];
        if (!unit || unit >= previousUnit) return null;
        result += (current || 1) * unit;
        previousUnit = unit;
        current = 0;
    }
    return result + current;
}

function expressions(content: string) {
    // Do not match suffixes of unsupported expressions, or annotate text already dated by the user.
    return [...content.matchAll(new RegExp(expressionPattern, 'g'))].filter(match => {
        const before = content[match.index! - 1] || '';
        const after = content.slice(match.index! + match[0].length);
        if (/[\d零〇一二两三四五六七八九十百千万点.]/.test(before)) return false;
        if (before === '大' && /^(前天|后天)$/.test(match[0])) return false;
        if (match[0] === '上周' && /^[一二三四五六日天末]/.test(after)) return false;
        if (/^\s*[（(〔【]\s*(?:\d{4}年|\d{1,2}[月./-])/.test(after)) return false;
        return true;
    });
}

export function hasRelativeTime(content: string): boolean { return expressions(content).length > 0; }

/** Disabled edits do not create or alter any date relationship. */
export function relativeTimeEdit(node: MemoryNode, content: string, enabled: boolean): Partial<MemoryNode> {
    if (!enabled || node.archived || node.isBoxSummary) return {};
    if (!hasRelativeTime(content)) return { relativeTimeAnchor: undefined };
    return {}; // Preserve the original source; editing cannot manufacture or move its date.
}

/** Fail closed when the model rewrites relative wording instead of retaining its source. */
export function hasMatchingRelativeSource(content: string, source: string): boolean {
    const matches = expressions(content);
    return matches.length > 0 && matches.every(match => source.includes(match[0]));
}

function chineseDate(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    return `${y}年${m}月${d}日`;
}

export function relativeTimeAnnotations(node: MemoryNode, enabled: boolean): RelativeTimeAnnotation[] {
    if (!enabled || node.archived || node.isBoxSummary || !node.relativeTimeAnchor) return [];
    const key = node.relativeTimeAnchor.dateKey;
    const anchor = parseLocalDateKey(key);
    if (!anchor) return [];
    const dayOffsets: Record<string, number> = { 昨天: -1, 昨晚: -1, 前天: -2, 今天: 0, 明天: 1, 后天: 2, 上周: -7 };
    return expressions(node.content).flatMap(match => {
        const expression = match[0];
        let label: string;
        if (expression in dayOffsets) {
            label = chineseDate(addLocalDays(key, dayOffsets[expression])) + (expression === '上周' ? '前后' : '');
        } else if (expression === '去年') {
            label = `${anchor.getFullYear() - 1}年`;
        } else {
            const months = expression === '上个月' || expression.endsWith('个月前');
            const amount = expression === '上个月' ? 1 : readNumber(expression.replace(months ? /个月前$/ : /天前$/, ''));
            if (amount === null || !Number.isSafeInteger(amount) || amount < 0 || amount > 9999) return [];
            if (months) {
                // Month precision only; avoid March 31 -> March 3 rollover when subtracting February.
                const date = new Date(anchor.getFullYear(), anchor.getMonth() - amount, 1);
                if (date.getFullYear() < 1) return [];
                label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            } else label = chineseDate(addLocalDays(key, -amount));
        }
        return [{ start: match.index!, end: match.index! + expression.length, expression, label }];
    });
}

export function memoryContentWithDates(node: MemoryNode, enabled = relativeTimeEnabled()): string {
    const annotations = relativeTimeAnnotations(node, enabled);
    let content = node.content;
    for (const annotation of annotations.reverse()) {
        content = content.slice(0, annotation.end) + `〔${annotation.label}〕` + content.slice(annotation.end);
    }
    return content;
}
