import type { LogbookEntry } from '../types';

export interface CumulativePeriod {
    hours: number; // total flight hours in this period
    limit: number; // CAAT limit for this period
    exceeded: boolean; // whether limit is exceeded
    percentage: number; // percentage of limit used (0-100+)
}

export interface CumulativeLimits {
    days7: CumulativePeriod;
    days28: CumulativePeriod;
    days365: CumulativePeriod;
}

// CAAT Flight Time Limits (in hours)
const LIMITS = {
    DAYS_7: 34,
    DAYS_28: 110,
    DAYS_365: 1000
};

/**
 * Calculate cumulative flight hours for rolling windows
 * @param entries All logbook entries
 * @param referenceDate The date to calculate from (YYYY-MM-DD), typically today
 * @returns Cumulative limits for 7, 28, and 365 day periods
 */
export function calculateCumulativeHours(
    entries: LogbookEntry[],
    referenceDate: string
): CumulativeLimits {
    const refDate = new Date(referenceDate);

    // Helper to check if entry is within N days before reference
    const isWithinDays = (entryDate: string, days: number): boolean => {
        const entry = new Date(entryDate);
        const diffMs = refDate.getTime() - entry.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays < days;
    };

    // Calculate total BLOCK MINUTES for each period (not flight time)
    const calc7Days = entries
        .filter(e => isWithinDays(e.date, 7))
        .reduce((sum, e) => sum + e.totalBlock, 0); // use totalBlock

    const calc28Days = entries
        .filter(e => isWithinDays(e.date, 28))
        .reduce((sum, e) => sum + e.totalBlock, 0);

    const calc365Days = entries
        .filter(e => isWithinDays(e.date, 365))
        .reduce((sum, e) => sum + e.totalBlock, 0);

    // Build result objects
    const days7: CumulativePeriod = {
        hours: calc7Days, // store as minutes
        limit: LIMITS.DAYS_7,
        exceeded: calc7Days > (LIMITS.DAYS_7 * 60), // compare minutes to limit in minutes
        percentage: Math.round((calc7Days / (LIMITS.DAYS_7 * 60)) * 100)
    };

    const days28: CumulativePeriod = {
        hours: calc28Days,
        limit: LIMITS.DAYS_28,
        exceeded: calc28Days > (LIMITS.DAYS_28 * 60),
        percentage: Math.round((calc28Days / (LIMITS.DAYS_28 * 60)) * 100)
    };

    const days365: CumulativePeriod = {
        hours: calc365Days,
        limit: LIMITS.DAYS_365,
        exceeded: calc365Days > (LIMITS.DAYS_365 * 60),
        percentage: Math.round((calc365Days / (LIMITS.DAYS_365 * 60)) * 100)
    };

    return { days7, days28, days365 };
}

/**
 * Get warning level based on percentage of limit used
 * @param percentage 0-100+
 * @returns 'safe' | 'warning' | 'danger'
 */
export function getWarningLevel(percentage: number): 'safe' | 'warning' | 'danger' {
    if (percentage >= 100) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'safe';
}

/**
 * Get color for warning level
 */
export function getWarningColor(level: 'safe' | 'warning' | 'danger'): string {
    switch (level) {
        case 'safe': return '#10b981'; // green
        case 'warning': return '#f59e0b'; // amber
        case 'danger': return '#ef4444'; // red
    }
}
