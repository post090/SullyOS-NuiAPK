import React from 'react';
import type { MemoryNode } from '../utils/memoryPalace/types';
import { relativeTimeAnnotations } from '../utils/memoryPalace/relativeTime';

/** Generated dates are distinct read-only spans, never editable source text. */
export function MemoryTimeText({ node, enabled, maxLength }: { node: MemoryNode; enabled: boolean; maxLength?: number }) {
    const content = maxLength && node.content.length > maxLength ? node.content.slice(0, maxLength) + '...' : node.content;
    const annotations = relativeTimeAnnotations(node, enabled).filter(a => !maxLength || a.end <= maxLength);
    if (!annotations.length) return <>{content}</>;
    const parts: React.ReactNode[] = [];
    let offset = 0;
    for (const annotation of annotations) {
        parts.push(content.slice(offset, annotation.end));
        parts.push(<span key={annotation.end} title={`系统补注 · 参照日 ${node.relativeTimeAnchor!.dateKey} · 修改相对措辞可调整日期`}
            style={{ color: '#7c3aed', backgroundColor: '#7c3aed0d', borderRadius: 3 }}>
            〔{annotation.label}〕
        </span>);
        offset = annotation.end;
    }
    parts.push(content.slice(offset));
    return <>{parts}</>;
}
