import React, { useEffect, useState } from 'react';
import type { Leg } from '../types';
import { calculateDiffStrict, isSeqValid, isValidTimeRaw, timeToMins, minsToTime } from '../utils/calculations';
import { focusNextInput } from '../utils/ux';

interface LegRowProps {
    leg: Leg;
    index: number;
    crewList: string[];
    prevLegStop?: string;
    onChange: (index: number, field: keyof Leg, value: any) => void;
    onBatchUpdate: (index: number, updates: Partial<Leg>) => void;
    onDelete: (index: number) => void;
}

// Helper to parse raw 4-digit to minutes
const rawToMins = (t: string) => {
    if (!t || t.length < 4) return 0;
    const hh = parseInt(t.slice(0, 2), 10);
    const mm = parseInt(t.slice(2, 4), 10);
    return hh * 60 + mm;
};

const LegRow: React.FC<LegRowProps> = ({ leg, index, crewList, prevLegStop, onChange, onBatchUpdate, onDelete }) => {

    const handleTimeInput = (field: keyof Leg, val: string, inputId: string, nextId?: string) => {
        let clean = val.replace(/\D/g, '').slice(0, 4);
        let display = clean;
        onChange(index, field, display);
        // Only auto-focus if full length AND valid time
        if (clean.length === 4 && nextId && isValidTimeRaw(clean)) {
            focusNextInput(inputId, nextId, clean, 4);
        }
    };

    const handleDepArrInput = (field: keyof Leg, val: string, inputId: string, nextId?: string) => {
        const clean = val.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4);
        onChange(index, field, clean);
        if (clean.length === 4 && nextId) {
            focusNextInput(inputId, nextId, clean, 4);
        }
    };



    // Calc Display only if valid (and full length for calcs)
    const rawBlk = calculateDiffStrict(leg.start, leg.stop);
    const rawFlt = calculateDiffStrict(leg.off, leg.on);

    // Strict display logic: If inputs are red, hide result.
    // We check !isValidTimeRaw/!isSeqValid. 
    // IsSeqValid returns true if partial. 
    // We strictly need valid full inputs to SHOW calc.
    // But calculateDiffStrict checks for full inputs internally.
    // We just need to ensure we don't show it if the "Sequence Logic" failed (Red Color).

    // Validation checks
    // Check if start is earlier than previous leg stop
    const isStartSequenceInvalid = prevLegStop && leg.start.length === 4 && prevLegStop.length === 4 &&
        (rawToMins(leg.start) < rawToMins(prevLegStop));

    // Red checks:
    const isStartRed = (leg.start.length === 4 && !isValidTimeRaw(leg.start)) || isStartSequenceInvalid;
    const isOffRed = leg.off.length === 4 && !isSeqValid(leg.off, leg.start);
    const isOnRed = leg.on.length === 4 && !isSeqValid(leg.on, leg.off);
    const isStopRed = leg.stop.length === 4 && !isSeqValid(leg.stop, leg.on);

    const blk = (!isStartRed && !isStopRed && rawBlk) ? rawBlk : null;
    const flt = (!isOffRed && !isOnRed && rawFlt) ? rawFlt : null;
    const validCrew = crewList.filter(c => c.length > 0);
    const pmOptions = validCrew.filter(c => c !== leg.pf); // PM cannot be PF

    const inputStyle: React.CSSProperties = {
        background: '#020617',
        color: '#fff',
        border: '1px solid #334155',
        borderRadius: '6px',
        textAlign: 'center',
        padding: '12px 10px',
        fontSize: '1rem',
        fontWeight: 'bold',
        width: '100%',
        boxSizing: 'border-box'
    };

    const handleConditionClick = (cond: 'N' | 'O' | 'N/O') => {
        console.log('Button clicked:', cond);

        // Auto-fill logic
        if (blk) {
            // Batch update all fields at once to prevent stale state overwrites
            onBatchUpdate(index, {
                condition: cond,
                ifrTime: blk,
                vfrTime: '',
                nightTime: ''
            });

            // FLTCK or NAV/FLTCK -> Focus VFR field
            if (cond === 'O' || cond === 'N/O') {
                setTimeout(() => document.getElementById(`leg-${index}-vfr`)?.focus(), 50);
            }
        } else {
            // Just update condition if no times yet
            onChange(index, 'condition', cond);
        }
    };

    const handleExtraTimeInput = (field: 'vfrTime' | 'nightTime', val: string) => {
        let clean = val.replace(/\D/g, '').slice(0, 4);

        // Prepare updates
        const updates: Partial<Leg> = { [field]: clean };

        // Recalc IFR if valid (IFR = Block - VFR only, Night is independent)
        if (blk && isValidTimeRaw(clean)) {
            const vfr = field === 'vfrTime' ? clean : leg.vfrTime;
            const totalBlk = timeToMins(blk);
            const vfrMins = rawToMins(vfr);

            const remainder = totalBlk - vfrMins;
            updates.ifrTime = remainder >= 0 ? minsToTime(remainder) : '0:00';
        }

        onBatchUpdate(index, updates);
    };

    // Auto-calculate IFR logic (IFR = Block - VFR only, Night is independent)
    useEffect(() => {
        if (blk && leg.condition) {
            const totalBlk = timeToMins(blk);
            const vfrMins = rawToMins(leg.vfrTime);

            const remainder = totalBlk - vfrMins;
            const newIfr = remainder >= 0 ? minsToTime(remainder) : '0:00';

            if (newIfr !== leg.ifrTime) {
                onChange(index, 'ifrTime', newIfr);
            }
        }
    }, [blk, leg.vfrTime, leg.condition, index, onChange]);

    const getBorderColor = () => {
        if (!leg.condition) return '#3b82f6'; // Default Blue
        if (leg.condition === 'N') return '#10b981'; // Green
        if (leg.condition === 'O') return '#f59e0b'; // Orange
        if (leg.condition === 'N/O') return '#a855f7'; // Purple (Distinct from Blue)
        return '#3b82f6';
    };



    const [isMinimized, setIsMinimized] = useState(false);

    return (
        <div style={{
            background: '#1e293b',
            borderRadius: '8px',
            padding: '16px',
            borderLeft: `4px solid ${getBorderColor()}`,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            position: 'relative',
            transition: 'border-left-color 0.3s ease'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMinimized ? '0' : '12px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '0 4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? '▶' : '▼'}
                    </button>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.1rem' }}>LEG {index + 1}</span>
                    {isMinimized && leg.dep && leg.arr && (
                        <span style={{ marginLeft: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                            {leg.dep} ➝ {leg.arr}
                        </span>
                    )}
                </div>

                {/* Centered Stats - Adjust for Minimize */}
                <div style={{
                    position: isMinimized ? 'static' : 'absolute',
                    left: isMinimized ? 'auto' : '50%',
                    transform: isMinimized ? 'none' : 'translateX(-50%)',
                    display: 'flex',
                    gap: '12px',
                    fontSize: '1.1rem',
                    marginLeft: isMinimized ? 'auto' : 0,
                    marginRight: isMinimized ? '12px' : 0
                }}>
                    <span style={{ color: '#94a3b8' }}>BLK <span style={{ color: '#10b981', fontWeight: 'bold' }}>{blk || '--:--'}</span></span>
                    <span style={{ color: '#94a3b8' }}>FLT <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{flt || '--:--'}</span></span>
                </div>

                <span onClick={() => onDelete(index)} style={{ color: '#94a3b8', textDecoration: 'underline', fontSize: '0.75rem', cursor: 'pointer' }}>DELETE</span>
            </div>

            {!isMinimized && (
                <>

                    {/* Route */}
                    <div className="grid-2" style={{ marginBottom: '8px' }}>
                        <input
                            id={`leg-${index}-dep`}
                            value={leg.dep}
                            onChange={e => handleDepArrInput('dep', e.target.value, `leg-${index}-dep`, `leg-${index}-arr`)}
                            style={inputStyle}
                            placeholder="DEP"
                        />
                        <input
                            id={`leg-${index}-arr`}
                            value={leg.arr}
                            onChange={e => handleDepArrInput('arr', e.target.value, `leg-${index}-arr`)}
                            style={inputStyle}
                            placeholder="ARR"
                        />
                    </div>

                    {/* Crew (PF/PM) vs Instruction (DUAL/IP) */}
                    <div className="grid-2" style={{ marginBottom: '16px', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <select
                                value={leg.pf}
                                onChange={e => {
                                    const val = e.target.value;
                                    // If PF selected, clear Dual/IP
                                    onBatchUpdate(index, { pf: val, dual: '', ip: '' });
                                }}
                                style={{ ...inputStyle, opacity: (leg.dual || leg.ip) ? 0.3 : 1 }}
                                disabled={!!leg.dual || !!leg.ip}
                            >
                                <option value="" disabled>PF</option>
                                {validCrew.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={leg.pm === leg.pf ? '' : leg.pm}
                                onChange={e => {
                                    const val = e.target.value;
                                    // If PM selected, clear Dual/IP
                                    onBatchUpdate(index, { pm: val, dual: '', ip: '' });
                                }}
                                style={{ ...inputStyle, opacity: (leg.dual || leg.ip) ? 0.3 : 1 }}
                                disabled={!!leg.dual || !!leg.ip}
                            >
                                <option value="" disabled>PM</option>
                                {pmOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <select
                                id={`leg-${index}-dual`}
                                value={(leg.pf || leg.pm) ? '' : leg.dual}
                                onChange={e => {
                                    const val = e.target.value;
                                    // If DUAL selected, clear PF/PM and auto-focus IP
                                    onBatchUpdate(index, { dual: val, pf: '', pm: '' });
                                    if (val) {
                                        setTimeout(() => document.getElementById(`leg-${index}-ip`)?.focus(), 50);
                                    }
                                }}
                                style={{ ...inputStyle, opacity: (leg.pf || leg.pm) ? 0.3 : 1 }}
                                disabled={!!leg.pf || !!leg.pm}
                            >
                                <option value="" disabled>DUAL</option>
                                {validCrew.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                id={`leg-${index}-ip`}
                                value={(leg.pf || leg.pm) ? '' : leg.ip}
                                onChange={e => {
                                    const val = e.target.value;
                                    // If IP selected, clear PF/PM
                                    onBatchUpdate(index, { ip: val, pf: '', pm: '' });
                                }}
                                style={{ ...inputStyle, opacity: (leg.pf || leg.pm) ? 0.3 : 1 }}
                                disabled={!!leg.pf || !!leg.pm}
                            >
                                <option value="" disabled>IP</option>
                                {validCrew.filter(c => c !== leg.dual).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Divider */}
                    <hr style={{ border: 'none', borderTop: '1px solid #334155', marginBottom: '16px' }} />

                    {/* Times */}
                    <div className="grid-4" style={{ marginBottom: '12px', gap: '8px' }}>
                        <input
                            id={`leg-${index}-start`}
                            className="time-input"
                            type="tel"
                            inputMode="numeric"
                            value={leg.start}
                            onChange={e => handleTimeInput('start', e.target.value, `leg-${index}-start`, `leg-${index}-off`)}
                            style={{ ...inputStyle, padding: '8px 0', fontSize: '0.9rem', color: !isStartRed ? '#fff' : '#ef4444' }}
                            placeholder="STRT"
                        />
                        <input
                            id={`leg-${index}-off`}
                            className="time-input"
                            type="tel"
                            inputMode="numeric"
                            value={leg.off}
                            onChange={e => handleTimeInput('off', e.target.value, `leg-${index}-off`, `leg-${index}-on`)}
                            style={{
                                ...inputStyle, padding: '8px 0', fontSize: '0.9rem',
                                color: !isOffRed ? '#fff' : '#ef4444'
                            }}
                            placeholder="OFF"
                        />
                        <input
                            id={`leg-${index}-on`}
                            className="time-input"
                            type="tel"
                            inputMode="numeric"
                            value={leg.on}
                            onChange={e => handleTimeInput('on', e.target.value, `leg-${index}-on`, `leg-${index}-stop`)}
                            style={{
                                ...inputStyle, padding: '8px 0', fontSize: '0.9rem',
                                color: !isOnRed ? '#fff' : '#ef4444'
                            }}
                            placeholder="ON"
                        />
                        <input
                            id={`leg-${index}-stop`}
                            className="time-input"
                            type="tel"
                            inputMode="numeric"
                            value={leg.stop}
                            onChange={e => handleTimeInput('stop', e.target.value, `leg-${index}-stop`)}
                            style={{
                                ...inputStyle, padding: '8px 0', fontSize: '0.9rem',
                                color: !isStopRed ? '#fff' : '#ef4444'
                            }}
                            placeholder="STOP"
                        />
                    </div>

                    {/* Landings */}
                    {/* Landings, IFP & Night Checkbox */}
                    <div style={{
                        background: '#0f172a',
                        borderRadius: '6px',
                        padding: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #334155'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>LDG:</span>
                            <select

                                value={leg.landingCount}
                                onChange={(e) => onChange(index, 'landingCount', parseInt(e.target.value) as any)} // type cast for quick fix or I'll update type sig
                                style={{ ...inputStyle, width: '60px', padding: '4px', height: 'auto' }}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#fff' }}>
                            <input
                                type="checkbox"
                                checked={leg.isIfp || false}
                                onChange={(e) => onChange(index, 'isIfp', e.target.checked as any)}
                                style={{ width: '20px', height: '20px', accentColor: '#38bdf8' }}
                            />
                            <span style={{ fontSize: '0.9rem' }}>IFP</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
                            <input
                                type="checkbox"
                                checked={leg.isNight}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    onChange(index, 'isNight', isChecked as any);
                                    if (isChecked) {
                                        setTimeout(() => document.getElementById(`leg-${index}-night`)?.focus(), 50);
                                    }
                                }}
                                style={{ width: '20px', height: '20px', accentColor: '#38bdf8' }}
                            />
                            <span style={{ fontSize: '0.9rem' }}>NIGHT</span>
                        </label>
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <button
                            onClick={() => handleConditionClick('N')}
                            style={{
                                background: leg.condition === 'N' ? '#10b981' : '#0f172a',
                                color: leg.condition === 'N' ? '#fff' : '#94a3b8',
                                border: '1px solid #334155', borderRadius: '4px', padding: '10px', fontWeight: 'bold'
                            }}
                        >
                            NAV
                        </button>
                        <button
                            onClick={() => handleConditionClick('O')}
                            style={{
                                background: leg.condition === 'O' ? '#f59e0b' : '#0f172a',
                                color: leg.condition === 'O' ? '#000' : '#94a3b8',
                                border: '1px solid #334155', borderRadius: '4px', padding: '10px', fontWeight: 'bold'
                            }}
                        >
                            FLTCK
                        </button>
                        <button
                            onClick={() => handleConditionClick('N/O')}
                            style={{
                                background: leg.condition === 'N/O' ? '#a855f7' : '#0f172a',
                                color: leg.condition === 'N/O' ? '#fff' : '#94a3b8',
                                border: '1px solid #334155', borderRadius: '4px', padding: '10px', fontWeight: 'bold', fontSize: '0.8rem'
                            }}
                        >
                            NAV/FLTCK
                        </button>
                    </div>

                    {/* Extra Times Row (IFR/VFR/NIGHT) */}
                    <div style={{ marginTop: '12px' }}>
                        {/* Labels Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', fontWeight: 'bold' }}>IFR</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', fontWeight: 'bold' }}>VFR</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', fontWeight: 'bold' }}>NIGHT</span>
                        </div>

                        {/* Inputs Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <input
                                value={leg.ifrTime}
                                readOnly
                                style={{ ...inputStyle, background: '#1e293b', border: '1px dashed #334155', color: '#94a3b8' }}
                                placeholder="0:00"
                            />
                            <input
                                id={`leg-${index}-vfr`}
                                type="tel"
                                inputMode="numeric"
                                value={leg.vfrTime}
                                onChange={e => handleExtraTimeInput('vfrTime', e.target.value)}
                                style={{
                                    ...inputStyle,
                                    color: (blk && rawToMins(leg.vfrTime) > timeToMins(blk)) ? '#ef4444' : '#fff'
                                }}
                                placeholder="HHMM"
                                maxLength={5}
                            />
                            <input
                                id={`leg-${index}-night`}
                                type="tel"
                                inputMode="numeric"
                                value={leg.nightTime}
                                onChange={e => handleExtraTimeInput('nightTime', e.target.value)}
                                style={{
                                    ...inputStyle,
                                    color: (blk && rawToMins(leg.nightTime) > timeToMins(blk)) ? '#ef4444' : '#fff'
                                }}
                                placeholder="HHMM"
                                maxLength={5}
                            />
                        </div>
                    </div>

                    {/* REMARKS ROW */}
                    <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}>REMARKS</div>
                        <input
                            id={`leg-${index}-remarks`}
                            type="text"
                            value={leg.remarks}
                            onChange={e => onChange(index, 'remarks', e.target.value)}
                            style={{
                                ...inputStyle,
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px'
                            }}
                            placeholder="Flight check, training, etc."
                        />
                    </div>
                </>
            )}
        </div >
    );
};

export default LegRow;
