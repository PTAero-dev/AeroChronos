import React from 'react';
import type { LogbookData } from '../types';
import { focusNextInput } from '../utils/ux';

interface MissionInputsProps {
    data: LogbookData;
    onChange: (field: keyof LogbookData, value: any) => void;
}

const MissionInputs: React.FC<MissionInputsProps> = ({ data, onChange }) => {

    const handleCrewChange = (index: number, val: string) => {
        const newVal = val.toUpperCase().slice(0, 2);
        const newCrew = [...data.crew] as [string, string, string, string];
        newCrew[index] = newVal;
        onChange('crew', newCrew);

        if (newVal.length === 2 && index < 3) {
            focusNextInput(`crew-${index}`, `crew-${index + 1}`, newVal, 2);
        }
    };

    const inputStyle: React.CSSProperties = {
        background: '#020617',
        color: '#ffffff',
        border: '1px solid var(--input-border)',
        width: '100%',
        padding: '12px',
        borderRadius: '12px',
        fontSize: '1rem',
        textAlign: 'center',
        fontWeight: 'bold',
        appearance: 'none',
        WebkitAppearance: 'none'
    };

    return (
        <div className="card">
            <h2 style={{
                color: 'var(--text-highlight)',
                margin: '0 0 16px 0',
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '1px'
            }}>
                MISSION DETAILS
            </h2>

            <div className="grid-2" style={{ marginBottom: '20px' }}>
                <div>
                    <label>DATE</label>
                    <input
                        type="date"
                        value={data.date}
                        className="glass-input" // kept for any global hooks
                        onChange={(e) => onChange('date', e.target.value)}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                    />
                </div>
                <div>
                    <label>AIRCRAFT</label>
                    <select
                        value={data.ac}
                        onChange={(e) => onChange('ac', e.target.value)}
                        style={{ ...inputStyle, fontWeight: 'bold' }}
                    >
                        <option value="HS-AIM">HS-AIM</option>
                        <option value="HS-PBN">HS-PBN</option>
                        <option value="HS-DCF">HS-DCF</option>
                        <option value="HS-ATS">HS-ATS</option>
                    </select>
                </div>
            </div>

            <label>P1 — CREW INITIALS — P4</label>
            <div className="grid-4" style={{ gap: '10px' }}>
                {[0, 1, 2, 3].map((i) => (
                    <input
                        key={i}
                        id={`crew-${i}`}
                        type="text"
                        placeholder={`P${i + 1}`}
                        value={data.crew[i]}
                        maxLength={2}
                        onChange={(e) => handleCrewChange(i, e.target.value)}
                        className="uppercase"
                        style={{
                            ...inputStyle,
                            fontSize: '1.2rem',
                            background: data.crew[i] ? '#0ea5e9' : '#020617',
                            color: '#ffffff',
                            border: data.crew[i] ? '1px solid #38bdf8' : '1px solid var(--input-border)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default MissionInputs;
