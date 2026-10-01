/** Shared, integer-only game-currency rules. Existing balances are never reduced on migration. */
export const SAR_STARTING_BALANCE = 120;
export const SAR_WANDERER_BALANCE = 120;
export const SAR_DAILY_BUYBACK = 180;
export const SAR_WALLET_LIMIT = 999_999;
export const SAR_CHARACTER_DAILY_SPEND = 60;
export const SAR_CHARACTER_RESERVE = 30;
export const SAR_ECONOMY_VERSION = 2;
export const sarEconomyDay = (at = Date.now()) => {
    const date = new Date(at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export type SARBuybackBudget = { day: string; earned: number };
export const remainingSARBuyback = (budgets: Record<string, SARBuybackBudget> | undefined, actorId: string, at = Date.now()) => {
    const budget = budgets?.[actorId];
    if (!budget) return SAR_DAILY_BUYBACK;
    if (!Number.isSafeInteger(budget.earned) || budget.earned < 0 || typeof budget.day !== 'string') throw new Error('回收额度存档异常，请先备份');
    // Moving the device clock backwards must not replenish today's allowance.
    return budget.day >= sarEconomyDay(at) ? Math.max(0, SAR_DAILY_BUYBACK - budget.earned) : SAR_DAILY_BUYBACK;
};
export const creditSARWallet = (balance: number, amount: number) => {
    if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(amount) || amount < 0) throw new Error('钱包金额异常，请先备份');
    if (amount === 0) return balance;
    if (balance + amount > SAR_WALLET_LIMIT) throw new Error(`钱包最多可存 ${SAR_WALLET_LIMIT.toLocaleString()} 鳞币，请先花一些再收款`);
    return balance + amount;
};
