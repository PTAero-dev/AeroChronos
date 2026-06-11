import React, { useMemo, useState, useEffect } from 'react';
import type { LogbookData, LogbookEntry, PilotProfile } from '../types';
import { calculateCumulativeHours, getWarningLevel, getWarningColor } from '../utils/cumulativeHours';
import { minsToTime, rawToMins } from '../utils/calculations';
import { exportLogbookToCSV } from '../utils/csvExport';
import StatisticsCard from './StatisticsCard';
import { getAircraftCurrency, getNightLandingCurrency } from '../utils/currencyTracking';

interface LogbookViewProps {
    currentMission: LogbookData;
    logbookEntries: LogbookEntry[];
    onSaveToLogbook: () => void;
    onDeleteEntry: (id: string) => void;
    onLoadEntry: (entry: LogbookEntry) => void;
    onImportLogbook: (entries: LogbookEntry[]) => void;
    profile?: PilotProfile;
}

const LogbookView: React.FC<LogbookViewProps> = ({
    currentMission,
    logbookEntries,
    onSaveToLogbook,
    onDeleteEntry,
    onLoadEntry,
    onImportLogbook,
    profile
}) => {

    // Responsive check
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [logFilter, setLogFilter] = useState<'all' | 'flights' | 'simulators'>('all');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const filteredEntries = useMemo(() => {
        return logbookEntries.filter(entry => {
            if (logFilter === 'flights') return !entry.isSimulator;
            if (logFilter === 'simulators') return !!entry.isSimulator;
            return true;
        });
    }, [logbookEntries, logFilter]);

    // Calculate current mission totals
    const missionSummary = useMemo(() => {
        let totalBlock = 0;
        let totalFlight = 0;
        let totalIFR = 0;
        let totalVFR = 0;
        let totalNight = 0;

        currentMission.legs.forEach(leg => {
            if (leg.start && leg.stop) {
                const start = rawToMins(leg.start);
                const stop = rawToMins(leg.stop);
                let block = stop - start;
                if (block < 0) block += 1440;
                totalBlock += block;
            }
            if (leg.off && leg.on) {
                const off = rawToMins(leg.off);
                const on = rawToMins(leg.on);
                let flight = on - off;
                if (flight < 0) flight += 1440;
                totalFlight += flight;
            }
            totalIFR += rawToMins(leg.ifrTime);
            totalVFR += rawToMins(leg.vfrTime);
            totalNight += rawToMins(leg.nightTime);
        });

        return {
            totalBlock,
            totalFlight,
            totalIFR,
            totalVFR,
            totalNight,
            legCount: currentMission.legs.length,
            hasData: currentMission.legs.length > 0 && currentMission.legs.some(l => l.start && l.stop)
        };
    }, [currentMission]);

    // Calculate cumulative hours
    const cumulative = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return calculateCumulativeHours(logbookEntries, today);
    }, [logbookEntries]);

    // Calculate Flight & Sim Hours by Type (B300, B200, Others)
    const hoursByType = useMemo(() => {
        let b300Flight = profile?.prevB300Hours || 0;
        let b200Flight = profile?.prevB200Hours || 0;
        let othersFlight = profile?.prevOtherHours || 0;

        let b300Sim = profile?.prevSimB300Hours || 0;
        let b200Sim = profile?.prevSimB200Hours || 0;

        logbookEntries.forEach(entry => {
            const legTotal = entry.totalBlock;
            if (entry.isSimulator) {
                if (entry.fstdType === 'B300') b300Sim += legTotal;
                else if (entry.fstdType === 'B200') b200Sim += legTotal;
            } else {
                // Determine type
                const ac = entry.ac.toUpperCase().replace(/[^A-Z]/g, ''); // Remove dashes
                let type = 'OTHERS';
                if (['HSAIM', 'HSPBN'].includes(ac)) type = 'B300';
                else if (['HSATS', 'HSDCF'].includes(ac)) type = 'B200';

                if (type === 'B300') b300Flight += legTotal;
                else if (type === 'B200') b200Flight += legTotal;
                else othersFlight += legTotal;
            }
        });

        return {
            b300Flight,
            b300Sim,
            b300Total: b300Flight + b300Sim,
            b200Flight,
            b200Sim,
            b200Total: b200Flight + b200Sim,
            othersFlight
        };
    }, [logbookEntries, profile]);

    // Styles
    const cardStyle = {
        background: '#1e293b',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #334155'
    };

    const headerStyle = {
        color: '#38bdf8',
        fontSize: '0.9rem',
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        marginBottom: '16px',
        borderLeft: '4px solid #38bdf8',
        paddingLeft: '10px'
    };

    const boxStyle = {
        background: '#020617',
        borderRadius: '8px',
        padding: '12px',
        textAlign: 'center' as const,
        border: '1px solid #334155'
    };

    const labelStyle = {
        color: '#94a3b8',
        fontSize: '0.65rem',
        marginTop: '6px',
        textTransform: 'uppercase' as const,
        fontWeight: 'bold' as const
    };

    const valueStyle = {
        fontSize: '1.2rem',
        fontWeight: 'bold' as const,
        color: '#fff'
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>

            {/* CURRENT MISSION SUMMARY */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #38bdf8' }}>
                <div style={headerStyle}>Current Mission</div>

                {!missionSummary.hasData ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                        No flight data entered yet. Go to FLIGHT tab to add legs.
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                            <strong>Date:</strong> {currentMission.date} | <strong>Aircraft:</strong> {currentMission.ac}
                        </div>

                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                            <div style={boxStyle}>
                                <div style={{ ...valueStyle, color: '#10b981' }}>{minsToTime(missionSummary.totalBlock)}</div>
                                <div style={labelStyle}>Total Block</div>
                            </div>
                            <div style={boxStyle}>
                                <div style={{ ...valueStyle, color: '#38bdf8' }}>{minsToTime(missionSummary.totalFlight)}</div>
                                <div style={labelStyle}>Total Flight</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                            <div style={boxStyle}>
                                <div style={valueStyle}>{minsToTime(missionSummary.totalIFR)}</div>
                                <div style={labelStyle}>IFR</div>
                            </div>
                            <div style={boxStyle}>
                                <div style={valueStyle}>{minsToTime(missionSummary.totalVFR)}</div>
                                <div style={labelStyle}>VFR</div>
                            </div>
                            <div style={boxStyle}>
                                <div style={valueStyle}>{minsToTime(missionSummary.totalNight)}</div>
                                <div style={labelStyle}>NIGHT</div>
                            </div>
                        </div>

                        <button
                            onClick={onSaveToLogbook}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: '#10b981', // Green for Save
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            Save to Logbook
                        </button>
                    </>
                )}
            </div>

            {/* CUMULATIVE HOURS MONITOR */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                <div style={{ ...headerStyle, color: '#f59e0b', borderLeftColor: '#f59e0b' }}>
                    Cumulative Hours Monitor
                </div>

                <div style={{ marginBottom: '12px' }}>
                    {/* 7 Days */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Last 7 Days</span>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: getWarningColor(getWarningLevel(cumulative.days7.percentage))
                            }}>
                                {minsToTime(cumulative.days7.hours)} / {cumulative.days7.limit} hrs
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#020617',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(cumulative.days7.percentage, 100)}%`,
                                height: '100%',
                                background: getWarningColor(getWarningLevel(cumulative.days7.percentage)),
                                transition: 'width 0.3s'
                            }} />
                        </div>
                    </div>

                    {/* 28 Days */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Last 28 Days</span>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: getWarningColor(getWarningLevel(cumulative.days28.percentage))
                            }}>
                                {minsToTime(cumulative.days28.hours)} / {cumulative.days28.limit} hrs
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#020617',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(cumulative.days28.percentage, 100)}%`,
                                height: '100%',
                                background: getWarningColor(getWarningLevel(cumulative.days28.percentage)),
                                transition: 'width 0.3s'
                            }} />
                        </div>
                    </div>

                    {/* 365 Days */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Last 365 Days</span>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: getWarningColor(getWarningLevel(cumulative.days365.percentage))
                            }}>
                                {minsToTime(cumulative.days365.hours)} / {cumulative.days365.limit} hrs
                            </span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#020617',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(cumulative.days365.percentage, 100)}%`,
                                height: '100%',
                                background: getWarningColor(getWarningLevel(cumulative.days365.percentage)),
                                transition: 'width 0.3s'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Alert if any limit exceeded */}
                {(cumulative.days7.exceeded || cumulative.days28.exceeded || cumulative.days365.exceeded) && (
                    <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        textAlign: 'center'
                    }}>
                        ⚠️ CAAT LIMIT EXCEEDED
                    </div>
                )}

            </div>

            {/* FLIGHT HOURS BY AIRCRAFT TYPE */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ ...headerStyle, color: '#8b5cf6', borderLeftColor: '#8b5cf6' }}>
                    Flight & Sim Hours on Aircraft Types
                </div>
                <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                    
                    {/* B300 Card */}
                    <div style={{ ...boxStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ ...valueStyle, color: '#8b5cf6', fontSize: '1.25rem' }}>{minsToTime(hoursByType.b300Flight)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>
                            ✈️ Flt: {minsToTime(hoursByType.b300Flight)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#a78bfa' }}>
                            🖥️ Sim: {minsToTime(hoursByType.b300Sim)}
                        </div>
                        <div style={labelStyle}>B300</div>
                    </div>

                    {/* B200 Card */}
                    <div style={{ ...boxStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ ...valueStyle, color: '#8b5cf6', fontSize: '1.25rem' }}>{minsToTime(hoursByType.b200Flight)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>
                            ✈️ Flt: {minsToTime(hoursByType.b200Flight)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#a78bfa' }}>
                            🖥️ Sim: {minsToTime(hoursByType.b200Sim)}
                        </div>
                        <div style={labelStyle}>B200</div>
                    </div>

                    {/* Others Card */}
                    <div style={{ ...boxStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ ...valueStyle, color: '#f59e0b', fontSize: '1.25rem' }}>{minsToTime(hoursByType.othersFlight)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', margin: '4px 0' }}>
                            No simulator data
                        </div>
                        <div style={labelStyle}>Others</div>
                    </div>

                </div>
            </div>

            {/* STATISTICS */}
            <StatisticsCard
                logbookEntries={logbookEntries}
                profile={profile}
                onImportLogbook={onImportLogbook}
            />

            {/* CURRENCY TRACKING */}
            {logbookEntries.length > 0 && (() => {
                const aircraftCurrency = getAircraftCurrency(logbookEntries);
                const nightCurrency = getNightLandingCurrency(logbookEntries);

                return (
                    <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                        <div style={{ ...headerStyle, color: '#f59e0b', borderLeftColor: '#f59e0b' }}>
                            🛫 Currency Tracking
                        </div>

                        {/* Aircraft Last Flight */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>
                                AIRCRAFT LAST FLIGHT
                            </div>
                            {aircraftCurrency.map(ac => (
                                <div
                                    key={ac.registration}
                                    style={{
                                        background: '#020617',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        marginBottom: '6px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>
                                            {ac.registration}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                            {ac.model}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>
                                            {ac.lastFlightDate}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                            {ac.daysSince} days ago
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Night Landing Currency */}
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>
                                NIGHT LANDING CURRENCY
                            </div>

                            {/* Night Landing as PIC */}
                            <div
                                style={{
                                    background: '#020617',
                                    borderRadius: '6px',
                                    padding: '10px',
                                    marginBottom: '6px'
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                                    Last Night Landing as PIC
                                </div>
                                {nightCurrency.lastNightLandingPIC ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 'bold' }}>
                                            {nightCurrency.lastNightLandingPIC}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 'bold' }}>
                                            {nightCurrency.daysSinceNightLandingPIC} days ago
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                        No night landings as PIC
                                    </div>
                                )}
                            </div>

                            {/* Night Landing (PIC or SIC) */}
                            <div
                                style={{
                                    background: '#020617',
                                    borderRadius: '6px',
                                    padding: '10px'
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                                    Last Night Landing (PIC or SIC)
                                </div>
                                {nightCurrency.lastNightLanding ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>
                                            {nightCurrency.lastNightLanding}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>
                                            {nightCurrency.daysSinceNightLanding} days ago
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                        No night landings recorded
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* HISTORICAL ENTRIES */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ ...headerStyle, color: '#10b981', borderLeftColor: '#10b981', marginBottom: 0 }}>
                        Logbook History ({filteredEntries.length} shown)
                    </div>
                    {logbookEntries.length > 0 && (
                        <button
                            onClick={() => exportLogbookToCSV(logbookEntries, profile?.pilotName || 'PT')}
                            style={{
                                padding: '8px 16px',
                                background: '#38bdf8', // Cyan for Export
                                color: '#0f172a',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            📥 Export CSV
                        </button>
                    )}
                </div>

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                        onClick={() => setLogFilter('all')}
                        style={{
                            padding: '6px 12px',
                            background: logFilter === 'all' ? '#10b981' : '#020617',
                            color: logFilter === 'all' ? '#fff' : '#94a3b8',
                            border: '1px solid ' + (logFilter === 'all' ? '#10b981' : '#334155'),
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        All ({logbookEntries.length})
                    </button>
                    <button
                        onClick={() => setLogFilter('flights')}
                        style={{
                            padding: '6px 12px',
                            background: logFilter === 'flights' ? '#38bdf8' : '#020617',
                            color: logFilter === 'flights' ? '#fff' : '#94a3b8',
                            border: '1px solid ' + (logFilter === 'flights' ? '#38bdf8' : '#334155'),
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        ✈️ Flights ({logbookEntries.filter(e => !e.isSimulator).length})
                    </button>
                    <button
                        onClick={() => setLogFilter('simulators')}
                        style={{
                            padding: '6px 12px',
                            background: logFilter === 'simulators' ? '#a78bfa' : '#020617',
                            color: logFilter === 'simulators' ? '#fff' : '#94a3b8',
                            border: '1px solid ' + (logFilter === 'simulators' ? '#a78bfa' : '#334155'),
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        🖥️ Simulators ({logbookEntries.filter(e => e.isSimulator).length})
                    </button>
                </div>

                {filteredEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                        No entries found for the selected filter.
                    </div>
                ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {filteredEntries
                            .sort((a, b) => b.date.localeCompare(a.date)) // newest first
                            .map(entry => (
                                <div
                                    key={entry.id}
                                    style={{
                                        background: '#020617',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '8px',
                                        border: `1px solid ${entry.isSimulator ? '#a78bfa' : '#334155'}`
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{entry.date}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {entry.isSimulator
                                                    ? `${entry.ac} • ${entry.trainingType || 'SIM'} • ${entry.aircraftModel}`
                                                    : `${entry.ac} • ${entry.legs.length} legs`
                                                }
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={() => onLoadEntry(entry)}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid #38bdf8',
                                                    color: '#38bdf8',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => onDeleteEntry(entry.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid #475569',
                                                    color: '#94a3b8',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    {entry.isSimulator ? (
                                        <div style={{
                                            background: 'rgba(167, 139, 250, 0.05)',
                                            border: '1px dashed rgba(167, 139, 250, 0.3)',
                                            borderRadius: '6px',
                                            padding: '10px 12px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '16px',
                                            fontSize: '0.75rem'
                                        }}>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>FSTD Date: </span>
                                                <span style={{ color: '#fff', fontWeight: 'bold' }}>{entry.date}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>FSTD Type: </span>
                                                <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{entry.fstdType || entry.aircraftModel}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>Device ID: </span>
                                                <span style={{ color: '#fff' }}>{entry.ac}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>Total Session Time: </span>
                                                <span style={{ color: '#10b981', fontWeight: 'bold' }}>{minsToTime(entry.totalBlock)}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8' }}>Training Type: </span>
                                                <span style={{ color: '#fff' }}>{entry.trainingType || 'Recurrent'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', fontSize: '0.7rem', marginBottom: '8px', textAlign: 'center', minWidth: '500px' }}>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>BLK</div>
                                                        <div style={{ color: '#10b981', fontWeight: 'bold' }}>{minsToTime(entry.totalBlock)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>PIC</div>
                                                        <div style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                                                            {minsToTime(entry.picTime)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>SIC</div>
                                                        <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                                                            {minsToTime(entry.sicTime)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>NIGHT</div>
                                                        <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>{minsToTime(entry.totalNight)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>DUAL</div>
                                                        <div style={{ color: '#94a3b8', fontWeight: 'bold' }}>
                                                            {minsToTime(
                                                                entry.legs.reduce((total, leg) => {
                                                                    const userInitials = profile?.pilotName || 'PT';
                                                                    if (leg.dual && leg.dual.trim().toUpperCase() === userInitials.toUpperCase() && leg.start && leg.stop) {
                                                                        const start = rawToMins(leg.start);
                                                                        const stop = rawToMins(leg.stop);
                                                                        let block = stop - start;
                                                                        if (block < 0) block += 1440;
                                                                        return total + block;
                                                                    }
                                                                    return total;
                                                                }, 0)
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>IP</div>
                                                        <div style={{ color: '#94a3b8', fontWeight: 'bold' }}>
                                                            {minsToTime(
                                                                entry.legs.reduce((total, leg) => {
                                                                    const userInitials = profile?.pilotName || 'PT';
                                                                    if (leg.ip && leg.ip.trim().toUpperCase() === userInitials.toUpperCase() && leg.start && leg.stop) {
                                                                        const start = rawToMins(leg.start);
                                                                        const stop = rawToMins(leg.stop);
                                                                        let block = stop - start;
                                                                        if (block < 0) block += 1440;
                                                                        return total + block;
                                                                    }
                                                                    return total;
                                                                }, 0)
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#64748b' }}>LDG</div>
                                                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{entry.dayLandings + entry.nightLandings}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                {entry.aircraftModel} • {entry.isMultiCrew ? 'Multi-Crew' : 'Single Pilot'} • {entry.fdpViolation ? '⚠️ FDP Violation' : '✓ FDP OK'}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default LogbookView;
