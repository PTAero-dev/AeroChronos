/**
 * Aircraft configuration and utility functions
 */

export interface AircraftConfig {
    model: string;
    isMultiEngine: boolean;
    weightClass: 'heavy' | 'light';
}

const AIRCRAFT_DATABASE: Record<string, AircraftConfig> = {
    'HS-AIM': { model: 'B300', isMultiEngine: true, weightClass: 'heavy' },
    'HS-PBN': { model: 'B300', isMultiEngine: true, weightClass: 'heavy' },
    'HS-ATS': { model: 'B200', isMultiEngine: true, weightClass: 'light' },
    'HS-DCF': { model: 'B200', isMultiEngine: true, weightClass: 'light' }
};

export function getAircraftConfig(registration: string): AircraftConfig {
    const reg = registration.toUpperCase();
    if (reg.includes('136') || reg.includes('B300') || reg.includes('AIM') || reg.includes('PBN')) {
        return { model: 'B300', isMultiEngine: true, weightClass: 'heavy' };
    }
    if (reg.includes('229') || reg.includes('B200') || reg.includes('ATS') || reg.includes('DCF')) {
        return { model: 'B200', isMultiEngine: true, weightClass: 'light' };
    }
    return AIRCRAFT_DATABASE[registration] || {
        model: 'Unknown',
        isMultiEngine: false,
        weightClass: 'light'
    };
}

/**
 * Replace user's initials with 'SELF' for logbook
 */
export function formatCrewName(name: string, userInitials: string = 'PT'): string {
    return name.toUpperCase() === userInitials.toUpperCase() ? 'SELF' : name;
}
