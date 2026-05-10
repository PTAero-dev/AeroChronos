import React, { useMemo } from 'react';
import type { Leg } from '../types';
import { getAircraftConfig } from '../utils/aircraft';
import { calculateFDPProjections } from '../utils/fdp';
import { rawToMins } from '../utils/calculations';

interface FDPStatusBannerProps {
    legs: Leg[];
    aircraftReg: string;
}

const FDPStatusBanner: React.FC<FDPStatusBannerProps> = ({ legs, aircraftReg }) => {

    // Memoize calculations to prevent re-renders on every keystroke unless relevant data changes
    const projections = useMemo(() => {
        // 1. Get Aircraft Weight Class
        const acConfig = getAircraftConfig(aircraftReg);

        // 2. Get First Leg Start Time
        // We look for the first leg that has a start time. 
        // Usually it's the very first leg in the array.
        const firstLeg = legs[0];
        if (!firstLeg || !firstLeg.start || firstLeg.start.length !== 4) {
            return null;
        }

        // 3. Count Sectors
        // Count legs that are likely valid sectors (have dep/arr or just count all?)
        // FDP usually counts actual flown sectors. 
        // For planning, we assume every row is a sector.
        const sectors = legs.length;

        return calculateFDPProjections(firstLeg.start, sectors, acConfig.weightClass);
    }, [legs, aircraftReg]);

    if (!projections) {
        // If no projections (e.g. no start time), return null or a prominent empty state?
        // Returning null keeps UI clean until they start typing.
        // OR return a "Please enter Start Time" hint.
        return null;
    }

    // Determine Status Color
    // If we had "Current Time", we could warn if getting close.
    // For now, let's just show the limits in a neutral or "Good" status.

    let statusColor = '#38bdf8'; // Default Cyan
    let statusText = 'DUTY LIMITS';

    // Check for violations or warnings based on Last Valid Stop Time
    const lastLeg = [...legs].reverse().find(l => l.stop && l.stop.length === 4);

    if (lastLeg && lastLeg.stop) {
        let stopMins = rawToMins(lastLeg.stop);

        // Calculate Limit (Report + Max FDP)
        const limitMins = projections.reportMins + projections.maxFdpMins;

        // Normalization: Ensure stopMins is treated as same day or next day relative to Report
        // If stopMins < reportMins, usually means it crossed midnight
        if (stopMins < projections.reportMins) {
            stopMins += 1440;
        }

        const diff = limitMins - stopMins;

        if (diff < 0) {
            statusColor = '#ef4444'; // Red
            statusText = `DUTY EXCEEDED BY ${Math.abs(diff)} MINS`;
        } else if (diff <= 30) {
            statusColor = '#f59e0b'; // Amber
            statusText = 'APPROACHING DUTY LIMIT';
        }
    }

    const boxStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 12px',
        borderRight: '1px solid #334155'
    };

    return (
        <div style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            borderTop: `4px solid ${statusColor}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>⏱️</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>FDP MONITOR</span>
                    <span style={{ fontSize: '0.9rem', color: statusColor, fontWeight: 'bold' }}>{statusText}</span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                {/* REPORT TIME */}
                <div style={boxStyle}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{projections.reportTime}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>REPORT</span>
                </div>

                {/* MAX DUTY END */}
                <div style={boxStyle}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{projections.maxDutyEndTime}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>MAX DUTY END</span>
                </div>

                {/* MUST LAND BY (Highlight) */}
                <div style={{ ...boxStyle, borderRight: 'none', paddingRight: 0 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b' }}>{projections.mustLandBy}</span>
                    <span style={{ fontSize: '0.65rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 'bold' }}>MAX LANDING</span>
                </div>
            </div>
        </div>
    );
};

export default FDPStatusBanner;
