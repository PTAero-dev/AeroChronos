import React from 'react';

interface HUDProps {
    totalBlock: string;
    totalFlight: string;
}

const HUD: React.FC<HUDProps> = ({ totalBlock, totalFlight }) => {
    return (
        <div className="hud-panel" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '10px',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.1) inset'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontSize: '1.4rem',
                    fontWeight: 'bold',
                    fontFamily: 'var(--digital-font)',
                    color: '#fff',
                    textShadow: '0 0 5px rgba(255,255,255,0.3)'
                }}>
                    {totalBlock}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)', letterSpacing: '1px', marginTop: '2px' }}>
                    TOTAL BLOCK
                </div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                <div style={{
                    fontSize: '1.4rem',
                    fontWeight: 'bold',
                    fontFamily: 'var(--digital-font)',
                    color: 'var(--accent-green)',
                    textShadow: '0 0 5px rgba(16, 185, 129, 0.3)'
                }}>
                    {totalFlight}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-green)', letterSpacing: '1px', marginTop: '2px' }}>
                    TOTAL FLIGHT
                </div>
            </div>
        </div>
    );
};

export default HUD;
