import type { LogbookEntry } from '../types';

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
