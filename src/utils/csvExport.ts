import type { LogbookEntry } from '../types';
import { minsToTime, rawToMins } from './calculations';
import { formatCrewName } from './aircraft';

/**
 * Export logbook entries to CSV format matching official pilot logbook
 * Each leg becomes a separate row
 */
export function exportLogbookToCSV(entries: LogbookEntry[], userInitials: string = 'PT'): void {
    if (entries.length === 0) {
        alert('No logbook entries to export');
        return;
    }

    // Sort by date (oldest first for chronological order)
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // CSV Header matching official logbook format
    const headers = [
        'DATE',
        'DEPARTURE',
        'DEP TIME',
        'ARRIVAL',
        'ARR TIME',
        'AIRCRAFT MODEL',
        'REGISTRATION',
        'SE',
        'ME',
        'MULTI-CREW TIME',
        'TOTAL TIME OF FLIGHT',
        'NAME(S) PIC',
        'LANDINGS DAY',
        'LANDINGS NIGHT',
        'NIGHT TIME',
        'IFR TIME',
        'PIC TIME',
        'CO-PILOT TIME',
        'DUAL TIME',
        'INSTRUCTOR TIME',
        'REMARKS'
    ];

    // Build CSV rows - one row per leg
    const rows: string[][] = [];

    sortedEntries.forEach(entry => {
        entry.legs.forEach(leg => {
            // Calculate times for this leg
            let blockTime = 0;
            if (leg.start && leg.stop) {
                const start = rawToMins(leg.start);
                const stop = rawToMins(leg.stop);
                blockTime = stop - start;
                if (blockTime < 0) blockTime += 1440;
            }

            let flightTime = 0;
            if (leg.off && leg.on) {
                const off = rawToMins(leg.off);
                const on = rawToMins(leg.on);
                flightTime = on - off;
                if (flightTime < 0) flightTime += 1440;
            }

            // Determine pilot function for this leg
            const hasPF = !!leg.pf;
            const hasPM = !!leg.pm;
            const hasDual = !!leg.dual;
            const hasIP = !!leg.ip;

            // Multi-crew logic updated: If Dual or IP is present, it counts as Multi-crew time environment if checked
            // Or strictly following user req: "in case input in dual or IP use BLK time on that leg to fill in."
            // Assuming Flight Time or Block Time for columns? Usually CSV columns use Block Time for pilot hours or Flight Time for aircraft.
            // User said: "Multi-crew time ... use BLK time".
            // Standard Logbook "Multi-Crew" usually refers to Flight Time in multi-crew condition.
            // But let's follow the user's "Use BLK time" for Pilot columns logic if requested.
            // Wait, standard columns: Multi-Crew usually implies BLOCK time? or FLIGHT?
            // "TOTAL TIME OF FLIGHT" -> Flight Time.
            // "MULTI-CREW TIME" -> Usually Block Time.
            // Let's use BlockTime for pilot function columns (Multi-crew, PIC, Co-Pilot, Dual, Instructor).

            const isMultiCrew = (hasPF && hasPM) || hasDual || hasIP;
            const isSinglePilot = !isMultiCrew;

            // PIC Name Logic: Use IP name if present, else PF name
            let picName = '';
            if (leg.ip) {
                picName = formatCrewName(leg.ip, userInitials);
            } else if (leg.pf) {
                picName = formatCrewName(leg.pf, userInitials);
            }

            // PIC/SIC/Dual/Instructor time for this leg
            // Logic: If user is in that box, they get the Block Time.
            const user = userInitials.toUpperCase();
            const picTime = (leg.pf?.trim().toUpperCase() === user) ? blockTime : 0;
            const sicTime = (leg.pm?.trim().toUpperCase() === user) ? blockTime : 0;
            const dualTime = (leg.dual?.trim().toUpperCase() === user) ? blockTime : 0;
            const instructorTime = (leg.ip?.trim().toUpperCase() === user) ? blockTime : 0;

            // Format times as HH:MM
            // Single Pilot SE vs ME logic (using Flight Time or Block Time? Standard is Block for Pilot Logbook).
            // Actually, official logbooks vary. But user requirement "Dual use BLK time" implies we should use Block Time for these checks.
            // For SE/ME/Multi-Crew columns:
            // "Multi-crew time ... use BLK time".
            const multiCrewTimeStr = isMultiCrew ? minsToTime(blockTime) : '';

            // For SE/ME, usually it is Total Time of Flight (Flight Time).
            // But if user wants Block Time for everything?
            // Let's stick to Flight Time for aircraft columns (SE, ME, Total Flight) unless specified.
            const seTime = (isSinglePilot && !entry.isMultiEngine) ? minsToTime(blockTime) : '';
            const meTime = (isSinglePilot && entry.isMultiEngine) ? minsToTime(blockTime) : '';

            // IFR, VFR, Night times for this leg
            const ifrTime = rawToMins(leg.ifrTime);
            const nightTime = rawToMins(leg.nightTime);

            // Landing counts for this leg
            const dayLandings = (!leg.isNight && leg.landingCount > 0) ? leg.landingCount : 0;
            const nightLandings = (leg.isNight && leg.landingCount > 0) ? leg.landingCount : 0;

            rows.push([
                entry.date,
                leg.dep || '',
                leg.start ? formatRawTime(leg.start) : '',
                leg.arr || '',
                leg.stop ? formatRawTime(leg.stop) : '',
                entry.aircraftModel,
                entry.ac,
                seTime,
                meTime,
                multiCrewTimeStr,
                minsToTime(blockTime),
                picName,
                dayLandings.toString(),
                nightLandings.toString(),
                minsToTime(nightTime),
                minsToTime(ifrTime),
                minsToTime(picTime),
                minsToTime(sicTime),
                minsToTime(dualTime),
                minsToTime(instructorTime),
                leg.remarks || ''
            ]);
        });
    });

    // Convert to CSV string
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Logbook_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Format raw time (HHMM) to HH:MM for display
 */
function formatRawTime(raw: string): string {
    if (!raw || raw.length < 4) return raw;
    return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
}
