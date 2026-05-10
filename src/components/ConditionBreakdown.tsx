import React from 'react';

interface ConditionBreakdownProps {
    n: string;
    o: string;
    no: string;
    ifr: string;
    vfr: string;
    night: string;
}

const ConditionBreakdown: React.FC<ConditionBreakdownProps> = ({ n, o, no, ifr, vfr, night }) => {
    return (
        <div style={{ marginTop: '20px', padding: '10px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#38bdf8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                CONDITION BREAKDOWN
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {/* NAV Box - Green Border */}
                <div style={{
                    textAlign: 'center',
                    border: '1px solid #10b981',
                    borderRadius: '6px',
                    padding: '8px',
                    background: '#020617'
                }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>{n}</div>
                    <div style={{ fontSize: '0.6rem', color: '#10b981' }}>NAV</div>
                </div>

                {/* OPR -> FLTCK */}
                <div style={{
                    textAlign: 'center',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '8px',
                    background: '#020617'
                }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>{o || '0:00'}</div>
                    <div style={{ fontSize: '0.6rem', color: '#f59e0b', marginTop: '4px' }}>FLTCK</div>
                </div>

                {/* N/O -> NAV/FLTCK */}
                <div style={{
                    textAlign: 'center',
                    border: '1px solid #a855f7',
                    borderRadius: '6px',
                    padding: '8px',
                    background: '#020617'
                }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7' }}>{no || '0:00'}</div>
                    <div style={{ fontSize: '0.6rem', color: '#a855f7', marginTop: '4px' }}>NAV/FLTCK</div>
                </div>
            </div>

            {/* Horizontal Divider */}
            <hr style={{ border: 'none', borderTop: '1px dashed #334155', margin: '16px 0' }} />

            {/* Total Times Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {/* IFR */}
                <div style={{ textAlign: 'center', padding: '8px', background: '#020617', borderRadius: '6px', border: '1px dashed #475569' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0' }}>{ifr}</div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>IFR</div>
                </div>
                {/* VFR */}
                <div style={{ textAlign: 'center', padding: '8px', background: '#020617', borderRadius: '6px', border: '1px dashed #475569' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0' }}>{vfr}</div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>VFR</div>
                </div>
                {/* NIGHT */}
                <div style={{ textAlign: 'center', padding: '8px', background: '#020617', borderRadius: '6px', border: '1px dashed #475569' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0' }}>{night}</div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>NIGHT</div>
                </div>
            </div>
        </div>
    );
};

export default ConditionBreakdown;
