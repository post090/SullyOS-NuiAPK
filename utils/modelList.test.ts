import { describe, expect, it } from 'vitest';
import { extractModelIds, normalizeModelIds } from './modelList';

describe('model list normalization', () => {
    it('keeps strings and common object identifiers without leaking objects into the UI', () => {
        expect(normalizeModelIds([
            'gpt-4.1',
            { id: 'claude-sonnet-4' },
            { model: 'gemini-2.5-pro' },
            { name: 'deepseek-chat' },
            { unexpected: true },
            null,
            7,
            'gpt-4.1',
        ])).toEqual(['gpt-4.1', 'claude-sonnet-4', 'gemini-2.5-pro', 'deepseek-chat']);
    });

    it('accepts OpenAI-compatible and nested gateway response shapes', () => {
        expect(extractModelIds({ data: [{ id: 'gpt-4.1' }] })).toEqual(['gpt-4.1']);
        expect(extractModelIds({ data: { models: [{ model_name: 'nested-model' }] } })).toEqual(['nested-model']);
    });
});
