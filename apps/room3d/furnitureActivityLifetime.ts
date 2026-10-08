// These activities end through an explicit stop or a schedule/interaction transition,
// rather than when a short animation cycle finishes.
export function isSustainedFurnitureActivity(kind?: string): boolean {
 return kind === 'stream' || kind === 'computer';
}

// Work phase only: walking, sitting down and putting items back retain their own timing.
const workSeconds: Record<string, number> = {
 race: 30, rhythm: 30, eat: 25,
 cook: 30, wash: 20, coffee: 20,
 'bath-shower': 25, 'bath-soak': 30, 'bath-laundry': 20, 'bath-toilet': 20,
};
export function furnitureActivitySeconds(kind: string, fallback = 12): number {
 return workSeconds[kind] ?? fallback;
}
