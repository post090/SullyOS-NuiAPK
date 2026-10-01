import { describe, expect, it } from 'vitest';
import { familiarityGreeting } from './vrWorld/sarFamiliarity/state';
import { AIVEN_DAILY } from './vrWorld/sarFamiliarity/aiven';
import { createFishingMarketState } from './vrWorld/fishingMarket';

describe('Aiven daily greeting order', () => {
    it.each([0,1,2,3,4,5,6])('opens with the correct local weekday pool: %i', weekday => {
        const now=new Date(2026,8,13+weekday,12).getTime();
        const market=createFishingMarketState(42);
        const lines=familiarityGreeting('aiven',market,now,'clear');
        expect(lines).toHaveLength(3);
        expect(AIVEN_DAILY.weekday[weekday]).toContain(lines[0]);
        expect(AIVEN_DAILY.time.noon).toContain(lines[1]);
        expect(AIVEN_DAILY.weather.clear).toContain(lines[2]);
        expect(familiarityGreeting('aiven',market,now,'clear')).toEqual(lines);
    });
});
