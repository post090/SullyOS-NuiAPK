import React from 'react';
import type { MemoryNode } from '../utils/memoryPalace/types';
import { MemoryTimeText } from './MemoryTimeText';

export function MemoryContentEditor({ node, value, onChange, enabled, className }: {
    node: MemoryNode; value: string; onChange: (value: string) => void; enabled: boolean; className?: string;
}) {
    const showDates = enabled && !node.archived && !node.isBoxSummary;
    return <>
        <textarea aria-label="记忆原文" value={value} onChange={e => onChange(e.target.value)} className={className}
            style={{ minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} />
        {showDates && <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7 }}>
            <div style={{ color: '#6b7280' }}>
                {node.relativeTimeAnchor
                    ? '系统补注日期不可直接修改。请修改上方原文中的“昨天”“前天”等措辞，日期会自动更新；改写为具体日期后，不再生成补注。'
                    : '这条记忆缺少可靠的原消息日期，暂不补注。你可以在原文中直接写出具体日期。'}
            </div>
            {node.relativeTimeAnchor && <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: '#f5f3ff' }}>
                <div style={{ color: '#7c3aed', fontWeight: 600, marginBottom: 6 }}>补注预览 · 只读</div>
                <div aria-label="时间补注预览" aria-live="polite" style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>
                    <MemoryTimeText enabled node={{ ...node, content: value }} />
                </div>
                <div style={{ color: '#6b7280', marginTop: 6, fontSize: 11 }}>固定参照日：{node.relativeTimeAnchor.dateKey}（原消息日期）</div>
            </div>}
        </div>}
    </>;
}
