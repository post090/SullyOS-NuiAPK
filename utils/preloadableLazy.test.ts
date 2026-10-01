import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createPreloadableLazy } from '../components/os/preloadableLazy';
import { isChunkLoadError } from './chunkLoadRecovery';

const TestComponent: React.FC = () => null;

describe('createPreloadableLazy', () => {
  it('deduplicates concurrent preload requests', async () => {
    let resolve!: (module: { default: React.ComponentType<any> }) => void;
    const factory = vi.fn(() => new Promise<{ default: React.ComponentType<any> }>(done => {
      resolve = done;
    }));
    const Component = createPreloadableLazy(factory);

    const first = Component.preload();
    const second = Component.preload();

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);

    resolve({ default: TestComponent });
    await first;
    await expect(Component.preload()).resolves.toEqual({ default: TestComponent });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('retries after a speculative preload failure', async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValueOnce({ default: TestComponent });
    const Component = createPreloadableLazy(factory);

    await expect(Component.preload()).rejects.toThrow('temporary chunk failure');
    await expect(Component.preload()).resolves.toEqual({ default: TestComponent });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('marks a rejected module parse error before consumers see it, preserving the original stack', async () => {
    const error = new SyntaxError('Unexpected EOF');
    const stack = error.stack;
    const factory = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ default: TestComponent });
    const Component = createPreloadableLazy(factory);
    const caught = await Component.preload().catch(failure => failure);
    expect(caught).toBe(error);
    if (!(caught instanceof Error)) throw new Error('Expected the original module loading error');
    expect(caught.stack).toBe(stack);
    expect(isChunkLoadError(caught)).toBe(true);
    await expect(Component.preload()).resolves.toEqual({ default: TestComponent });
  });

  it('does not mark errors thrown by a successfully loaded component while rendering', async () => {
    const error = new SyntaxError('Unexpected EOF');
    const BrokenComponent = () => { throw error; };
    const Component = createPreloadableLazy(async () => ({ default: BrokenComponent }));
    await Component.preload();
    expect(() => BrokenComponent()).toThrow(error);
    expect(isChunkLoadError(error)).toBe(false);
  });
});
