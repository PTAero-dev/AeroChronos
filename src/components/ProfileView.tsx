import React, { useState, useEffect } from 'react';
import type { PilotProfile } from '../types';
import { minsToTime } from '../utils/calculations';

interface ProfileViewProps {
    profile: PilotProfile | undefined;
    onSave: (profile: PilotProfile) => void;
    onExportFullData: () => void;
    onImportFullData: (data: any) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ profile, onSave, onExportFullData, onImportFullData }) => {
    // Temporary string state for inputs (HH:MM format management)
    const [inputs, setInputs] = useState({
        pilotName: '',
        recordDate: '',
        prevTotalHours: '',
        prevPicHours: '',
        prevSicHours: '',
        prevMultiEngineHours: '',
        prevSingleEngineHours: '',
        prevNightHours: '',
        prevIfrHours: '',
        prevDualHours: '',
        prevInstructorHours: '',
        prevDayLandings: '0',
        prevNightLandings: '0',
        prevB300Hours: '',
        prevB200Hours: '',
        prevOtherHours: '',
        prevFltckHoursCaat: '',
        prevIfpHoursCaat: '',
        prevFltckHoursAbroad: '',
        prevIfpHoursAbroad: ''
    });
    const [isLocked, setIsLocked] = useState(true); // Default to locked to protect data

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Sync from props when profile changes
    useEffect(() => {
        if (profile) {
            setInputs({
                pilotName: profile.pilotName || '',
                recordDate: profile.recordDate || '',
                prevTotalHours: minsToTime(profile.prevTotalHours),
                prevPicHours: minsToTime(profile.prevPicHours),
                prevSicHours: minsToTime(profile.prevSicHours),
                prevMultiEngineHours: minsToTime(profile.prevMultiEngineHours),
                prevSingleEngineHours: minsToTime(profile.prevSingleEngineHours),
                prevNightHours: minsToTime(profile.prevNightHours),
                prevIfrHours: minsToTime(profile.prevIfrHours),
                prevDualHours: minsToTime(profile.prevDualHours || 0),
                prevInstructorHours: minsToTime(profile.prevInstructorHours || 0),
                prevDayLandings: profile.prevDayLandings.toString(),
                prevNightLandings: profile.prevNightLandings.toString(),
                prevB300Hours: minsToTime(profile.prevB300Hours || 0),
                prevB200Hours: minsToTime(profile.prevB200Hours || 0),
                prevOtherHours: minsToTime(profile.prevOtherHours || 0),
                prevFltckHoursCaat: minsToTime(profile.prevFltckHoursCaat || 0),
                prevIfpHoursCaat: minsToTime(profile.prevIfpHoursCaat || 0),
                prevFltckHoursAbroad: minsToTime(profile.prevFltckHoursAbroad || 0),
                prevIfpHoursAbroad: minsToTime(profile.prevIfpHoursAbroad || 0)
            });
        }
    }, [profile]);

    const handleChange = (field: keyof typeof inputs, value: string) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    // Parse inputs to numbers (minutes)
    const parseTime = (val: string) => {
        if (!val) return 0;

        // Remove commas if present (e.g. from copy-paste or formatted inputs)
        const cleanVal = val.replace(/,/g, '');

        // Handle colon separated values explicitly (e.g. "120:15")
        if (cleanVal.includes(':')) {
            const parts = cleanVal.split(':');
            const h = parseInt(parts[0], 10) || 0;
            // If parts[1] is missing or short, parse it safely
            const m = parseInt(parts[1] || '0', 10) || 0;
            return h * 60 + m;
        }

        // Fallback for raw HHMM (or HHHMM)
        const clean = cleanVal.replace(/[^0-9]/g, '');
        if (clean.length < 3) return parseInt(clean, 10) || 0;

        // Treat last 2 digits as minutes, rest as hours
        const m = parseInt(clean.slice(-2), 10);
        const h = parseInt(clean.slice(0, -2), 10);
        return h * 60 + m;
    };

    // Construct profile object from current inputs
    const getProfileFromInputs = (): PilotProfile => {
        return {
            pilotName: inputs.pilotName,
            recordDate: inputs.recordDate,
            prevTotalHours: parseTime(inputs.prevTotalHours),
            prevPicHours: parseTime(inputs.prevPicHours),
            prevSicHours: parseTime(inputs.prevSicHours),
            prevMultiEngineHours: parseTime(inputs.prevMultiEngineHours),
            prevSingleEngineHours: parseTime(inputs.prevSingleEngineHours),
            prevNightHours: parseTime(inputs.prevNightHours),
            prevIfrHours: parseTime(inputs.prevIfrHours),
            prevDualHours: parseTime(inputs.prevDualHours),
            prevInstructorHours: parseTime(inputs.prevInstructorHours),
            prevDayLandings: parseInt(inputs.prevDayLandings) || 0,
            prevNightLandings: parseInt(inputs.prevNightLandings) || 0,
            prevB300Hours: parseTime(inputs.prevB300Hours),
            prevB200Hours: parseTime(inputs.prevB200Hours),
            prevOtherHours: parseTime(inputs.prevOtherHours),
            prevFltckHoursCaat: parseTime(inputs.prevFltckHoursCaat),
            prevIfpHoursCaat: parseTime(inputs.prevIfpHoursCaat),
            prevFltckHoursAbroad: parseTime(inputs.prevFltckHoursAbroad),
            prevIfpHoursAbroad: parseTime(inputs.prevIfpHoursAbroad)
        };
    };

    const handleSave = () => {
        const newProfile = getProfileFromInputs();
        onSave(newProfile);
        alert('Profile saved successfully!');
    };

    const handleExportProfile = () => {
        const profileData = getProfileFromInputs();
        const dataStr = JSON.stringify(profileData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pilot_profile_${profileData.pilotName || 'export'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle Full Data Import file selection
    const handleFullDataImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => handleFullDataFileChange(e as any);
        input.click();
    };

    const handleFullDataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImportFullData(json);
                // Clear input value to allow re-importing same file if needed
                e.target.value = '';
            } catch (error) {
                alert('Error parsing JSON file');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                // Basic validation
                if (typeof imported.pilotName === 'string' && typeof imported.prevTotalHours === 'number') {
                    onSave(imported); // Update App state which will flow back down via props
                    alert('Profile imported successfully!');
                } else {
                    alert('Invalid profile file format.');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to parse profile file.');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const cardStyle = {
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        borderLeft: '4px solid #8b5cf6' // Violet accent
    };

    const headerStyle = {
        color: '#8b5cf6',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        textTransform: 'uppercase' as const,
        marginBottom: '20px',
        borderBottom: '1px solid #334155',
        paddingBottom: '10px'
    };

    const inputGroupStyle = {
        marginBottom: '16px'
    };

    const labelStyle = {
        display: 'block',
        color: '#94a3b8',
        fontSize: '0.8rem',
        marginBottom: '6px',
        textTransform: 'uppercase' as const,
        fontWeight: 'bold'
    };

    const inputStyle = {
        width: '100%',
        background: '#020617',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        color: '#fff',
        fontSize: '1rem',
        fontFamily: 'monospace', // good for aligning numbers
        opacity: isLocked ? 0.7 : 1,
        cursor: isLocked ? 'not-allowed' : 'text'
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
            {/* Import/Export Actions */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleExportProfile}
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
                    📥 Export Profile
                </button>
                <button
                    onClick={handleImportClick}
                    style={{
                        padding: '8px 16px',
                        background: '#10b981', // Green for Import
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                    }}
                >
                    📤 Import Profile
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            <div style={cardStyle}>
                <div style={{ ...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Initial Experience</span>
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        style={{
                            background: 'transparent',
                            border: '1px solid ' + (isLocked ? '#10b981' : '#ef4444'),
                            color: isLocked ? '#10b981' : '#ef4444',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {isLocked ? '🔒 LOCKED' : '🔓 EDIT'}
                    </button>
                </div>

                <div style={{ color: '#cbd5e1', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Enter your total Previous Experience hours here. These will be added to your calculated totals from the logbook to give you your accurate Lifetime Totals.
                </div>

                {/* Metadata Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>CREW INITIAL NAME</label>
                        <input
                            value={inputs.pilotName}
                            onChange={e => {
                                const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
                                handleChange('pilotName', val);
                            }}
                            placeholder="XX"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>DATE INPUT</label>
                        <input
                            type="date"
                            value={inputs.recordDate}
                            onChange={e => handleChange('recordDate', e.target.value)}
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                {/* Hours Section */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev TOTAL TIME</label>
                        <input
                            value={inputs.prevTotalHours}
                            onChange={e => handleChange('prevTotalHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev PIC</label>
                        <input
                            value={inputs.prevPicHours}
                            onChange={e => handleChange('prevPicHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev SIC</label>
                        <input
                            value={inputs.prevSicHours}
                            onChange={e => handleChange('prevSicHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev IFR</label>
                        <input
                            value={inputs.prevIfrHours}
                            onChange={e => handleChange('prevIfrHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev NIGHT</label>
                        <input
                            value={inputs.prevNightHours}
                            onChange={e => handleChange('prevNightHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev DUAL</label>
                        <input
                            value={inputs.prevDualHours}
                            onChange={e => handleChange('prevDualHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev INSTRUCTOR</label>
                        <input
                            value={inputs.prevInstructorHours}
                            onChange={e => handleChange('prevInstructorHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #334155', margin: '20px 0' }}></div>

                {/* Class/Type & Landings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev MULTI-ENGINE</label>
                        <input
                            value={inputs.prevMultiEngineHours}
                            onChange={e => handleChange('prevMultiEngineHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev SINGLE-ENGINE</label>
                        <input
                            value={inputs.prevSingleEngineHours}
                            onChange={e => handleChange('prevSingleEngineHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev DAY LDG</label>
                        <input
                            type="number"
                            value={inputs.prevDayLandings}
                            onChange={e => handleChange('prevDayLandings', e.target.value)}
                            placeholder="0"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev NIGHT LDG</label>
                        <input
                            type="number"
                            value={inputs.prevNightLandings}
                            onChange={e => handleChange('prevNightLandings', e.target.value)}
                            placeholder="0"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                {/* Aircraft Type Hours */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev B300</label>
                        <input
                            value={inputs.prevB300Hours}
                            onChange={e => handleChange('prevB300Hours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev B200</label>
                        <input
                            value={inputs.prevB200Hours}
                            onChange={e => handleChange('prevB200Hours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev OTHER</label>
                        <input
                            value={inputs.prevOtherHours}
                            onChange={e => handleChange('prevOtherHours', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #334155', margin: '20px 0' }}></div>

                {/* FIVP Experience Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev FLTCK EXPERIENCE (CAAT)</label>
                        <input
                            value={inputs.prevFltckHoursCaat}
                            onChange={e => handleChange('prevFltckHoursCaat', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev FLTCK EXPERIENCE (ABROAD)</label>
                        <input
                            value={inputs.prevFltckHoursAbroad}
                            onChange={e => handleChange('prevFltckHoursAbroad', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev IFP EXPERIENCE (CAAT)</label>
                        <input
                            value={inputs.prevIfpHoursCaat}
                            onChange={e => handleChange('prevIfpHoursCaat', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Prev IFP EXPERIENCE (Abroad)</label>
                        <input
                            value={inputs.prevIfpHoursAbroad}
                            onChange={e => handleChange('prevIfpHoursAbroad', e.target.value)}
                            placeholder="HH:MM"
                            style={inputStyle}
                            disabled={isLocked}
                        />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #334155', margin: '20px 0' }}></div>

                {/* FULL DATA BACKUP / RESTORE */}
                <div style={{ marginBottom: '24px', background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #475569' }}>
                    <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💾 FULL DATA BACKUP</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                        Backup or restore your entire logbook, including Profile, Logbook Entries, and FIVP Experience data in a single file.
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            onClick={onExportFullData}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #3b82f6',
                                color: '#3b82f6',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>⬇️ BACKUP ALL DATA</span>
                        </button>
                        <button
                            onClick={handleFullDataImportClick}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #10b981',
                                color: '#10b981',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <span>⬆️ RESTORE DATA</span>
                        </button>
                    </div>
                </div>

                {/* Validation Warnings */}
                {(() => {
                    const total = parseTime(inputs.prevTotalHours);
                    const pic = parseTime(inputs.prevPicHours);
                    const sic = parseTime(inputs.prevSicHours);
                    const me = parseTime(inputs.prevMultiEngineHours);
                    const se = parseTime(inputs.prevSingleEngineHours);
                    const b300 = parseTime(inputs.prevB300Hours);
                    const b200 = parseTime(inputs.prevB200Hours);
                    const other = parseTime(inputs.prevOtherHours);

                    const picSicSum = pic + sic;
                    const meSeSum = me + se;
                    const typeSum = b300 + b200 + other;

                    const warnings = [];

                    if (total > 0 && Math.abs(total - picSicSum) > 1) { // 1 min tolerance
                        warnings.push(
                            <div key="pic-sic" style={{
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                color: '#ef4444',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>⚠️</span>
                                <div>
                                    <strong>Mismatch:</strong> Total Time ({minsToTime(total)}) ≠ PIC + SIC ({minsToTime(picSicSum)})
                                </div>
                            </div>
                        );
                    }

                    if (total > 0 && Math.abs(total - meSeSum) > 1) {
                        warnings.push(
                            <div key="me-se" style={{
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                color: '#ef4444',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>⚠️</span>
                                <div>
                                    <strong>Mismatch:</strong> Total Time ({minsToTime(total)}) ≠ Multi + Single ({minsToTime(meSeSum)})
                                </div>
                            </div>
                        );
                    }

                    if (total > 0 && Math.abs(total - typeSum) > 1) {
                        warnings.push(
                            <div key="type-sum" style={{
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid #ef4444',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                color: '#ef4444',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>⚠️</span>
                                <div>
                                    <strong>Mismatch:</strong> Total Time ({minsToTime(total)}) ≠ B300 + B200 + Others ({minsToTime(typeSum)})
                                </div>
                            </div>
                        );
                    }

                    return warnings;
                })()}

                <button
                    onClick={handleSave}
                    disabled={isLocked}
                    style={{
                        width: '100%',
                        background: isLocked ? '#475569' : '#8b5cf6',
                        color: isLocked ? '#94a3b8' : '#fff',
                        padding: '16px',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: '10px'
                    }}
                >
                    SAVE PROFILE
                </button>
                {isLocked && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', marginTop: '10px' }}>Unlock to make changes</div>}

            </div>
        </div>
    );
};

export default ProfileView;
