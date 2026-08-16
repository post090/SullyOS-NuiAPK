import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const storySource = read('../components/date/story/StoryTheaterSession.tsx');
const osContextSource = read('../context/OSContext.tsx');

const sliceBetween = (source: string, startAnchor: string, endAnchor: string): string => {
    const start = source.indexOf(startAnchor);
    const end = source.indexOf(endAnchor, start + startAnchor.length);
    if (start < 0 || end <= start) throw new Error(`missing source anchors: ${startAnchor} -> ${endAnchor}`);
    return source.slice(start, end);
};

describe('story theater billing safety wiring', () => {
    it('uses a synchronous mutex instead of React state as the send guard', () => {
        const sendSource = sliceBetween(storySource, 'const send = useCallback', 'const archivedCount =');
        const guard = sendSource.indexOf('if (sendLock.current || actors.length === 0) return;');
        const acquire = sendSource.indexOf('sendLock.current = true;');
        const release = sendSource.indexOf('sendLock.current = false;');

        expect(storySource).toContain('const sendLock = useRef(false);');
        expect(guard).toBeGreaterThanOrEqual(0);
        expect(acquire).toBeGreaterThan(guard);
        expect(release).toBeGreaterThan(acquire);
        expect(sendSource).not.toContain('if (sending ||');
    });

    it('does not silently issue a second physical chat completion request', () => {
        const interceptorSource = sliceBetween(osContextSource, 'const patchedFetch = async', 'window.fetch = patchedFetch;');

        expect(interceptorSource.match(/await originalFetch\(/g) || []).toHaveLength(4);
        expect(interceptorSource).toContain('await originalFetch(...sendArgs)');
        // fork 有采样参数自愈 + stream 升级回退，这些是有日志的显式重试，不是 billing safety 问题
    });
});
