import { describe, it, expect } from 'vitest';
import { calculateDiff, getFDPLimit, timeToMins, minsToTime } from './calculations';

describe('Calculations', () => {
    it('calculates time difference correctly', () => {
        // Same day
        expect(calculateDiff('0800', '1000')).toBe('2:00');
        // Over midnight
        expect(calculateDiff('2300', '0100')).toBe('2:00');
        // Formatting check
        expect(calculateDiff('08:00', '10:00')).toBe('2:00');
    });

    describe('FDP Limits', () => {
        // Test cases derived from REGULATIONS (PDF) and HTML Logic

        it('checks Light Aircraft (<5700kg) limits', () => {
            // Table 1: < 5,700 kg
            // 05:00 - 05:59, 1 sector -> 13h
            const t1 = timeToMins('05:30');
            expect(getFDPLimit(t1, 1, 'light')).toBe(13 * 60);

            // 06:00 - 12:59, 2 sectors -> 13:30 (13.5h)
            const t2 = timeToMins('08:00');
            expect(getFDPLimit(t2, 2, 'light')).toBe(13.5 * 60);

            // Night: 15:00 - 04:59, 4 sectors -> 11h
            const t3 = timeToMins('20:00');
            expect(getFDPLimit(t3, 4, 'light')).toBe(11 * 60);
        });

        it('checks Heavy Aircraft (>5700kg) limits', () => {
            // Table 2: > 5,700 kg

            // 06:00 - 07:59, 1 sector -> 13h
            const t1 = timeToMins('06:30');
            expect(getFDPLimit(t1, 1, 'heavy')).toBe(13 * 60);

            // 08:00 - 14:59, 3 sectors -> 12:30 (12.5h)
            const t2 = timeToMins('10:00');
            expect(getFDPLimit(t2, 3, 'heavy')).toBe(12.5 * 60);

            // 15:00 - 21:59, 2 sectors -> 12:15 (12.25h)
            const t3 = timeToMins('16:00');
            expect(getFDPLimit(t3, 2, 'heavy')).toBe(12.25 * 60);

            // 22:00 - 05:59, 1 sector -> 11h
            const t4 = timeToMins('01:00');
            expect(getFDPLimit(t4, 1, 'heavy')).toBe(11 * 60);
        });
    });

    describe('Thousand Separation Commas', () => {
        it('formats hours exceeding 1000 with commas', () => {
            // 3908 hours and 10 minutes
            expect(minsToTime(3908 * 60 + 10)).toBe('3,908:10');
            // 2698 hours and 35 minutes
            expect(minsToTime(2698 * 60 + 35)).toBe('2,698:35');
            // < 1000 hours has no commas
            expect(minsToTime(859 * 60 + 35)).toBe('859:35');
        });

        it('parses formatted times containing commas back to minutes', () => {
            expect(timeToMins('3,908:10')).toBe(3908 * 60 + 10);
            expect(timeToMins('2,698:35')).toBe(2698 * 60 + 35);
        });
    });
});
