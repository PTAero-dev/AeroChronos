import type { LogbookEntry, PilotProfile } from '../types';

export interface AircraftStats {
    model: string;
    registrations: string[];
    totalHours: number;
    lastFlightDate: string | null;
    daysSinceLastFlight: number;
    currencyStatus: 'current' | 'warning' | 'expired';
}

export interface MonthlyStats {
    month: string; // "2026-01"
    totalHours: number;
    byAircraft: Record<string, number>;
}

export interface OverallStats {
    totalPIC: number;
    totalSIC: number;
    totalDual: number;
    totalInstructor: number;
    totalFlight: number;
    totalBlock: number;
    totalIFR: number;
    totalNight: number;
    totalDayLandings: number;
    totalNightLandings: number;
}

export interface DateRangeStats {
    totalHours: number;
    byAircraft: Record<string, number>;
}

/**
 * Get statistics by aircraft model with optional date filtering
 */
export function getAircraftStats(
    entries: LogbookEntry[],
    startDate?: string,
    endDate?: string
): AircraftStats[] {
    // Filter by date range if provided
    let filteredEntries = entries;
    if (startDate || endDate) {
        filteredEntries = entries.filter(e => {
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            return true;
        });
    }

    // Group by aircraft model
    const modelMap = new Map<string, {
        registrations: Set<string>;
        totalHours: number;
        lastFlightDate: string | null;
    }>();

    filteredEntries.forEach(entry => {
        const model = entry.aircraftModel;
        if (!modelMap.has(model)) {
            modelMap.set(model, {
                registrations: new Set(),
                totalHours: 0,
                lastFlightDate: null
            });
        }

        const stats = modelMap.get(model)!;
        stats.registrations.add(entry.ac);
        stats.totalHours += entry.totalBlock / 60; // convert to hours (using totalBlock)

        // Track most recent flight
        if (!stats.lastFlightDate || entry.date > stats.lastFlightDate) {
            stats.lastFlightDate = entry.date;
        }
    });

    // Convert to array and calculate currency
    const today = new Date();
    const results: AircraftStats[] = [];

    modelMap.forEach((stats, model) => {
        let daysSinceLastFlight = 0;
        let currencyStatus: 'current' | 'warning' | 'expired' = 'current';

        if (stats.lastFlightDate) {
            const lastFlight = new Date(stats.lastFlightDate);
            daysSinceLastFlight = Math.floor((today.getTime() - lastFlight.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceLastFlight > 90) {
                currencyStatus = 'expired';
            } else if (daysSinceLastFlight > 80) {
                currencyStatus = 'warning';
            }
        }

        results.push({
            model,
            registrations: Array.from(stats.registrations).sort(),
            totalHours: Math.round(stats.totalHours * 10) / 10,
            lastFlightDate: stats.lastFlightDate,
            daysSinceLastFlight,
            currencyStatus
        });
    });

    return results.sort((a, b) => a.model.localeCompare(b.model));
}

/**
 * Get statistics for a specific month
 */
export function getMonthlyStats(
    entries: LogbookEntry[],
    month: string // "2026-01"
): MonthlyStats {
    const filtered = entries.filter(e => !e.isSimulator && e.date.startsWith(month));

    const byAircraft: Record<string, number> = {};
    let totalHours = 0;

    filtered.forEach(entry => {
        const mins = entry.totalBlock; // Use totalBlock for consistency
        totalHours += mins;

        if (!byAircraft[entry.aircraftModel]) {
            byAircraft[entry.aircraftModel] = 0;
        }
        byAircraft[entry.aircraftModel] += mins;
    });

    return {
        month,
        totalHours, // Return as minutes
        byAircraft // Return as minutes
    };
}

/**
 * Get overall lifetime statistics
 * Only counts PIC/SIC hours where the user (PT) was actually flying
 */
export function getOverallStats(entries: LogbookEntry[], userInitials: string = 'PT', profile?: PilotProfile): OverallStats {
    let totalPIC = 0;
    let totalSIC = 0;
    let totalFlight = 0;
    let totalBlock = 0;
    let totalIFR = 0;
    let totalNight = 0;
    let totalDayLandings = 0;
    let totalNightLandings = 0;

    let totalDual = 0;
    let totalInstructor = 0;

    // Add Initial Profile Data if provided
    if (profile) {
        totalPIC += profile.prevPicHours;
        totalSIC += profile.prevSicHours;
        totalBlock += profile.prevTotalHours;
        totalIFR += profile.prevIfrHours;
        totalNight += profile.prevNightHours;
        totalDual += profile.prevDualHours || 0;
        totalInstructor += profile.prevInstructorHours || 0;
        totalDayLandings += profile.prevDayLandings;
        totalNightLandings += profile.prevNightLandings;
    }

    entries.forEach(entry => {
        if (entry.isSimulator) return;
        // For PIC/SIC, only count legs where user was actually flying
        entry.legs.forEach(leg => {
            if (leg.start && leg.stop) {
                const start = leg.start.includes(':') ?
                    parseInt(leg.start.split(':')[0]) * 60 + parseInt(leg.start.split(':')[1]) :
                    parseInt(leg.start.slice(0, 2)) * 60 + parseInt(leg.start.slice(2, 4));
                const stop = leg.stop.includes(':') ?
                    parseInt(leg.stop.split(':')[0]) * 60 + parseInt(leg.stop.split(':')[1]) :
                    parseInt(leg.stop.slice(0, 2)) * 60 + parseInt(leg.stop.slice(2, 4));

                let blockMins = stop - start;
                if (blockMins < 0) blockMins += 1440;

                // Check for User's Initials in PF, PM, DUAL, IP
                const user = userInitials.toUpperCase();

                if (leg.pf && leg.pf.trim().toUpperCase() === user) {
                    totalPIC += blockMins;
                }
                if (leg.pm && leg.pm.trim().toUpperCase() === user) {
                    totalSIC += blockMins;
                }

                // DUAL: If user is in DUAL box (Student) -> Add to DUAL time
                if (leg.dual && leg.dual.trim().toUpperCase() === user) {
                    totalDual += blockMins;
                }

                // INSTRUCTOR: If user is in IP box (Instructor) -> Add to Instructor time
                if (leg.ip && leg.ip.trim().toUpperCase() === user) {
                    totalInstructor += blockMins;
                }
            }
        });

        // Total flight/block/IFR/night are for all flights (not filtered by user)
        totalFlight += entry.totalFlight;
        totalBlock += entry.totalBlock; // This is raw total block
        totalIFR += entry.totalIFR;
        totalNight += entry.totalNight;
        totalDayLandings += entry.dayLandings;
        totalNightLandings += entry.nightLandings;
    });

    return {
        totalPIC,
        totalSIC,
        totalDual, // New
        totalInstructor, // New
        totalFlight,
        totalBlock,
        totalIFR,
        totalNight,
        totalDayLandings,
        totalNightLandings
    };
}

/**
 * Get statistics for a date range
 */
export function getDateRangeStats(
    entries: LogbookEntry[],
    startDate: string,
    endDate: string
): DateRangeStats {
    const filtered = entries.filter(e => !e.isSimulator && e.date >= startDate && e.date <= endDate);

    const byAircraft: Record<string, number> = {};
    let totalHours = 0;

    filtered.forEach(entry => {
        const mins = entry.totalBlock; // Use totalBlock for consistency
        totalHours += mins;

        if (!byAircraft[entry.aircraftModel]) {
            byAircraft[entry.aircraftModel] = 0;
        }
        byAircraft[entry.aircraftModel] += mins;
    });

    return {
        totalHours, // Return as minutes
        byAircraft // Return as minutes
    };
}

/**
 * Get currency status color
 */
export function getCurrencyColor(status: 'current' | 'warning' | 'expired'): string {
    switch (status) {
        case 'current': return '#10b981'; // green
        case 'warning': return '#f59e0b'; // amber
        case 'expired': return '#ef4444'; // red
    }
}
