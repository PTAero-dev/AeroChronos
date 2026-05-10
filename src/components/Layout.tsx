import React, { type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Tab } from '../types';

interface LayoutProps {
    children: ReactNode;
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    user?: User | null;
    onSignOut?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, user, onSignOut }) => {
    return (
        <div className="app-container">
            {/* Sticky Tab Nav */}
            <div className="tab-nav" style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid var(--border)',
                marginBottom: '20px',
                overflow: 'hidden',
                width: '100%',
            }}>
                {/* Inner scrollable strip — buttons size to content, bar scrolls, page never widens */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '10px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                } as React.CSSProperties}>
                <button
                    className={`tab-btn ${activeTab === 'mission' ? 'active' : ''}`}
                    onClick={() => onTabChange('mission')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'mission' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'mission' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    FLIGHT
                </button>
                <button
                    className={`tab-btn ${activeTab === 'duty' ? 'active' : ''}`}
                    onClick={() => onTabChange('duty')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'duty' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'duty' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    FDP
                </button>
                <button
                    className={`tab-btn ${activeTab === 'logbook' ? 'active' : ''}`}
                    onClick={() => onTabChange('logbook')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'logbook' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'logbook' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    LOGBOOK
                </button>
                <button
                    className={`tab-btn ${activeTab === 'fltck' ? 'active' : ''}`}
                    onClick={() => onTabChange('fltck')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'fltck' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'fltck' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                    }}
                >
                    FIVP EXP.
                </button>
                <button
                    className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
                    onClick={() => onTabChange('calculator')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'calculator' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'calculator' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    PER DIEM / HOTEL
                </button>
                <button
                    className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => onTabChange('profile')}
                    style={{
                        flex: '0 0 auto',
                        background: activeTab === 'profile' ? 'var(--accent-cyan)' : 'transparent',
                        color: activeTab === 'profile' ? '#0f172a' : 'var(--text-muted)',
                        border: '1px solid var(--accent-cyan)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    ⚙️ PROFILE
                </button>
                </div>
            </div>

            <main className="tab-content active">
                {children}
            </main>

            <footer className="footer" style={{
                textAlign: 'center',
                fontSize: '0.65rem',
                color: '#475569',
                marginTop: '30px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                borderTop: '1px solid #1e293b',
                paddingTop: '15px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
            }}>
                <span>&copy; AEROTHAI FLIGHT INSPECTION CENTER</span>
                {user && onSignOut && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#334155', fontSize: '0.7rem' }}>
                            {user.email}
                        </span>
                        <button
                            onClick={onSignOut}
                            style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#ef4444',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                letterSpacing: '1px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </footer>
        </div>
    );
};

export default Layout;
