import React, { useState, useEffect, useMemo } from 'react';

interface CalculatorSettings {
    allowanceRate: number;
    hotelRate: number;
    startOffset: number; // hours to subtract
    endOffset: number;   // hours to add
    abroadAllowanceRate?: number;
    exchangeRate?: number;
}

const DEFAULT_SETTINGS: CalculatorSettings = {
    allowanceRate: 7500, // THB
    hotelRate: 4000,
    startOffset: 3, // hours deduction
    endOffset: 3, // hours addition
    abroadAllowanceRate: 90, // USD
    exchangeRate: 33 // THB/USD
};

const TimeCalculatorView: React.FC = () => {
    // Helper for decimal inputs to avoid cursor/value jumping
    const DecimalInput = ({ value, onChange, style, step = "0.01" }: { value: number, onChange: (n: number) => void, style?: React.CSSProperties, step?: string }) => {
        const [strVal, setStrVal] = useState(value.toString());

        useEffect(() => {
            // Only sync if the numeric value is different (external update), 
            // but ignore if it's just a formatting difference (e.g. "33." vs 33) to allow typing.
            if (parseFloat(strVal) !== value) {
                setStrVal(value.toString());
            }
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value;
            setStrVal(v);
            const num = parseFloat(v);
            if (!isNaN(num)) {
                onChange(num);
            } else if (v === '') {
                onChange(0);
            }
        };

        return <input type="number" step={step} value={strVal} onChange={handleChange} style={style} />;
    };

    // -- State --
    // Settings
    const [settings, setSettings] = useState<CalculatorSettings>(() => {
        const saved = localStorage.getItem('per_diem_settings');
        // Merge saved settings with default settings to ensure new properties are present
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });

    // Inputs
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState(''); // HHMM format
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState(''); // HHMM format

    // Flags
    const [isAbroad, setIsAbroad] = useState(false); // Controlled by Tabs
    const [showOffsets, setShowOffsets] = useState(false); // Toggle for Offsets Visibility

    // Overrides (null means use calculated)
    const [overrideAllowanceDays, setOverrideAllowanceDays] = useState<number | null>(null);
    const [overrideHotelNights, setOverrideHotelNights] = useState<number | null>(null);

    // UI Toggle
    const [showSettings, setShowSettings] = useState(false);

    // -- Persistence --
    useEffect(() => {
        localStorage.setItem('per_diem_settings', JSON.stringify(settings));
    }, [settings]);

    // -- Handlers --
    const handleTimeChange = (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
        const clean = val.replace(/\D/g, '').slice(0, 4);
        if (clean.length >= 2) {
            const hh = parseInt(clean.slice(0, 2));
            if (hh > 23) return;
        }
        if (clean.length >= 4) {
            const mm = parseInt(clean.slice(2, 4));
            if (mm > 59) return;
        }
        setter(clean);
    };

    const formatTimeForDate = (hhmm: string) => {
        if (hhmm.length < 4) return null;
        const hh = hhmm.slice(0, 2);
        const mm = hhmm.slice(2, 4);
        return `${hh}:${mm}`;
    };

    // -- Calculations --
    const calculationResult = useMemo(() => {
        if (!startDate || startTime.length < 4 || !endDate || endTime.length < 4) {
            return null;
        }

        const startT = formatTimeForDate(startTime);
        const endT = formatTimeForDate(endTime);

        if (!startT || !endT) return null;

        const start = new Date(`${startDate}T${startT}`);
        const end = new Date(`${endDate}T${endT}`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

        // Apply Offsets if Domestic (Always applied for Domestic)
        const applyOffsets = !isAbroad;
        const effectiveStart = new Date(start.getTime() - (applyOffsets ? settings.startOffset : 0) * 60 * 60 * 1000);
        const effectiveEnd = new Date(end.getTime() + (applyOffsets ? settings.endOffset : 0) * 60 * 60 * 1000);

        const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
        const durationMins = Math.floor(durationMs / 60000);

        if (durationMins < 0) return { error: "End time cannot be before Start time" };

        const totalHours = Math.floor(durationMins / 60);
        const displayDays = Math.floor(totalHours / 24);
        const displayHours = totalHours % 24;
        const displayMins = durationMins % 60;

        let allowanceDays = displayDays;
        const residualMins = (displayHours * 60) + displayMins;

        let additionalProps = 0;
        if (residualMins >= 12 * 60) {
            additionalProps = 1;
        } else if (!isAbroad && residualMins > 6 * 60) {
            // Half day only for Domestic if > 6 hours (i.e. >= 6h 1m)
            additionalProps = 0.5;
        }
        allowanceDays += additionalProps;

        let hotelNights = 0;
        if (!isAbroad) { // Hotel only for domestic
            const startDay = new Date(startDate);
            const endDay = new Date(endDate);
            const diffTime = Math.abs(endDay.getTime() - startDay.getTime());
            hotelNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
            effectiveStart,
            effectiveEnd,
            duration: { days: displayDays, hours: displayHours, mins: displayMins },
            calcAllowanceDays: allowanceDays,
            calcHotelNights: hotelNights
        };

    }, [startDate, startTime, endDate, endTime, settings, isAbroad, showOffsets]);

    // Guides
    const guides = useMemo(() => {
        if (!startDate || startTime.length < 4) return null;
        const startT = formatTimeForDate(startTime);
        if (!startT) return null;

        const start = new Date(`${startDate}T${startT}`);
        if (isNaN(start.getTime())) return null;

        const applyOffsets = !isAbroad;
        const effectiveStartMs = start.getTime() - ((applyOffsets ? settings.startOffset : 0) * 60 * 60 * 1000);

        const targetEffEndMs_1d = effectiveStartMs + (12 * 60 * 60 * 1000);
        const targetRawEndMs_1d = targetEffEndMs_1d - ((applyOffsets ? settings.endOffset : 0) * 60 * 60 * 1000);

        let targetRawEndMs_05d = null;
        if (!isAbroad) { // Half day guide only for Domestic
            const targetEffEndMs_05d = effectiveStartMs + (6 * 60 * 60 * 1000);
            targetRawEndMs_05d = targetEffEndMs_05d - ((applyOffsets ? settings.endOffset : 0) * 60 * 60 * 1000);
        }

        return {
            oneDay: new Date(targetRawEndMs_1d),
            halfDay: targetRawEndMs_05d ? new Date(targetRawEndMs_05d) : null
        };
    }, [startDate, startTime, settings, isAbroad, showOffsets]);

    // -- Derived Finals --
    const finalAllowanceDays = overrideAllowanceDays !== null
        ? overrideAllowanceDays
        : (calculationResult?.calcAllowanceDays || 0);

    const finalHotelNights = overrideHotelNights !== null
        ? overrideHotelNights
        : (calculationResult?.calcHotelNights || 0);

    // Calculate Total based on Mode
    let totalAllowance = 0;
    if (isAbroad) {
        // Abroad Logic: Days * USD Rate * Exchange Rate
        totalAllowance = finalAllowanceDays * (settings.abroadAllowanceRate || 90) * (settings.exchangeRate || 1);
    } else {
        // Domestic Logic: Days * THB Rate
        totalAllowance = finalAllowanceDays * settings.allowanceRate;
    }

    // Hotel only for domestic
    const totalHotel = !isAbroad ? (finalHotelNights * settings.hotelRate) : 0;
    const grandTotal = totalAllowance + totalHotel;

    // -- Styles --
    const inputStyle: React.CSSProperties = {
        background: '#020617',
        border: '1px solid #334155',
        color: '#fff',
        padding: '10px',
        borderRadius: '6px',
        width: '100%',
        boxSizing: 'border-box',
        fontSize: '0.9rem'
    };

    const timeInputStyle: React.CSSProperties = {
        ...inputStyle,
        textAlign: 'center',
        letterSpacing: '2px'
    };

    const labelStyle: React.CSSProperties = {
        color: '#94a3b8',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        marginBottom: '6px',
        display: 'block',
        fontWeight: 'bold'
    };

    const cardStyle: React.CSSProperties = {
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #334155',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    };

    const tabStyle = (active: boolean): React.CSSProperties => ({
        flex: 1,
        padding: '10px',
        background: active ? '#38bdf8' : '#0f172a',
        color: active ? '#0f172a' : '#94a3b8',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s'
    });

    const formatDateTime = (d: Date) => {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
            d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ color: '#f8fafc', margin: 0, fontSize: '1.2rem' }}>💰 Per Diem / Hotel</h2>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.7 }}
                    title="Settings"
                >
                    ⚙️
                </button>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #334155' }}>
                <button style={tabStyle(!isAbroad)} onClick={() => setIsAbroad(false)}>DOMESTIC 🇹🇭</button>
                <button style={tabStyle(isAbroad)} onClick={() => setIsAbroad(true)}>ABROAD ✈️</button>
            </div>

            {/* Settings Components */}
            {showSettings && (
                <div style={{ ...cardStyle }}>
                    <h3 style={{ marginTop: 0, color: '#f59e0b', fontSize: '0.9rem', textTransform: 'uppercase' }}>Settings</h3>

                    {!isAbroad ? (
                        /* Domestic Settings */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Allowance (THB)</label>
                                <input
                                    type="number"
                                    value={settings.allowanceRate}
                                    onChange={e => setSettings({ ...settings, allowanceRate: parseFloat(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Hotel (THB)</label>
                                <input
                                    type="number"
                                    value={settings.hotelRate}
                                    onChange={e => setSettings({ ...settings, hotelRate: parseFloat(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Abroad Settings */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Allowance (USD)</label>
                                <DecimalInput
                                    value={settings.abroadAllowanceRate !== undefined ? settings.abroadAllowanceRate : 90}
                                    onChange={v => setSettings({ ...settings, abroadAllowanceRate: v })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Exchange Rate (THB)</label>
                                <DecimalInput
                                    step="0.01"
                                    value={settings.exchangeRate !== undefined ? settings.exchangeRate : 33}
                                    onChange={v => setSettings({ ...settings, exchangeRate: v })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Inputs - START */}
            <div style={{ ...cardStyle }}>
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ ...labelStyle, color: '#38bdf8' }}>TRIP START</label>
                        {!isAbroad && (
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                <div style={{
                                    width: '36px', height: '20px',
                                    background: showOffsets ? '#10b981' : '#334155',
                                    borderRadius: '10px', position: 'relative', transition: 'all 0.2s'
                                }}>
                                    <div style={{
                                        width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
                                        position: 'absolute', top: '2px',
                                        left: showOffsets ? '18px' : '2px',
                                        transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: showOffsets ? '#10b981' : '#94a3b8', fontWeight: 'bold' }}>Adjust Offsets</span>
                                <input type="checkbox" checked={showOffsets} onChange={e => setShowOffsets(e.target.checked)} style={{ display: 'none' }} />
                            </label>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '10px' }}>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={inputStyle}
                        />
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={startTime}
                            onChange={e => handleTimeChange(e.target.value, setStartTime)}
                            style={timeInputStyle}
                            placeholder="HHMM"
                            maxLength={4}
                        />
                    </div>

                    {/* Start Offset Input - Only if Domestic & Toggled */}
                    {showOffsets && !isAbroad && (
                        <div style={{ marginTop: '8px', background: '#0f172a', padding: '10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Start Offset (-h):</span>
                            <input
                                type="number"
                                value={settings.startOffset}
                                onChange={e => setSettings({ ...settings, startOffset: parseFloat(e.target.value) || 0 })}
                                style={{ ...inputStyle, width: '80px', padding: '4px', textAlign: 'center' }}
                            />
                        </div>
                    )}

                    {guides && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                            {guides.halfDay && (
                                <div style={{ color: '#94a3b8' }}>
                                    💡 0.5D: <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{formatDateTime(guides.halfDay)}</span>
                                </div>
                            )}
                            <div style={{ color: '#94a3b8' }}>
                                💡 1.0D: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatDateTime(guides.oneDay)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Inputs - END */}
                <div>
                    <label style={{ ...labelStyle, color: '#38bdf8' }}>TRIP END</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '10px' }}>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={inputStyle}
                        />
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={endTime}
                            onChange={e => handleTimeChange(e.target.value, setEndTime)}
                            style={timeInputStyle}
                            placeholder="HHMM"
                            maxLength={4}
                        />
                    </div>

                    {/* End Offset Input - Only if Domestic & Toggled */}
                    {showOffsets && !isAbroad && (
                        <div style={{ marginTop: '8px', background: '#0f172a', padding: '10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>End Offset (+h):</span>
                            <input
                                type="number"
                                value={settings.endOffset}
                                onChange={e => setSettings({ ...settings, endOffset: parseFloat(e.target.value) || 0 })}
                                style={{ ...inputStyle, width: '80px', padding: '4px', textAlign: 'center' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Results */}
            {calculationResult && !('error' in calculationResult) && (
                <>
                    {/* Duration Info */}
                    <div style={{
                        background: '#0f172a',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '20px',
                        border: '1px dashed #334155',
                        textAlign: 'center'
                    }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>
                            EFFECTIVE DURATION
                        </div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {calculationResult.duration.days} Days, {calculationResult.duration.hours} Hours, {calculationResult.duration.mins} Mins
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
                            {formatDateTime(calculationResult.effectiveStart)} — {formatDateTime(calculationResult.effectiveEnd)}
                        </div>
                    </div>

                    {/* Allowances */}
                    <div style={{ ...cardStyle, borderLeft: '4px solid #10b981' }}>
                        {/* Allowance Line */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #334155' }}>
                            <div>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>Allowance</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {isAbroad ? `(Days x ${settings.abroadAllowanceRate || 90} USD x ${settings.exchangeRate || 33})` : 'Full + Half Days (THB)'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={finalAllowanceDays}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setOverrideAllowanceDays(isNaN(val) ? 0 : val);
                                    }}
                                    style={{ ...inputStyle, width: '80px', textAlign: 'center', borderColor: overrideAllowanceDays !== null ? '#f59e0b' : '#334155' }}
                                />
                            </div>
                        </div>

                        {/* Hotel Line */}
                        {!isAbroad && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ color: '#fff', fontWeight: 'bold' }}>Hotel Nights</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Auto-calc</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        step="1"
                                        value={finalHotelNights}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setOverrideHotelNights(isNaN(val) ? 0 : val);
                                        }}
                                        style={{ ...inputStyle, width: '80px', textAlign: 'center', borderColor: overrideHotelNights !== null ? '#f59e0b' : '#334155' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Total */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid #334155'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#94a3b8' }}>
                                Allowance ({finalAllowanceDays}d × {(isAbroad ? ((settings.abroadAllowanceRate || 90) * (settings.exchangeRate || 33)) : settings.allowanceRate).toLocaleString()})
                            </span>
                            <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalAllowance.toLocaleString()} THB</span>
                        </div>
                        {!isAbroad && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: '#94a3b8' }}>Hotel ({finalHotelNights} x {settings.hotelRate})</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalHotel.toLocaleString()} THB</span>
                            </div>
                        )}
                        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.2rem' }}>TOTAL</span>
                            <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.5rem' }}>{grandTotal.toLocaleString()} THB</span>
                        </div>
                    </div>
                </>
            )}

            {calculationResult && 'error' in calculationResult && (
                <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {calculationResult.error}
                </div>
            )}
        </div>
    );
};

export default TimeCalculatorView;
