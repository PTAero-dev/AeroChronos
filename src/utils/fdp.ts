
/**
 * FDP Rules Extracted from Logbook FDP.html
 */

export interface FDPCalculationResult {
    reportMins: number;
    offDutyMins: number;
    actualFdpMins: number;
    maxFdpMins: number;
    reqRestHrs: number;
    violation: boolean;
}

export type WeightClass = 'heavy' | 'light';
export type PilotOps = 'multi' | 'single';

export function calculateFDP(
    firstStartStr: string,
    lastStopStr: string,
    sectors: number,
    weight: WeightClass,
    _pilotOps: PilotOps, // Currently unused in logic but good to have API
    overrideReportTime?: string // Optional Override HHMM
): FDPCalculationResult | null {

    if (!firstStartStr || !lastStopStr) return null;

    // Helper: Time String "HH:MM" or "HHMM" to Mins
    const toMins = (t: string) => {
        if (!t) return 0;
        // Handle HH:MM
        if (t.includes(':')) {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        }
        // Handle HHMM (Raw)
        if (t.length === 4) {
            const h = parseInt(t.slice(0, 2), 10);
            const m = parseInt(t.slice(2, 4), 10);
            return h * 60 + m;
        }
        return 0;
    };

    let startMins = toMins(firstStartStr);
    let stopMins = toMins(lastStopStr);

    // Handle Day Crossing for Stop Time (Simple check: if Stop < Start, assume next day)
    // Note: This is a basic assumption.
    if (stopMins < startMins) {
        stopMins += 1440;
    }

    // 1. Report and Off-Duty Offsets
    const offsetStart = weight === 'heavy' ? 60 : 45;
    const offsetEnd = weight === 'heavy' ? 30 : 15;

    let reportMins = startMins - offsetStart;

    // OVERRIDE LOGIC
    if (overrideReportTime && overrideReportTime.length === 4) {
        // Parse Override
        const ovrMins = toMins(overrideReportTime);
        // If override is remarkably later than start, user might mean previous day? 
        // For simplicity, we assume override is same day or strictly before start.
        // If Start=13:00 (780), Override=08:00 (480) -> Correct.
        // If Start=01:00 (60), Override=23:00 (1380) -> Previous Day?
        // Let's assume override IS the report time relative to the same day cycle.
        // If override > startMins, it *might* suggest previous day, but usually report < start.

        // Handle potential day calc wrap:
        // If Override > StartMins (e.g. Start 01:00, Report 23:00), treat Report as prev day (-1440)
        let r = ovrMins;
        if (r > startMins) {
            // Only if difference is significant (e.g. > 12 hours? or purely strict?)
            // Standard duty is < 14 hours. 
            r -= 1440;
        }
        reportMins = r;
    }

    const offDutyMins = stopMins + offsetEnd;

    // Normalize calculation (if report is negative, it's prev day, but for duration it doesn't matter)
    // For display normalization, the UI handles it using minsToTime modulo.

    // 2. FDP Duration
    // If reportMins is negative (e.g. Flight 00:30, Report -20:30 prev day), 
    // duration `offDuty - report` still works mathematically: (stop+offset) - (start-offset)
    const actualFdpMins = offDutyMins - reportMins;


    // 3. Max FDP Limit
    const maxFdpMins = getFDPLimit(startMins, sectors, weight);


    // 4. Rest Requirements
    const fdpHrs = actualFdpMins / 60;
    let reqRestHrs = 0;

    if (fdpHrs <= 8) reqRestHrs = 8;
    else if (fdpHrs <= 10) reqRestHrs = 10;
    else if (fdpHrs <= 12) reqRestHrs = 12;
    else if (fdpHrs <= 14) reqRestHrs = 14;
    else if (fdpHrs <= 16) reqRestHrs = 16;
    else reqRestHrs = 24;

    return {
        reportMins,
        offDutyMins,
        actualFdpMins,
        maxFdpMins,
        reqRestHrs,
        violation: actualFdpMins > maxFdpMins
    };
}

