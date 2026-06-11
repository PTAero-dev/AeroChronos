

export interface Leg {
    id: string;
    dep: string;
    arr: string;
    start: string;
    off: string;
    on: string;
    stop: string;
    pf: string;
    pm: string;
    dual: string;
    ip: string;
    condition: 'N' | 'O' | 'N/O' | '';
    landingCount: number;
    isNight: boolean;
    ifrTime: string;
    vfrTime: string;
    nightTime: string;
    remarks: string; // Added for flight check notes, etc.
    isIfp?: boolean; // IFP checkbox - if checked, block time counts as IFP hours
}

export interface LogbookData {
    date: string;
    ac: string;
    crew: [string, string, string, string]; // P1, P2, P3, P4
    legs: Leg[];
    dutyOverrideEnabled?: boolean;
    dutyOverrideTime?: string; // HHMM
    isSimulator?: boolean;
    fstdType?: 'B300' | 'B200';
    fstdDeviceId?: string;
    trainingType?: 'LPC' | 'Recurrent' | 'Initial' | 'Other';
}

export type Tab = 'mission' | 'duty' | 'logbook' | 'fltck' | 'profile' | 'calculator' | 'simulator';

// NAVAID station experience record
export interface NavaidRecord {
    id: string;         // unique id
    date: string;       // YYYY-MM-DD
    type: 'NDB' | 'VOR' | 'ILS' | 'RADAR' | 'PAPI';
    station: string;    // station name/code
    remarks?: string;
}

// IFP (Instrument Flight Procedure) record
export interface IfpRecord {
    id: string;         // unique id
    date: string;       // YYYY-MM-DD
    type: 'APP' | 'SID' | 'STAR';
    procedureName: string;  // procedure name/code
    remarks?: string;
}

// FLTCK experience data (renamed to FIVP)
export interface FltckExperience {
    prevHours: number;       // Previous FLTCK hours (minutes)
    prevHoursDate: string;   // Date of previous record (YYYY-MM-DD)
    prevHoursLocked: boolean; // Lock to prevent accidental changes
    navaidRecords: NavaidRecord[];
    navaidRequirements: {    // Customizable requirements per NAVAID type
        NDB: number;
        VOR: number;
        ILS: number;
        RADAR: number;
        PAPI: number;
    };
    navaidStartDate?: string;   // NAVAID tracking start date
    navaidStartDateLocked?: boolean; // Lock for NAVAID start date
    // IFP tracking
    ifpRecords: IfpRecord[];
    ifpStartDate?: string;      // IFP tracking start date (2-year period)
    ifpStartDateLocked?: boolean; // Lock for IFP start date
    ifpRequirements?: {         // Customizable requirements per IFP type
        APP: number;
        SID: number;
        STAR: number;
    };
    // IFP hours (separate from FLTCK hours)
    prevIfpHours?: number;       // Previous IFP hours (minutes)
    prevIfpHoursDate?: string;   // Date of previous IFP record
    prevIfpHoursLocked?: boolean; // Lock for IFP hours
}

export interface PilotProfile {
    pilotName: string;
    recordDate: string; // YYYY-MM-DD
    prevTotalHours: number; // Previous Lifetime Total
    prevPicHours: number;
    prevSicHours: number;
    prevMultiEngineHours: number;
    prevSingleEngineHours: number;
    prevNightHours: number;
    prevIfrHours: number;
    prevDualHours?: number;
    prevInstructorHours?: number;
    prevDayLandings: number;
    prevNightLandings: number;
    prevB300Hours?: number;
    prevB200Hours?: number;
    prevOtherHours?: number;
    // FIVP Experience - CAAT (Thailand domestic - VT airports)
    prevFltckHoursCaat?: number;
    prevIfpHoursCaat?: number;
    // FIVP Experience - Abroad (International)
    prevFltckHoursAbroad?: number;
    prevIfpHoursAbroad?: number;
    prevSimB300Hours?: number;
    prevSimB200Hours?: number;
    prevLpcDateB300?: string;
    prevLpcDateB200?: string;
}

export interface LogbookEntry {
    id: string; // unique ID (timestamp-based)
    date: string; // YYYY-MM-DD
    ac: string; // aircraft
    crew: string[]; // crew initials
    legs: Leg[]; // flight legs from that day

    // Computed totals for the day (in minutes)
    totalBlock: number;
    totalFlight: number;
    totalIFR: number;
    totalVFR: number;
    totalNight: number;

    // FDP data for the day
    reportTime: string; // raw format HHMM
    offDuty: string; // raw format HHMM
    actualFDP: number; // minutes
    maxFDP: number; // minutes
    fdpViolation: boolean;

    // Weight class used for FDP calculation
    weightClass: 'heavy' | 'light';

    // Pilot Function Time breakdown (in minutes)
    picTime: number;      // Pilot in Command (from PF)
    sicTime: number;      // Second in Command (from PM)
    dualTime: number;     // Dual (student) - not currently used
    instructorTime: number; // Instructor - not currently used

    // Landing counts
    dayLandings: number;
    nightLandings: number;

    // Single vs Multi-crew
    isSinglePilot: boolean;
    isMultiCrew: boolean;

    // Aircraft details
    aircraftModel: string; // B300, B200, etc.
    isMultiEngine: boolean;

    // Simulator details
    isSimulator?: boolean;
    fstdType?: 'B300' | 'B200';
    fstdDeviceId?: string;
    trainingType?: 'LPC' | 'Recurrent' | 'Initial' | 'Other';
}

export interface TimeResult {
    valid: boolean;
    val: string;
}

export type AircraftWeight = 'heavy' | 'light';
