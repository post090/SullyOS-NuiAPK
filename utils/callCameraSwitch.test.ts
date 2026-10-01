import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual handler without mounting the call's audio/AI providers.
const source = readFileSync('apps/CallApp.tsx', 'utf8');
const handler = source.slice(source.indexOf('  const startUserCamera ='), source.indexOf('  const chooseFakeUserCameraImage ='));
function fixture(getUserMedia: any) {
    const old = { getTracks: () => [{ stop: vi.fn() }] };
    const stop = vi.fn(); old.getTracks = () => [{ stop }];
    const state: any = {
        userCameraLoading: false, userCameraFacing: 'user', navigator: { mediaDevices: { getUserMedia } },
        userCameraRequestRef: { current: 0 }, userCameraStreamRef: { current: old },
        userCameraVideoRef: { current: { srcObject: old } }, setUserCameraLoading: vi.fn(),
        clearDetectedUserEmotion: vi.fn(), setUserCameraFacing: vi.fn(), setUserCameraMode: vi.fn(),
        setShowUserCameraModePicker: vi.fn(), preloadUserCameraEmotionDetector: async () => {},
        releaseUserCameraEmotionDetector: vi.fn(), addToast: vi.fn(), stopUserCamera: vi.fn(),
    };
    const js = ts.transpile(handler + '\nreturn startUserCamera;', { target: ts.ScriptTarget.ES2022 });
    return { state, stop, run: new Function(...Object.keys(state), js)(...Object.values(state)) };
}
const stream = () => {
    const track = { stop: vi.fn(), getSettings: () => ({ facingMode: 'environment' }), addEventListener: vi.fn() };
    return { active: true, getTracks: () => [track], getVideoTracks: () => [track], track };
};
it('releases the old lens before opening the rear lens and preserves snapshot mode', async () => {
    const next = stream();
    const f = fixture(vi.fn(async () => { expect(f.stop).toHaveBeenCalledOnce(); return next; }));
    await f.run('snapshot', 'environment');
    expect(f.state.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }));
    expect(f.state.setUserCameraFacing).toHaveBeenCalledWith('environment');
    expect(f.state.setUserCameraMode).toHaveBeenCalledWith('snapshot');
    expect(f.state.userCameraStreamRef.current).toBe(next);
});
it('stops a late stream after the call has invalidated its request', async () => {
    let finish: any;
    const f = fixture(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.run('emotion', 'environment');
    f.state.userCameraRequestRef.current++;
    const next = stream(); finish(next); await pending;
    expect(next.track.stop).toHaveBeenCalledOnce();
    expect(f.state.setUserCameraMode).not.toHaveBeenCalled();
});
it('a stale rejection cannot shut down a newer camera', async () => {
    let reject: any;
    const f = fixture(() => new Promise((_, fail) => { reject = fail; }));
    const pending = f.run('snapshot', 'environment');
    f.state.userCameraRequestRef.current++; reject(Error('late')); await pending;
    expect(f.state.stopUserCamera).not.toHaveBeenCalled();
    expect(f.state.addToast).not.toHaveBeenCalled();
});
