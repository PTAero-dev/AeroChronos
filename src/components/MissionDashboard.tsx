import React, { useMemo, useEffect, useRef } from 'react';
import type { LogbookData, Leg } from '../types';
import LegRow from './LegRow';
import ConditionBreakdown from './ConditionBreakdown';
import FDPStatusBanner from './FDPStatusBanner';
import { calculateDiffMinsStrict, minsToTime, isSeqValid, isValidTimeRaw, rawToMins } from '../utils/calculations';
import { focusNextInput } from '../utils/ux';
import { exportFlightData, importFlightData } from '../utils/flightDataIO';

interface MissionDashboardProps {
    data: LogbookData;
    updateData: (d: LogbookData) => void;
    onSave?: () => void;
    onReset?: () => void;
    onNavigateToFDP?: () => void;
    isSimulator?: boolean;
}

const MissionDashboard: React.FC<MissionDashboardProps> = ({ data, updateData, onSave, onReset, onNavigateToFDP, isSimulator }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Export handler
    const handleExport = () => {
        exportFlightData(data);
    };

    // Import handler
    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const importedData = await importFlightData(file);
            updateData(importedData);
            alert('Flight data imported successfully!');
        } catch (error) {
            alert('Failed to import: ' + (error as Error).message);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // -- Stats --
    const stats = useMemo(() => {
        let blk = 0;
        let flt = 0;
        let cN = 0;
        let cO = 0;
        let cNO = 0;

        let tIfr = 0;
        let tVfr = 0;
        let tNight = 0;

        data.legs.forEach(l => {
            // Strict checks: Inputs must be valid and in sequence
            const startValid = isValidTimeRaw(l.start);
            const stopValid = isSimulator ? isSeqValid(l.stop, l.start) : isSeqValid(l.stop, l.on);

            // Calc BLK
            const b = (startValid && stopValid) ? calculateDiffMinsStrict(l.start, l.stop) : 0;

            // Sum totals
            tIfr += rawToMins(l.ifrTime);
            tVfr += rawToMins(l.vfrTime);
            tNight += rawToMins(l.nightTime);

            blk += b;
            if (l.condition === 'N') cN += b;
            if (l.condition === 'O') cO += b;
            if (l.condition === 'N/O') cNO += b;

            // Flt
            let f = 0;
            if (isSimulator) {
                f = b;
            } else {
                const offValid = isSeqValid(l.off, l.start);
                const onValid = isSeqValid(l.on, l.off);
                f = (offValid && onValid) ? calculateDiffMinsStrict(l.off, l.on) : 0;
            }
            flt += f;
        });

        return {
            blk: minsToTime(blk),
            flt: minsToTime(flt),
            n: minsToTime(cN),
            o: minsToTime(cO),
            no: minsToTime(cNO),
            ifr: minsToTime(tIfr),
            vfr: minsToTime(tVfr),
            night: minsToTime(tNight)
        };
    }, [data.legs]);

    // Ensure at least one leg exists on mount
    useEffect(() => {
        if (data.legs.length === 0) {
            const blankLeg: Leg = {
                id: crypto.randomUUID(),
                dep: '', arr: '',
                start: '', off: '', on: '', stop: '',
                pf: '', pm: '', dual: '', ip: '', condition: '',
                landingCount: 1, isNight: false,
                ifrTime: '', vfrTime: '', nightTime: '', remarks: ''
            };
            updateData({ ...data, legs: [blankLeg] });
        }
    }, []); // Run once on mount

    // -- Handlers --
    const handleInputChange = (field: keyof LogbookData, value: any) => {
        updateData({ ...data, [field]: value });
    };

    const handleCrewChange = (index: number, val: string) => {
        const newVal = val.toUpperCase().slice(0, 2);
        const newCrew = [...data.crew] as [string, string, string, string];
        newCrew[index] = newVal;
        updateData({ ...data, crew: newCrew });

        if (newVal.length === 2 && index < 3) {
            focusNextInput(`crew-${index}`, `crew-${index + 1}`, newVal, 2);
        }
    };

    const handleLegChange = (index: number, field: keyof Leg, value: any) => {
        handleLegBatchUpdate(index, { [field]: value });
    };

    const handleLegBatchUpdate = (index: number, updates: Partial<Leg>) => {
        const newLegs = [...data.legs];
        newLegs[index] = { ...newLegs[index], ...updates };
        updateData({ ...data, legs: newLegs });
    };

    const addLeg = () => {
        const newLeg: Leg = {
            id: crypto.randomUUID(),
            dep: '', arr: '',
            start: '', off: '', on: '', stop: '',
            pf: '', pm: '', dual: '', ip: '', condition: '',
            landingCount: 1, isNight: false,
            ifrTime: '', vfrTime: '', nightTime: '', remarks: ''
        };
        if (data.legs.length > 0) {
            newLeg.dep = data.legs[data.legs.length - 1].arr;
        }
        updateData({ ...data, legs: [...data.legs, newLeg] });
    };

    const deleteLeg = (index: number) => {
        const newLegs = data.legs.filter((_, i) => i !== index);
        updateData({ ...data, legs: newLegs });
    };

    // Shared Input Style
    const inputStyle: React.CSSProperties = {
        background: '#020617',
        color: '#ffffff',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '1rem',
        fontWeight: 'bold',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
        appearance: 'none'
    };

    const labelStyle: React.CSSProperties = {
        color: '#94a3b8',
        fontSize: '0.7rem',
        marginBottom: '4px',
        display: 'block',
        textTransform: 'uppercase'
    };

    return (
        <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '60px' }}>

            {/* MISSION DASHBOARD CARD (Blue Accent) */}
            <div style={{
                background: '#1e293b',
                borderRadius: '8px',
                padding: '16px',
                borderLeft: `4px solid ${isSimulator ? '#a78bfa' : '#38bdf8'}`,
                marginBottom: '16px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ color: isSimulator ? '#a78bfa' : '#38bdf8', margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {isSimulator ? '🖥️ SIMULATOR DASHBOARD' : 'MISSION DASHBOARD'}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleExport}
                            style={{
                                background: isSimulator ? '#a78bfa' : '#38bdf8',
                                color: '#0f172a',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            📥 Export
                        </button>
                        <button
                            onClick={handleImport}
                            style={{
                                background: '#10b981', // Green for Import
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            📤 Import
                        </button>
                        {onSave && (
                            <button
                                onClick={onSave}
                                style={{
                                    background: '#10b981', // Green for Save
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                💾 Save
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

                {/* Date & Aircraft */}
                <div className="grid-2" style={{ marginBottom: '16px', gap: '12px' }}>
                    <div>
                        <label style={labelStyle}>DATE</label>
                        <input
                            type="date"
                            value={data.date}
                            onChange={(e) => handleInputChange('date', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>AIRCRAFT</label>
                        {isSimulator ? (
                            <input
                                type="text"
                                value={data.ac}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Make a guess for B300 vs B200 based on standard naming (e.g. 136 or B300)
                                    // but keep fstdType updatable via SimulatorView dropdown
                                    let type = data.fstdType;
                                    if (val.includes('136') || val.toUpperCase().includes('B300')) {
                                        type = 'B300';
                                    } else if (val.includes('129') || val.includes('229') || val.toUpperCase().includes('B200')) {
                                        type = 'B200';
                                    }
                                    updateData({ ...data, ac: val, fstdType: type });
                                }}
                                style={inputStyle}
                                placeholder="e.g. FSTD-136"
                            />
                        ) : (
                            <select
                                value={data.ac}
                                onChange={(e) => handleInputChange('ac', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="HS-AIM">HS-AIM</option>
                                <option value="HS-PBN">HS-PBN</option>
                                <option value="HS-DCF">HS-DCF</option>
                                <option value="HS-ATS">HS-ATS</option>
                            </select>
                        )}
                    </div>
                </div>

                {/* Crew */}
                <div>
                    <label style={labelStyle}>CREW INITIAL</label>
                    <div className="grid-4" style={{ gap: '8px' }}>
                        {[0, 1, 2, 3].map(i => (
                            <input
                                key={i}
                                id={`crew-${i}`}
                                value={data.crew[i]}
                                onChange={(e) => handleCrewChange(i, e.target.value)}
                                placeholder={`P${i + 1}`}
                                maxLength={2}
                                className="uppercase"
                                style={{
                                    ...inputStyle,
                                    background: '#020617',
                                    border: '1px solid #334155',
                                    padding: '12px 0' // optimize space
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>



            {/* LEGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.legs.map((leg, idx) => (
                    <LegRow
                        key={leg.id}
                        index={idx}
                        leg={leg}
                        crewList={data.crew}
                        prevLegStop={idx > 0 ? data.legs[idx - 1].stop : undefined}
                        onChange={handleLegChange}
                        onBatchUpdate={handleLegBatchUpdate}
                        onDelete={deleteLeg}
                        isSimulator={isSimulator}
                    />
                ))}
            </div>

            {/* FDP STATUS BANNER - MOVED BOTTOM */}
            {!isSimulator && <FDPStatusBanner legs={data.legs} aircraftReg={data.ac} />}

            {/* ADD BTN */}
            <button
                onClick={addLeg}
                style={{
                    width: '100%',
                    background: isSimulator ? '#a78bfa' : '#38bdf8',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    padding: '14px',
                    borderRadius: '8px',
                    marginTop: '20px',
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    boxShadow: `0 0 15px ${isSimulator ? 'rgba(167, 139, 250, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                }}
            >
                + ADD LEG
            </button>

            {/* CONDITION BREAKDOWN & FOOTER */}
            <div style={{ marginTop: '20px' }}>
                {/* HUD (Moved to Bottom) - ENLARGED */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        background: 'linear-gradient(180deg, rgba(2, 6, 23, 1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ color: '#10b981', fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{stats.blk}</div>
                        <div style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>TOTAL BLOCK</div>
                    </div>
                    <div style={{
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        background: 'linear-gradient(180deg, rgba(2, 6, 23, 1) 0%, rgba(56, 189, 248, 0.05) 100%)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ color: '#38bdf8', fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{stats.flt}</div>
                        <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>TOTAL FLIGHT</div>
                    </div>
                </div>

                <ConditionBreakdown
                    n={stats.n}
                    o={stats.o}
                    no={stats.no}
                    ifr={stats.ifr}
                    vfr={stats.vfr}
                    night={stats.night}
                />

                {/* CHECK FDP BUTTON */}
                {!isSimulator && onNavigateToFDP && (
                    <button
                        onClick={onNavigateToFDP}
                        style={{
                            width: '100%',
                            marginTop: '24px',
                            background: '#f59e0b', // Amber for FDP/Duty
                            color: '#0f172a',
                            fontWeight: 'bold',
                            padding: '14px',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            textTransform: 'uppercase',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        ⏱️ Check FDP & Duty
                    </button>
                )}

                {isSimulator && onSave && (
                    <button
                        onClick={onSave}
                        style={{
                            width: '100%',
                            marginTop: '24px',
                            background: '#a78bfa', // Violet accent
                            color: '#0f172a',
                            fontWeight: 'bold',
                            padding: '14px',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            textTransform: 'uppercase',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(167, 139, 250, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        💾 Save Simulator Session
                    </button>
                )}

                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => {
                            if (onReset) {
                                onReset();
                            } else {
                                const blankLeg: Leg = {
                                    id: crypto.randomUUID(),
                                    dep: '', arr: '',
                                    start: '', off: '', on: '', stop: '',
                                    pf: '', pm: '', dual: '', ip: '', condition: '',
                                    landingCount: 1, isNight: false,
                                    ifrTime: '', vfrTime: '', nightTime: '', remarks: ''
                                };
                                updateData({ ...data, legs: [blankLeg], crew: ['', '', '', ''] });
                            }
                        }}
                        style={{ background: 'transparent', textDecoration: 'underline', color: '#94a3b8', fontSize: '0.75rem' }}
                    >
                        RESET MISSION DATA
                    </button>
                </div>
            </div>

        </div >
    );
};

export default MissionDashboard;
