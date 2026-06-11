import type { LogbookEntry, PilotProfile } from '../types';

export interface AircraftCurrency {
    registration: string;
    model: string;
    lastFlightDate: string;
    daysSince: number;
}

export interface NightLandingCurrency {
    lastNightLandingPIC: string | null;
    daysSinceNightLandingPIC: number | null;
    lastNightLanding: string | null;
    daysSinceNightLanding: number | null;
}

/**
 * Get latest flight date for each aircraft
 */
export function getAircraftCurrency(entries: LogbookEntry[]): AircraftCurrency[] {
    const aircraftMap = new Map<string, { model: string; lastDate: string }>();

    entries.forEach(entry => {
        const existing = aircraftMap.get(entry.ac);
        if (!existing || entry.date > existing.lastDate) {
            aircraftMap.set(entry.ac, {
                model: entry.aircraftModel,
                lastDate: entry.date
            });
        }
    });

    const today = new Date();
    const results: AircraftCurrency[] = [];

    aircraftMap.forEach((data, registration) => {
        const lastFlightDate = new Date(data.lastDate);
        const diffTime = today.getTime() - lastFlightDate.getTime();
        const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        results.push({
            registration,
            model: data.model,
            lastFlightDate: data.lastDate,
            daysSince
        });
    });

    // Sort by days since (most recent first)
    return results.sort((a, b) => a.daysSince - b.daysSince);
}

/**
 * Get night landing currency information
 */
export function getNightLandingCurrency(
    entries: LogbookEntry[],
    userInitials: string = 'PT'
): NightLandingCurrency {
    let lastNightLandingPIC: string | null = null;
    let lastNightLanding: string | null = null;

    // Sort entries by date (newest first)
    const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

    for (const entry of sortedEntries) {
        for (const leg of entry.legs) {
            // Check for night landing as PIC
            if (!lastNightLandingPIC &&
                leg.isNight &&
                leg.landingCount > 0 &&
                leg.pf &&
                leg.pf.trim().toUpperCase() === userInitials.toUpperCase()) {
                lastNightLandingPIC = entry.date;
            }

            // Check for any night landing (PIC or SIC)
            if (!lastNightLanding &&
                leg.isNight &&
                leg.landingCount > 0 &&
                (leg.pf?.trim().toUpperCase() === userInitials.toUpperCase() ||
                    leg.pm?.trim().toUpperCase() === userInitials.toUpperCase())) {
                lastNightLanding = entry.date;
            }

            // Exit early if both found
            if (lastNightLandingPIC && lastNightLanding) {
                break;
            }
        }

        if (lastNightLandingPIC && lastNightLanding) {
            break;
        }
    }

    const today = new Date();

    let daysSinceNightLandingPIC: number | null = null;
    if (lastNightLandingPIC) {
        const lastDate = new Date(lastNightLandingPIC);
        const diffTime = today.getTime() - lastDate.getTime();
        daysSinceNightLandingPIC = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    let daysSinceNightLanding: number | null = null;
    if (lastNightLanding) {
        const lastDate = new Date(lastNightLanding);
        const diffTime = today.getTime() - lastDate.getTime();
        daysSinceNightLanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
        lastNightLandingPIC,
        daysSinceNightLandingPIC,
        lastNightLanding,
        daysSinceNightLanding
    };
}

export interface ExpiryStatus {
    lastLpcDate: string | null;
    expiryDate: string | null;
    renewalStartDate: string | null;
    status: 'current' | 'warning' | 'expired' | 'none';
}

/**
 * Calculates type rating expiry and renewal window given initial/logged LPC dates.
 */
export function calculateTypeRatingExpiry(
    aircraftType: 'B300' | 'B200',
    profile: PilotProfile | undefined,
    logbookEntries: LogbookEntry[]
): ExpiryStatus {
    const lpcDates: string[] = [];

    // Add initial LPC from profile if present
    const profileLpc = aircraftType === 'B300' ? profile?.prevLpcDateB300 : profile?.prevLpcDateB200;
    if (profileLpc && profileLpc.trim()) {
        lpcDates.push(profileLpc);
    }

    // Add logged LPC dates from simulator entries
    logbookEntries.forEach(entry => {
        if (entry.isSimulator && entry.trainingType === 'LPC' && entry.fstdType === aircraftType && entry.date) {
            lpcDates.push(entry.date);
        }
    });

    if (lpcDates.length === 0) {
        return { lastLpcDate: null, expiryDate: null, renewalStartDate: null, status: 'none' };
    }

    // Sort dates chronologically
    lpcDates.sort();

    let currentExpiry: Date | null = null;

    // Helper: Get last day of the month
    const getLastDayOfMonth = (year: number, month: number): Date => {
        return new Date(year, month + 1, 0); // month is 0-indexed, month+1 with day 0 gives last day of current month
    };

    for (const dateStr of lpcDates) {
        const parts = dateStr.split('-');
        if (parts.length !== 3) continue;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const day = parseInt(parts[2], 10);
        const lpcDate = new Date(year, month, day);

        if (!currentExpiry) {
            // First LPC: Expiry is last day of the month in next year
            currentExpiry = getLastDayOfMonth(year + 1, month);
        } else {
            // Check renewal window: 3 months before expiry (from the 1st day of that month)
            const windowStart = new Date(currentExpiry.getFullYear(), currentExpiry.getMonth() - 2, 1);
            windowStart.setHours(0, 0, 0, 0);

            const expTime = new Date(currentExpiry);
            expTime.setHours(0, 0, 0, 0);

            const lpcTime = new Date(lpcDate);
            lpcTime.setHours(0, 0, 0, 0);

            if (lpcTime >= windowStart && lpcTime <= expTime) {
                // Within 3 months window: Anniversary preserved, add 1 year to current expiry
                currentExpiry = getLastDayOfMonth(currentExpiry.getFullYear() + 1, currentExpiry.getMonth());
            } else {
                // Outside window (early or late): Reset based on new LPC month + 1 year
                currentExpiry = getLastDayOfMonth(year + 1, month);
            }
        }
    }

    if (!currentExpiry) {
        return { lastLpcDate: null, expiryDate: null, renewalStartDate: null, status: 'none' };
    }

    const formatDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const renewalStartDate = new Date(currentExpiry.getFullYear(), currentExpiry.getMonth() - 2, 1);
    const expiryDateStr = formatDate(currentExpiry);
    const renewalStartDateStr = formatDate(renewalStartDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expDate = new Date(currentExpiry);
    expDate.setHours(0, 0, 0, 0);

    const renDate = new Date(renewalStartDate);
    renDate.setHours(0, 0, 0, 0);

    let status: 'current' | 'warning' | 'expired' = 'current';
    if (today > expDate) {
        status = 'expired';
    } else if (today >= renDate) {
        status = 'warning';
    }

    return {
        lastLpcDate: lpcDates[lpcDates.length - 1],
        expiryDate: expiryDateStr,
        renewalStartDate: renewalStartDateStr,
        status
    };
}

