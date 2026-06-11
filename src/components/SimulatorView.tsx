import React from 'react';
import type { LogbookData, LogbookEntry, PilotProfile } from '../types';
import MissionDashboard from './MissionDashboard';
import { calculateTypeRatingExpiry } from '../utils/currencyTracking';

interface SimulatorViewProps {
    data: LogbookData;
    updateData: (d: LogbookData) => void;
    onSave: () => void;
    onReset: () => void;
    logbookEntries: LogbookEntry[];
    profile: PilotProfile | undefined;
}

const SimulatorView: React.FC<SimulatorViewProps> = ({
    data,
    updateData,
    onSave,
    onReset,
    logbookEntries,
    profile
}) => {
    // Calculate currency status for both type ratings
    const b300Currency = calculateTypeRatingExpiry('B300', profile, logbookEntries);
    const b200Currency = calculateTypeRatingExpiry('B200', profile, logbookEntries);

    const handleTrainingTypeChange = (val: 'LPC' | 'Recurrent' | 'Initial' | 'Other') => {
        updateData({ ...data, trainingType: val });
    };

    // Card styling based on status
    const getStatusStyle = (status: 'current' | 'warning' | 'expired' | 'none') => {
        switch (status) {
            case 'current':
                return {
                    border: '1px solid #10b981',
                    background: 'rgba(16, 185, 129, 0.05)',
                    color: '#10b981',
                    badge: { text: 'VALID', bg: '#10b981' }
                };
            case 'warning':
                return {
                    border: '1px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.05)',
                    color: '#f59e0b',
                    badge: { text: 'RENEWAL OPEN', bg: '#f59e0b' }
                };
            case 'expired':
                return {
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.05)',
                    color: '#ef4444',
                    badge: { text: 'EXPIRED / INVALID', bg: '#ef4444' }
                };
            default:
                return {
                    border: '1px solid #64748b',
                    background: 'rgba(100, 116, 139, 0.05)',
                    color: '#94a3b8',
                    badge: { text: 'NO RECORD', bg: '#64748b' }
                };
        }
    };

    const b300Style = getStatusStyle(b300Currency.status);
    const b200Style = getStatusStyle(b200Currency.status);

    const formatDateDisplay = (dateStr: string | null) => {
        if (!dateStr) return 'Not Set';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Not Set';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* TYPE RATING STATUS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                
                {/* B300 TYPE RATING */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '16px',
                    borderLeft: '4px solid #a78bfa',
                    border: b300Style.border,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>B300 Type Rating</span>
                            <span style={{
                                background: b300Style.badge.bg,
                                color: '#0f172a',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                            }}>{b300Style.badge.text}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>LPC Expiry:</span>
                                <span style={{ fontWeight: 'bold', color: b300Currency.expiryDate ? '#fff' : '#64748b' }}>
                                    {formatDateDisplay(b300Currency.expiryDate)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Renewal Window Starts:</span>
                                <span style={{ color: b300Currency.renewalStartDate ? '#fff' : '#64748b' }}>
                                    {formatDateDisplay(b300Currency.renewalStartDate)}
                                </span>
                            </div>
                            {b300Currency.lastLpcDate && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '4px' }}>
                                    <span>Last LPC logged:</span>
                                    <span>{formatDateDisplay(b300Currency.lastLpcDate)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* B200 TYPE RATING */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '16px',
                    borderLeft: '4px solid #a78bfa',
                    border: b200Style.border,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>B200 Type Rating</span>
                            <span style={{
                                background: b200Style.badge.bg,
                                color: '#0f172a',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                            }}>{b200Style.badge.text}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>LPC Expiry:</span>
                                <span style={{ fontWeight: 'bold', color: b200Currency.expiryDate ? '#fff' : '#64748b' }}>
                                    {formatDateDisplay(b200Currency.expiryDate)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Renewal Window Starts:</span>
                                <span style={{ color: b200Currency.renewalStartDate ? '#fff' : '#64748b' }}>
                                    {formatDateDisplay(b200Currency.renewalStartDate)}
                                </span>
                            </div>
                            {b200Currency.lastLpcDate && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '4px' }}>
                                    <span>Last LPC logged:</span>
                                    <span>{formatDateDisplay(b200Currency.lastLpcDate)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* SESSION CONFIGURATION CARD */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #334155',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#a78bfa', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Training / Session Type</label>
                        <select
                            value={data.trainingType || 'Recurrent'}
                            onChange={(e) => handleTrainingTypeChange(e.target.value as any)}
                            style={{
                                width: '100%',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '10px',
                                color: '#fff',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        >
                            <option value="Recurrent">Recurrent Simulator</option>
                            <option value="LPC">License Proficiency Check (LPC)</option>
                            <option value="Initial">Initial Type Rating</option>
                            <option value="Other">Other / Checkride</option>
                        </select>
                    </div>

                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#a78bfa', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aircraft Type Rating</label>
                        <select
                            value={data.fstdType || 'B300'}
                            onChange={(e) => updateData({ ...data, fstdType: e.target.value as 'B300' | 'B200' })}
                            style={{
                                width: '100%',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '10px',
                                color: '#fff',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        >
                            <option value="B300">B300 / Super King Air</option>
                            <option value="B200">B200 / King Air</option>
                        </select>
                    </div>
                </div>

                {data.trainingType === 'LPC' && (
                    <div style={{
                        background: 'rgba(167, 139, 250, 0.1)',
                        border: '1px dashed #a78bfa',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '0.8rem',
                        color: '#ddd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>💡</span>
                        <span>
                            <strong>LPC Session Selected:</strong> Saving this entry to your logbook will update your official Type Rating Expiry date.
                        </span>
                    </div>
                )}
            </div>

            {/* NESTED SIM DASHBOARD */}
            <MissionDashboard
                data={data}
                updateData={updateData}
                onSave={onSave}
                onReset={onReset}
                isSimulator={true}
            />

        </div>
    );
};

export default SimulatorView;
