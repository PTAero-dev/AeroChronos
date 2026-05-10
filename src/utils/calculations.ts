import type { TimeResult, AircraftWeight } from '../types';

export const validateAndFormatTime = (val: string): TimeResult => {
    let formatted = val;
    if (formatted.length === 4 && !formatted.includes(':')) {
        formatted = formatted.slice(0, 2) + ':' + formatted.slice(2);
    }
    const valid = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formatted);
    return { valid, val: formatted };
};

// Helper for minutes
export const timeToMins = (t: string): number => {
    if (!t || t.indexOf(':') < 0) return 0; // standard format
    const p = t.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
};

// Raw 4-digit to minutes
export const rawToMins = (t: string): number => {
    if (!t) return 0;
    // If it contains a colon, it's already formatted (e.g. "1:35" or "0:45")
    if (t.includes(':')) {
        const p = t.split(':');
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    }
    // Otherwise it's raw digits (e.g. "1235")
    const clean = t.replace(/\D/g, '');
    if (clean.length < 4) return 0;
    const hh = parseInt(clean.slice(0, 2), 10);
    const mm = parseInt(clean.slice(2, 4), 10);
    return hh * 60 + mm;
};

// Check sequence (curr >= prev)
export const isSeqValid = (current: string, prev: string): boolean => {
    if (!current) return true; // empty is valid until filled? Or irrelevant.
    if (!isValidTimeRaw(current)) return false;
    if (current.length < 4) return true; // Partial
    if (!prev || prev.length < 4) return true; // checking against nothing

    // Compare
    return rawToMins(current) >= rawToMins(prev);
};

export const minsToTime = (m: number): string => {
    const h = Math.floor(m / 60);
    const n = m % 60;
    return `${h.toString()}:${n.toString().padStart(2, '0')}`;
};

// Basic 4-digit validation (Raw)
export const isValidTimeRaw = (val: string) => {
    if (val.length !== 4) return false;
    const hh = parseInt(val.slice(0, 2), 10);
    const mm = parseInt(val.slice(2, 4), 10);
    return hh < 24 && mm < 60;
};

export const calculateDiff = (s: string, e: string): string | null => {
    if (!s || !e) return null;
    const r1 = validateAndFormatTime(s);
    const r2 = validateAndFormatTime(e);
    if (!r1.valid || !r2.valid) return null;

    let diff = (new Date("2000/01/01 " + r2.val).getTime() - new Date("2000/01/01 " + r1.val).getTime()) / 60000;
    if (diff < 0) diff += 1440;
    return minsToTime(diff);
};

export const calculateDiffStrict = (s: string, e: string): string | null => {
    if (!s || !e) return null;
    if (!isValidTimeRaw(s) || !isValidTimeRaw(e)) return null;

    const r1 = validateAndFormatTime(s);
    const r2 = validateAndFormatTime(e);
    // Since isValidTimeRaw passed, r1/r2 should be valid parsable times

    let diff = (new Date("2000/01/01 " + r2.val).getTime() - new Date("2000/01/01 " + r1.val).getTime()) / 60000;

    if (diff < 0) return null; // STRICT: No wrapping allowed (User Request)
    return minsToTime(diff);
};

export const calculateDiffMins = (s: string, e: string): number => {
    const diffStr = calculateDiff(s, e);
    return diffStr ? timeToMins(diffStr) : 0;
};

export const calculateDiffMinsStrict = (s: string, e: string): number => {
    const diffStr = calculateDiffStrict(s, e);
    return diffStr ? timeToMins(diffStr) : 0;
};

export const getFDPLimit = (depMins: number, sectors: number, weight: AircraftWeight): number => {
    const getVal = (arr: number[], s: number) => arr[s - 1] * 60;
    let s = sectors;

    if (weight === 'light') {
        if (s > 7) s = 7;
        if (depMins >= 300 && depMins < 360) return getVal([13, 13, 12, 12, 12, 11, 11], s);
        if (depMins >= 360 && depMins < 780) return getVal([13.5, 13.5, 13, 12, 12, 12, 11], s);
        if (depMins >= 780 && depMins < 900) return getVal([13, 13, 12, 12, 12, 11, 11], s);
        return getVal([12, 12, 11, 11, 11, 10, 10], s); // Night
    }
    if (weight === 'heavy') {
        if (s > 8) s = 8;
        if (depMins >= 360 && depMins < 480) return getVal([13, 12.25, 11.75, 11.25, 10.75, 9.75, 9, 9], s);
        if (depMins >= 480 && depMins < 900) return getVal([13.5, 13.25, 12.5, 11.75, 11.25, 10.75, 9.5, 9], s);
        if (depMins >= 900 && depMins < 1320) return getVal([13, 12.25, 11.5, 10.75, 10, 9.25, 9, 9], s);
        return getVal([11, 10.25, 9.5, 9, 9, 9, 9, 9], s);
    }
    return 12 * 60; // Fallback
};
