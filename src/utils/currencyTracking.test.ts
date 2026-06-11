import { describe, it, expect } from 'vitest';
import { calculateTypeRatingExpiry, getAircraftCurrency, getNightLandingCurrency } from './currencyTracking';
import type { LogbookEntry, PilotProfile } from '../types';

describe('calculateTypeRatingExpiry', () => {
    const mockProfile: PilotProfile = {
        pilotName: 'PT',
        recordDate: '2026-01-01',
        prevTotalHours: 1000,
        prevPicHours: 500,
        prevSicHours: 500,
        prevMultiEngineHours: 1000,
        prevSingleEngineHours: 0,
        prevNightHours: 50,
        prevIfrHours: 100,
        prevDayLandings: 100,
        prevNightLandings: 20,
        prevSimB300Hours: 120,
        prevSimB200Hours: 60,
        prevLpcDateB300: '2026-05-21',
        prevLpcDateB200: ''
    };

    it('returns none status if no LPC date exists', () => {
        const res = calculateTypeRatingExpiry('B200', mockProfile, []);
        expect(res.status).toBe('none');
        expect(res.expiryDate).toBeNull();
    });

    it('calculates initial expiry from profile LPC date', () => {
        // May 21 2026 LPC -> Expiry should be May 31 2027
        const res = calculateTypeRatingExpiry('B300', mockProfile, []);
        expect(res.expiryDate).toBe('2027-05-31');
        // renewal window starts 3 months before (March 1st 2027)
        expect(res.renewalStartDate).toBe('2027-03-01');
    });

    it('preserves anniversary when LPC is in 3-month renewal window', () => {
        // Expiry from profile is 2027-05-31
        // Renewal is done on 2027-04-10 (within March 1st - May 31st window)
        const loggedEntries: LogbookEntry[] = [
            {
                id: '1',
                date: '2027-04-10',
                ac: 'FSTD-B300',
                crew: ['PT'],
                legs: [],
                totalBlock: 120,
                totalFlight: 120,
                totalIFR: 0,
                totalVFR: 0,
                totalNight: 0,
                reportTime: '',
                offDuty: '',
                actualFDP: 0,
                maxFDP: 0,
                fdpViolation: false,
                weightClass: 'heavy',
                picTime: 120,
                sicTime: 0,
                dualTime: 0,
                instructorTime: 0,
                dayLandings: 0,
                nightLandings: 0,
                isSinglePilot: true,
                isMultiCrew: false,
                aircraftModel: 'B300',
                isMultiEngine: true,
                isSimulator: true,
                fstdType: 'B300',
                trainingType: 'LPC'
            }
        ];

        const res = calculateTypeRatingExpiry('B300', mockProfile, loggedEntries);
        // Expiry should extend to May 31 2028 (keeping the anniversary month!)
        expect(res.expiryDate).toBe('2028-05-31');
        expect(res.renewalStartDate).toBe('2028-03-01');
    });

    it('resets anniversary when LPC is done early (more than 3 months before expiry)', () => {
        // Expiry from profile is 2027-05-31
        // Renewal done on 2027-01-15 (earlier than March 1st window start)
        const loggedEntries: LogbookEntry[] = [
            {
                id: '1',
                date: '2027-01-15',
                ac: 'FSTD-B300',
                crew: ['PT'],
                legs: [],
                totalBlock: 120,
                totalFlight: 120,
                totalIFR: 0,
                totalVFR: 0,
                totalNight: 0,
                reportTime: '',
                offDuty: '',
                actualFDP: 0,
                maxFDP: 0,
                fdpViolation: false,
                weightClass: 'heavy',
                picTime: 120,
                sicTime: 0,
                dualTime: 0,
                instructorTime: 0,
                dayLandings: 0,
                nightLandings: 0,
                isSinglePilot: true,
                isMultiCrew: false,
                aircraftModel: 'B300',
                isMultiEngine: true,
                isSimulator: true,
                fstdType: 'B300',
                trainingType: 'LPC'
            }
        ];

        const res = calculateTypeRatingExpiry('B300', mockProfile, loggedEntries);
        // Expiry resets to the last day of Jan 2028
        expect(res.expiryDate).toBe('2028-01-31');
        expect(res.renewalStartDate).toBe('2027-11-01');
    });

    it('resets anniversary when LPC is done late (after expiry)', () => {
        // Expiry from profile is 2027-05-31
        // Renewal done late on 2027-06-12 (after May 31st)
        const loggedEntries: LogbookEntry[] = [
            {
                id: '1',
                date: '2027-06-12',
                ac: 'FSTD-B300',
                crew: ['PT'],
                legs: [],
                totalBlock: 120,
                totalFlight: 120,
                totalIFR: 0,
                totalVFR: 0,
                totalNight: 0,
                reportTime: '',
                offDuty: '',
                actualFDP: 0,
                maxFDP: 0,
                fdpViolation: false,
                weightClass: 'heavy',
                picTime: 120,
                sicTime: 0,
                dualTime: 0,
                instructorTime: 0,
                dayLandings: 0,
                nightLandings: 0,
                isSinglePilot: true,
                isMultiCrew: false,
                aircraftModel: 'B300',
                isMultiEngine: true,
                isSimulator: true,
                fstdType: 'B300',
                trainingType: 'LPC'
            }
        ];

        const res = calculateTypeRatingExpiry('B300', mockProfile, loggedEntries);
        // Expiry resets to the last day of June 2028
        expect(res.expiryDate).toBe('2028-06-30');
    });
});

