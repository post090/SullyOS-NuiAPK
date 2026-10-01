export type FishingPhase = 'idle' | 'waiting' | 'hooked' | 'caught' | 'escaped';
export interface FishingGameState {
    phase: FishingPhase; held: boolean; elapsed: number; playerAngle: number; playerVelocity: number;
    fishAngle: number; progress: number; difficulty: number; assist: boolean;
    simpleCast?: { castX: number; castY: number; fishX: number; fishY: number; success: boolean; chance: number };
}
export const createFishingGame = (difficulty = .3, assist = false): FishingGameState => ({
    phase: 'idle', held: false, elapsed: 0, playerAngle: -.7, playerVelocity: 0, fishAngle: -.35, progress: .18, difficulty, assist,
});
export const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const fishingArcWidth = (s: FishingGameState) => s.assist ? .92 : .6 - s.difficulty * .15;
/** 归一化水面坐标；鱼影每次会逗留数秒，简单模式不用追光弧。 */
export const simpleFishingShadow = (elapsed: number) => ({
    visible: elapsed % 8 < 5.2,
    x: .5 + .24 * Math.sin(elapsed * .62),
    y: .48 + .1 * Math.sin(elapsed * .9 + .3),
});
export const createSimpleFishingGame = (): FishingGameState => ({ ...createFishingGame(),
    simpleCast: { castX: .5, castY: .5, fishX: .5, fishY: .5, success: false, chance: 0 },
});
export const castSimpleFishingGame = (state: FishingGameState, roll: number, aim?: { x: number; y: number }): FishingGameState => {
    const fish = simpleFishingShadow(state.elapsed);
    const target = aim || { x: fish.x, y: fish.y };
    const distance = Math.hypot(target.x - fish.x, target.y - fish.y);
    const chance = !fish.visible ? .12 : distance <= .24 ? .9 : .25;
    return { ...createSimpleFishingGame(), phase: 'waiting', simpleCast: {
        castX: Math.max(.08, Math.min(.92, target.x)), castY: Math.max(.1, Math.min(.85, target.y)),
        fishX: fish.x, fishY: fish.y, success: roll < chance, chance,
    } };
};
/** Frame-rate independent fixed-step engine. Catch rarity is rolled before the cast, not after a win. */
export const stepFishingGame = (s: FishingGameState, dt: number): void => {
    if (s.simpleCast) {
        s.elapsed += dt;
        if (s.phase === 'waiting' && s.elapsed >= 3.2) { s.phase = 'hooked'; s.elapsed = 0; }
        else if (s.phase === 'hooked' && s.elapsed >= .9) {
            s.phase = s.simpleCast.success ? 'caught' : 'escaped';
            s.progress = s.simpleCast.success ? 1 : 0;
            s.elapsed = 0;
        }
        return;
    }
    if (s.phase !== 'waiting' && s.phase !== 'hooked') return;
    s.elapsed += dt;
    if (s.phase === 'waiting') {
        if (s.elapsed >= 1) { s.phase = 'hooked'; s.elapsed = 0; }
        return;
    }
    const speed = s.assist ? .65 : 1;
    const d = s.difficulty;
    s.playerVelocity += ((s.held ? 1.65 : -1.65) - s.playerVelocity) * Math.min(1, dt * 7);
    s.playerAngle = angleDifference(s.playerAngle + s.playerVelocity * dt * speed, 0);
    s.fishAngle = -.35 + Math.sin(s.elapsed * (.55 + d * .5) * speed) * (1 + d)
        + Math.sin(s.elapsed * (1.1 + d) * speed) * .25;
    const aligned = Math.abs(angleDifference(s.playerAngle, s.fishAngle)) <= fishingArcWidth(s);
    s.progress = Math.max(0, Math.min(1, s.progress + dt * (aligned ? .19 : s.assist ? -.025 : -.08)));
    if (s.progress >= 1) s.phase = 'caught';
    else if (s.elapsed > 32 || (s.elapsed > 5 && s.progress <= 0)) s.phase = 'escaped';
};
