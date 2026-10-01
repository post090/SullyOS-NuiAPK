/** Presentation-only recovery. Never completes a truncated object or invents actions/amounts. */
export function parseMarketReplyJson(raw: string): unknown {
    const text = raw.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('缺少完整 JSON 对象');
    const source = text.slice(start, end + 1);
    let normalized = '', quoted = false, escaped = false;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quoted) {
            if (escaped) { normalized += char; escaped = false; continue; }
            if (char === '\\') { normalized += char; escaped = true; continue; }
            if (char === '"') quoted = false;
            normalized += char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : char;
        } else {
            if (char === '"') quoted = true;
            if (char === ',' && /^[\s]*[}\]]/.test(source.slice(i + 1))) continue;
            normalized += char;
        }
    }
    return JSON.parse(normalized);
}
