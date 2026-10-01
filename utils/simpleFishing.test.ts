import { expect, it } from 'vitest';
import { castSimpleFishingGame, createSimpleFishingGame, simpleFishingShadow, stepFishingGame } from './vrWorld/fishingGame';
it('鱼影有停留与游走的间歇，坐标留在水面内', () => {
    expect(simpleFishingShadow(0).visible).toBe(true);
    expect(simpleFishingShadow(6).visible).toBe(false);
    expect(simpleFishingShadow(8).visible).toBe(true);
    for (let t = 0; t < 80; t += .1) {
        const shadow = simpleFishingShadow(t);
        expect(shadow.x).toBeGreaterThan(.2); expect(shadow.x).toBeLessThan(.8);
        expect(shadow.y).toBeGreaterThan(.3); expect(shadow.y).toBeLessThan(.7);
    }
});
it('鱼影附近宽容判定，离得远或看不到时仍可能空军', () => {
    const idle = createSimpleFishingGame(), shadow = simpleFishingShadow(0);
    expect(castSimpleFishingGame(idle, .85, { x: shadow.x + .2, y: shadow.y }).simpleCast?.success).toBe(true);
    expect(castSimpleFishingGame(idle, .95).simpleCast?.success).toBe(false);
    expect(castSimpleFishingGame(idle, .5, { x: 0, y: 0 }).simpleCast?.success).toBe(false);
    idle.elapsed = 6;
    expect(castSimpleFishingGame(idle, .5).simpleCast?.success).toBe(false);
});
it.each([30, 60, 120])('%s fps 都先抛竿等待，再收线结算', fps => {
    const state = castSimpleFishingGame(createSimpleFishingGame(), .1);
    for (let i = 0; i < fps * 2; i++) stepFishingGame(state, 1 / fps);
    expect(state.phase).toBe('waiting');
    for (let i = 0; i < fps * 1.5; i++) stepFishingGame(state, 1 / fps);
    expect(state.phase).toBe('hooked');
    for (let i = 0; i < fps; i++) stepFishingGame(state, 1 / fps);
    expect(state.phase).toBe('caught');
});
