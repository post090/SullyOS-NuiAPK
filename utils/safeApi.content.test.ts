import { describe, expect, it } from 'vitest';
import { extractContent } from './safeApi';

describe('extractContent structured responses', () => {
    it('reads string content', () => {
        expect(extractContent({ choices: [{ message: { content: ' hello ' } }] })).toBe('hello');
    });

    it('joins OpenAI-style structured text parts', () => {
        expect(extractContent({ choices: [{ message: { content: [
            { type: 'text', text: '你' },
            { type: 'text', text: '好' },
        ] } }] })).toBe('你好');
    });

    it('accepts object content without calling string methods on the object', () => {
        expect(extractContent({ choices: [{ message: { content: { text: 'pong' } } }] })).toBe('pong');
    });
});
