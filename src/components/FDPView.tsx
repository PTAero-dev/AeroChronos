import React, { useMemo } from 'react';
import type { LogbookData } from '../types';
import { calculateFDP, type WeightClass, type PilotOps } from '../utils/fdp';
import { minsToTime } from '../utils/calculations';

interface FDPViewProps {
    data: LogbookData;
    onUpdateData: (d: LogbookData) => void;
    onSave?: () => void;
}

const FDPView: React.FC<FDPViewProps> = ({ data, onUpdateData, onSave }) => {

    // ... (existing code omitted for brevity in replace block, targeting specific lines) ...

    // I'll do this in two chunks or a larger chunk.
    // Let's update the interface and the component signature first.


    // Auto-determine weight class based on aircraft type
    // B200 <= 5700kg (light), B300 > 5700kg (heavy)
    const getWeightClass = (ac: string): WeightClass => {
        const acUpper = ac.toUpperCase();
        if (acUpper.includes('B200')) return 'light';
        if (acUpper.includes('B300')) return 'heavy';
        // Default based on specific registrations
        if (['HS-AIM', 'HS-PBN'].includes(ac)) return 'heavy';
        if (['HS-DCF', 'HS-ATS'].includes(ac)) return 'light';
        return 'heavy';
    };

    // Auto-determine pilot ops based on crew count
    const getPilotOps = (crew: [string, string, string, string]): PilotOps => {
        const crewCount = crew.filter(c => c.trim().length > 0).length;
        return crewCount > 1 ? 'multi' : 'single';
    };

    // UI Handlers for Override
    const handleOverrideToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateData({
            ...data,
            dutyOverrideEnabled: e.target.checked,
            // If enabling, default to 0800 if empty, else keep
            dutyOverrideTime: e.target.checked ? (data.dutyOverrideTime || '0800') : data.dutyOverrideTime
        });
    };

    const handleOverrideTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
        onUpdateData({
            ...data,
            dutyOverrideTime: val
        });
    };

    // Auto-select based on current data
    const weight = useMemo(() => getWeightClass(data.ac), [data.ac]);
    const ops = useMemo(() => getPilotOps(data.crew), [data.crew]);

    // Memoized Calculation
    const result = useMemo(() => {
        if (data.legs.length === 0) return null;

        const first = data.legs[0];
        const last = data.legs[data.legs.length - 1];

        if (!first.start || !last.stop) return null;

        // Use override if enabled
        const overrideTime = data.dutyOverrideEnabled ? data.dutyOverrideTime : undefined;

        return calculateFDP(
            first.start,
            last.stop,
            data.legs.length, // sectors
            weight,
            ops,
            overrideTime
        );

    }, [data.legs, weight, ops, data.dutyOverrideEnabled, data.dutyOverrideTime]);


    // Formatting Helpers
    const formatSignOn = (offDutyMins: number, restHrs: number) => {
        const nextStartMins = offDutyMins + (restHrs * 60);
        let m = nextStartMins;
        // Normalize to day minutes roughly for display
        while (m >= 1440) m -= 1440;
        return minsToTime(m);
    };

    const formatAvailableDate = (offDutyMins: number, restHrs: number): string => {
        // Attempt to calculate date shift
        const totalMins = offDutyMins + (restHrs * 60);
        const daysShift = Math.floor(totalMins / 1440);

        // Base date from logbook
        // Use Today if date is missing/invalid, else use logbook date
        const baseDateStr = data.date || new Date().toISOString().split('T')[0];
        const d = new Date(baseDateStr);
        d.setDate(d.getDate() + daysShift);

        const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
        const year = d.toLocaleDateString('en-GB', { year: '2-digit' });

        return `${dayName} ${day} ${month} ${year}`;
    };


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
        fontWeight: 'bold',
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
        fontWeight: 'bold'
    };

    const valueStyle = {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: '#fff'
    };

    if (!result) {
        return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Please enter flight details in FLIGHT tab first.</div>;
    }

    return (
        <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '80px' }}>

            {/* MANUAL OVERRIDE CONTROL */}
            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <input
                        type="checkbox"
                        checked={!!data.dutyOverrideEnabled}
                        onChange={handleOverrideToggle}
                        style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                    />
                    Override Report Time
                </label>

                {data.dutyOverrideEnabled && (
                    <input
                        type="tel"
                        value={data.dutyOverrideTime || ''}
                        onChange={handleOverrideTimeChange}
                        placeholder="0800"
                        maxLength={4}
                        style={{
                            background: '#020617',
                            border: '1px solid #f59e0b',
                            color: '#f59e0b',
                            borderRadius: '4px',
                            padding: '6px',
                            width: '60px',
                            textAlign: 'center',
                            fontWeight: 'bold'
                        }}
                    />
                )}
            </div>

            {/* CALCULATED DUTY CARD */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                <div style={{ ...headerStyle, color: '#38bdf8', borderLeft: 'none', paddingLeft: 0, display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: '4px', height: '16px', background: '#38bdf8', marginRight: '8px', display: 'inline-block' }}></span>
                    CALCULATED DUTY {data.dutyOverrideEnabled && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: 'auto' }}>(MANUAL)</span>}
                </div>

                <div className="grid-2" style={{ marginBottom: '16px' }}>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{minsToTime(result.reportMins)}</div>
                        <div style={labelStyle}>REPORT TIME</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{minsToTime(result.offDutyMins)}</div>
                        <div style={labelStyle}>OFF DUTY</div>
                    </div>
                </div>

                <div style={{ ...boxStyle, border: '1px solid #f59e0b', display: 'flex', justifyContent: 'space-between', padding: '16px 24px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ ...valueStyle, fontSize: '1.5rem' }}>{minsToTime(result.actualFdpMins)}</div>
                        <div style={{ ...labelStyle, color: '#f59e0b' }}>ACTUAL FDP</div>
                    </div>
                    <div style={{ width: '1px', height: '40px', background: '#475569' }}></div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ ...valueStyle, fontSize: '1.5rem', color: '#f59e0b' }}>{minsToTime(result.maxFdpMins)}</div>
                        <div style={{ ...labelStyle, color: '#f59e0b' }}>MAX PERMITTED</div>
                    </div>
                </div>

                <div style={{
                    textAlign: 'center',
                    marginTop: '16px',
                    color: result.violation ? '#ef4444' : '#10b981',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                }}>
                    {result.violation ? 'VIOLATION (EXCEEDS LIMIT)' : 'WITHIN FDP LIMITS'}
                </div>
            </div>

            {/* SAVE TO LOGBOOK BUTTON */}
            {onSave && (
                <button
                    onClick={onSave}
                    style={{
                        width: '100%',
                        background: '#10b981',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                    }}
                >
                    💾 SAVE TO LOGBOOK
                </button>
            )}

            {/* NEXT AVAILABLE DUTY CARD */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #10b981' }}>
                <div style={{ ...headerStyle, color: '#38bdf8', borderLeft: 'none', paddingLeft: 0, display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: '4px', height: '16px', background: '#38bdf8', marginRight: '8px', display: 'inline-block' }}></span>
                    NEXT AVAILABLE DUTY
                </div>

                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginBottom: '12px' }}>
                    Based on CAAT Art. 6 (Rest Periods)
                </div>

                <div className="grid-2" style={{ marginBottom: '16px' }}>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{result.reqRestHrs} h</div>
                        <div style={labelStyle}>REQ. REST</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{formatAvailableDate(result.offDutyMins, result.reqRestHrs)}</div>
                        <div style={labelStyle}>AVAILABLE DATE</div>
                    </div>
                </div>

                <div style={{
                    ...boxStyle,
                    border: '1px solid #10b981',
                    padding: '24px',
                    background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(2, 6, 23, 1) 100%)'
                }}>
                    <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        YOU CAN SIGN ON AT
                    </div>
                    <div style={{
                        fontSize: '3.5rem',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        color: '#fff',
                        textShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
                    }}>
                        {formatSignOn(result.offDutyMins, result.reqRestHrs)}
                    </div>
                </div>
            </div>

            {/* FDP CONFIGURATION (Auto-selected) */}
            <div style={{ ...cardStyle, borderLeft: '4px solid #64748b' }}>
                <div style={{ ...headerStyle, color: '#64748b', borderLeftColor: '#64748b' }}>
                    ⚙️ FDP Configuration (Auto-selected)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: '#020617', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Weight Class</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10b981' }}>
                            {weight === 'heavy' ? '> 5700 kg' : '≤ 5700 kg'}
                        </div>
                    </div>
                    <div style={{ background: '#020617', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Pilot Operations</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10b981' }}>
                            {ops === 'multi' ? 'Multi-Pilot' : 'Single-Pilot'}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default FDPView;