function getFDPLimit(depMins: number, sectors: number, weight: WeightClass): number {
    // Limits are in HOURS in the arrays, convert to mins at return
    // depMins should be normalized to 0-1440 for lookup
    let d = depMins;
    while (d < 0) d += 1440;
    while (d >= 1440) d -= 1440;

    const getVal = (arr: number[], s: number) => {
        // arrays are 0-indexed for 1 sector? 
        // Original code: `return arr[s-1] * 60;`
        // If s > length, clamp
        const idx = Math.min(s, arr.length) - 1;
        if (idx < 0) return 12 * 60; // fallback
        return arr[idx] * 60;
    };

    if (weight === 'light') {
        // Logic:
        // 05:00(300) - 05:59(359)
        if (d >= 300 && d < 360) return getVal([13, 13, 12, 12, 12, 11, 11], sectors);
        // 06:00(360) - 12:59(779)
        if (d >= 360 && d < 780) return getVal([13.5, 13.5, 13, 12, 12, 12, 11], sectors);
        // 13:00(780) - 14:59(899)
        if (d >= 780 && d < 900) return getVal([13, 13, 12, 12, 12, 11, 11], sectors);
        // Other (15:00 - 04:59)
        return getVal([12, 12, 11, 11, 11, 10, 10], sectors);
    }

    if (weight === 'heavy') {
        // Logic:
        // 06:00(360) - 07:59(479)
        if (d >= 360 && d < 480) return getVal([13, 12.25, 11.75, 11.25, 10.75, 9.75, 9, 9], sectors);
        // 08:00(480) - 14:59(899)
        if (d >= 480 && d < 900) return getVal([13.5, 13.25, 12.5, 11.75, 11.25, 10.75, 9.5, 9], sectors);
        // 15:00(900) - 21:59(1319)
        if (d >= 900 && d < 1320) return getVal([13, 12.25, 11.5, 10.75, 10, 9.25, 9, 9], sectors);
        // Other (22:00 - 05:59)
        return getVal([11, 10.25, 9.5, 9, 9, 9, 9, 9], sectors);
    }

    return 12 * 60; // default safe fallback
}

/**
 * Calculate Projections for Valid Start Time (Real-time monitoring)
 * Returns pertinent times in HH:MM format
 */
export interface FDPProjections {
    reportTime: string; // HH:MM
    maxDutyEndTime: string; // HH:MM (Report + MaxFDP)
    mustLandBy: string; // HH:MM (MaxDutyEnd - PostFlightOffset)
    maxFdpMins: number; // raw mins
    reportMins: number; // raw mins
}

export function calculateFDPProjections(
    firstStartStr: string,
    sectors: number,
    weight: WeightClass
): FDPProjections | null {
    if (!firstStartStr) return null;

    // Helper: Time String to Mins
    const toMins = (t: string) => {
        if (!t) return 0;
        if (t.includes(':')) {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        }
        if (t.length === 4) {
            const h = parseInt(t.slice(0, 2), 10);
            const m = parseInt(t.slice(2, 4), 10);
            return h * 60 + m;
        }
        return 0;
    };

    // Helpler: Mins to HH:MM
    const toTime = (m: number) => {
        let mins = m;
        while (mins < 0) mins += 1440;
        while (mins >= 1440) mins -= 1440;
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const min = (mins % 60).toString().padStart(2, '0');
        return `${h}:${min}`;
    };

    const startMins = toMins(firstStartStr);
    
    // 1. Determine Report Time
    const offsetStart = weight === 'heavy' ? 60 : 45;
    const reportMins = startMins - offsetStart;

    // 2. Determine Max FDP
    // Note: getFDPLimit expects start time. 
    // Technically FDP limit tables are based on REPORT time or START time?
    // Usually it's Report Time for most regs, but here existing code uses `startMins` passed to `getFDPLimit`.
    // We will stick to existing logic: `getFDPLimit(startMins...)`
    const maxFdpMins = getFDPLimit(startMins, sectors, weight);

    // 3. Max Duty End Time
    // Report + Max FDP
    const maxDutyEndMins = reportMins + maxFdpMins;

    // 4. Must Land By
    // Standard practice: Flight Duty Period ends at engine shutdown (On Chocks).
    // Post-flight duties are AFTER FDP.
    // So "Must Land By" is exactly "Max Duty End Time" (On Chocks time).
    // The off-duty time (Next Rest starts) would be Land + PostFlightOffset.
    // So for the pilot, they must be "On Chocks" by `maxDutyEndMins`.
    const mustLandByMins = maxDutyEndMins;

    return {
        reportTime: toTime(reportMins),
        maxDutyEndTime: toTime(maxDutyEndMins),
        mustLandBy: toTime(mustLandByMins),
        maxFdpMins,
        reportMins
    };
}