describe('Aircraft and Night Landing Currency with Simulators', () => {
    it('includes simulator entries in getAircraftCurrency', () => {
        const entries: LogbookEntry[] = [
            {
                id: 'sim-1',
                date: '2026-06-01',
                ac: 'FSTD-229',
                aircraftModel: 'B200',
                isSimulator: true,
                totalBlock: 120,
                totalFlight: 120,
                legs: [],
                crew: [],
                totalIFR: 0,
                totalVFR: 0,
                totalNight: 0,
                reportTime: '',
                offDuty: '',
                actualFDP: 0,
                maxFDP: 0,
                fdpViolation: false,
                weightClass: 'light',
                picTime: 120,
                sicTime: 0,
                dualTime: 0,
                instructorTime: 0,
                dayLandings: 0,
                nightLandings: 0,
                isSinglePilot: true,
                isMultiCrew: false,
                isMultiEngine: true,
                fstdType: 'B200',
                trainingType: 'LPC'
            }
        ];
        const res = getAircraftCurrency(entries);
        expect(res).toHaveLength(1);
        expect(res[0].registration).toBe('FSTD-229');
        expect(res[0].model).toBe('B200');
    });

    it('includes simulator night landings in getNightLandingCurrency', () => {
        const entries: LogbookEntry[] = [
            {
                id: 'sim-night',
                date: '2026-06-05',
                ac: 'FSTD-229',
                aircraftModel: 'B200',
                isSimulator: true,
                totalBlock: 120,
                totalFlight: 120,
                legs: [
                    {
                        dep: 'VTBD',
                        arr: 'VTBD',
                        start: '1200',
                        stop: '1400',
                        isNight: true,
                        landingCount: 3,
                        pf: 'PT',
                        pm: '',
                        ifrTime: '2:00',
                        vfrTime: '0:00',
                        nightTime: '2:00',
                        remarks: ''
                    }
                ],
                crew: ['PT'],
                totalIFR: 120,
                totalVFR: 0,
                totalNight: 120,
                reportTime: '',
                offDuty: '',
                actualFDP: 0,
                maxFDP: 0,
                fdpViolation: false,
                weightClass: 'light',
                picTime: 120,
                sicTime: 0,
                dualTime: 0,
                instructorTime: 0,
                dayLandings: 0,
                nightLandings: 3,
                isSinglePilot: true,
                isMultiCrew: false,
                isMultiEngine: true,
                fstdType: 'B200',
                trainingType: 'LPC'
            }
        ];
        const res = getNightLandingCurrency(entries, 'PT');
        expect(res.lastNightLandingPIC).toBe('2026-06-05');
        expect(res.lastNightLanding).toBe('2026-06-05');
    });
});
