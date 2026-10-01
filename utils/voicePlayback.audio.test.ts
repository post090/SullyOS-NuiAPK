import { describe, expect, it, vi } from 'vitest';
import { canAnalyzeVoiceSource, isVoiceAudioPriming, playVoiceAudio, primeVoiceAudio, stopVoiceAudio, voicePlaybackErrorMessage } from './voicePlayback';

function media() {
    const audio = {
        src: '', paused: true, error: null,
        onended: null as (() => void) | null, onpause: null as (() => void) | null, onerror: null as (() => void) | null,
        play: vi.fn(async () => { audio.paused = false; }),
        pause: vi.fn(() => { audio.paused = true; audio.onpause?.(); }),
        removeAttribute: vi.fn(() => { audio.src = ''; }), load: vi.fn(),
    };
    return audio as unknown as HTMLAudioElement;
}
const callbacks = () => ({ onPlaying: vi.fn(), onStopped: vi.fn(), onError: vi.fn() });

describe('voice playback recovery', () => {
    it('unlocks synchronously and does not let a late prime pause the real voice', async () => {
        const audio = media();
        let finishPrime!: () => void;
        vi.mocked(audio.play).mockImplementationOnce(() => new Promise(resolve => { finishPrime = resolve; }));
        primeVoiceAudio(audio);
        expect(audio.play).toHaveBeenCalledTimes(1);
        expect(isVoiceAudioPriming(audio)).toBe(true);
        const events = callbacks();
        await playVoiceAudio(audio, 'blob:voice', events);
        finishPrime();
        await Promise.resolve();
        expect(audio.pause).not.toHaveBeenCalled();
        expect(audio.src).toBe('blob:voice');
        expect(events.onPlaying).toHaveBeenCalledTimes(1);
    });
    it('does not treat a changed native call source as priming', () => {
        const audio = media();
        primeVoiceAudio(audio);
        audio.src = 'blob:call';
        expect(isVoiceAudioPriming(audio)).toBe(false);
    });
    it('keeps rejected autoplay out of the playing state and allows playback-only retry', async () => {
        const audio = media();
        const error = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
        vi.mocked(audio.play).mockRejectedValueOnce(error);
        const events = callbacks();
        await playVoiceAudio(audio, 'blob:voice', events);
        expect(events.onPlaying).not.toHaveBeenCalled();
        expect(events.onError).toHaveBeenCalledWith(error);
        expect(voicePlaybackErrorMessage(error)).toContain('无需重新生成');
        await playVoiceAudio(audio, 'blob:voice', events);
        expect(events.onPlaying).toHaveBeenCalledTimes(1);
    });
    it('ignores failures from superseded play attempts and stops pending playback on cleanup', async () => {
        const audio = media();
        let rejectOld!: (error: Error) => void;
        vi.mocked(audio.play).mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
        const old = callbacks();
        const pending = playVoiceAudio(audio, 'blob:old', old);
        const current = callbacks();
        await playVoiceAudio(audio, 'blob:new', current);
        rejectOld(new Error('interrupted'));
        await pending;
        expect(old.onError).not.toHaveBeenCalled();
        expect(old.onStopped).not.toHaveBeenCalled();
        stopVoiceAudio(audio);
        expect(audio.paused).toBe(true);
        expect(audio.onerror).toBeNull();
    });
    it('reports media loading errors once even when play also rejects', async () => {
        const audio = media();
        vi.mocked(audio.play).mockImplementationOnce(async () => {
            (audio.onerror as Function)?.();
            throw new Error('load failed');
        });
        const events = callbacks();
        await playVoiceAudio(audio, 'https://audio.example.com/expired', events);
        expect(events.onError).toHaveBeenCalledTimes(1);
        expect(events.onPlaying).not.toHaveBeenCalled();
        expect(voicePlaybackErrorMessage(new Error('load failed'))).toContain('音频加载或播放失败');
    });
    it('reserves WebAudio for local audio; cross-origin fallbacks use native playback', () => {
        expect(canAnalyzeVoiceSource('https://audio.example.com/x', 'https://friedsully.com')).toBe(false);
        expect(canAnalyzeVoiceSource('blob:https://friedsully.com/x')).toBe(true);
        expect(canAnalyzeVoiceSource('data:audio/wav;base64,AAA')).toBe(true);
        expect(canAnalyzeVoiceSource('/saved.mp3', 'https://friedsully.com')).toBe(true);
    });
});
