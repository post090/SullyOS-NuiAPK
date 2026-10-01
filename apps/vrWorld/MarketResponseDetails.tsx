import React, { useState } from 'react';

export function MarketResponseDetails({ text }: { text: string }) {
    const [notice, setNotice] = useState('');
    return <details className="mt-2 w-full min-w-0 text-xs">
        <summary className="cursor-pointer py-2">本次返回（模型原文）</summary>
        <textarea aria-label="本次返回" readOnly value={text} className="mt-2 w-full min-h-48 rounded-lg border border-current/20 bg-transparent p-3 font-mono text-xs" />
        <button className="mt-2 underline underline-offset-4" onClick={async () => {
            try { await navigator.clipboard.writeText(text); setNotice('已复制'); }
            catch { setNotice('复制失败，请在文本框内长按或全选复制'); }
        }}>复制本次返回</button>
        <span className="ml-2" role="status">{notice}</span>
    </details>;
}
