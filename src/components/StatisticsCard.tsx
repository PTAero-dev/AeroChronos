import React, { useState, useMemo, useEffect } from 'react';
import type { LogbookEntry, PilotProfile } from '../types';
import { getAircraftStats, getOverallStats, getMonthlyStats, getCurrencyColor } from '../utils/logbookStats';
import { exportLogbookEntries, importLogbookEntries } from '../utils/flightDataIO';
import { minsToTime } from '../utils/calculations';

interface StatisticsCardProps {
    logbookEntries: LogbookEntry[];
    profile?: PilotProfile;
    onImportLogbook: (entries: LogbookEntry[]) => void;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ logbookEntries, profile, onImportLogbook }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    });

    const [dateRangeStart, setDateRangeStart] = useState('');
    const [dateRangeEnd, setDateRangeEnd] = useState('');

    // Calculate statistics
    const userInitials = profile?.pilotName ? profile.pilotName.trim().toUpperCase() : 'PT';
    const overallStats = useMemo(() => getOverallStats(logbookEntries, userInitials, profile), [logbookEntries, profile, userInitials]);
    const aircraftStats = useMemo(() => getAircraftStats(logbookEntries), [logbookEntries]);
    const monthlyStats = useMemo(() => getMonthlyStats(logbookEntries, selectedMonth), [logbookEntries, selectedMonth]);

    const dateRangeStats = useMemo(() => {
        if (dateRangeStart && dateRangeEnd) {
            let b300 = 0;
            let b200 = 0;
            let others = 0;

            const start = dateRangeStart;
            const end = dateRangeEnd;

            const filtered = logbookEntries.filter(e => e.date >= start && e.date <= end);

            filtered.forEach(entry => {
                const ac = entry.ac.toUpperCase().replace(/[^A-Z]/g, '');
                let type = 'OTHERS';
                if (['HSAIM', 'HSPBN'].includes(ac)) type = 'B300';
                else if (['HSATS', 'HSDCF'].includes(ac)) type = 'B200';

                let legTotal = entry.totalBlock;

                if (type === 'B300') b300 += legTotal;
                else if (type === 'B200') b200 += legTotal;
                else others += legTotal;
            });

            return {
                totalHours: b300 + b200 + others,
                byAircraft: {
                    'B300': b300,
                    'B200': b200,
                    'Others': others
                }
            };
        }
        return null;
    }, [logbookEntries, dateRangeStart, dateRangeEnd, userInitials]);

    // Quick date range presets
    const setQuickRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        // Format without timezone conversion
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        let startStr = formatDate(start);

        // Clamp start date to profile record date if exists
        if (profile?.recordDate && startStr < profile.recordDate) {
            startStr = profile.recordDate;
        }

        setDateRangeStart(startStr);
        setDateRangeEnd(formatDate(end));
    };

    const handleExportMonth = () => {
        const entriesToExport = logbookEntries.filter(e => e.date.startsWith(selectedMonth));
        if (entriesToExport.length === 0) {
            alert('No flights found in selected month to export.');
            return;
        }
        exportLogbookEntries(entriesToExport, `flight_log_${selectedMonth}.json`);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Get existing entry IDs for deduplication
        const existingIds = new Set(logbookEntries.map(entry => entry.id));

        let totalImported = 0;
        let totalSkipped = 0;
        let processedFiles = 0;
        let failedFiles = 0;
        let allNewEntries: LogbookEntry[] = [];

        const processFile = async (file: File): Promise<void> => {
            try {
                const data = await importLogbookEntries(file);

                // Filter out duplicates (entries with same ID or same date+ac combination)
                const newEntries = data.filter(entry => {
                    // Check by ID
                    if (existingIds.has(entry.id)) {
                        return false;
                    }
                    // Check by date + aircraft combination (additional safety check)
                    const isDuplicate = logbookEntries.some(existing =>
                        existing.date === entry.date &&
                        existing.ac === entry.ac &&
                        existing.totalBlock === entry.totalBlock
                    );
                    // Also check against already-processed entries from other files
                    const isDuplicateInBatch = allNewEntries.some(existing =>
                        existing.date === entry.date &&
                        existing.ac === entry.ac &&
                        existing.totalBlock === entry.totalBlock
                    );
                    return !isDuplicate && !isDuplicateInBatch;
                });

                // Add to merged list
                newEntries.forEach(entry => {
                    existingIds.add(entry.id);
                    allNewEntries.push(entry);
                });

                totalImported += newEntries.length;
                totalSkipped += data.length - newEntries.length;
                processedFiles++;
            } catch (error) {
                failedFiles++;
            }
        };

        // Process all files
        await Promise.all(Array.from(files).map(file => processFile(file)));

        // Import all new entries
        if (allNewEntries.length > 0) {
            onImportLogbook(allNewEntries);
        }

        // Show summary
        let message = `✅ Processed ${processedFiles} file(s)\n`;
        message += `📋 Imported ${totalImported} new entries`;
        if (totalSkipped > 0) {
            message += `\n⏭️ Skipped ${totalSkipped} duplicate entries`;
        }
        if (failedFiles > 0) {
            message += `\n⚠️ Failed to process ${failedFiles} file(s)`;
        }
        alert(message);

        // Reset
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (profile?.recordDate && val && val < profile.recordDate) {
            alert(`Cannot query dates before your Initial Experience date (${profile.recordDate})`);
            return;
        }
        setDateRangeStart(val);
    };

    const cardStyle = {
        background: '#1e293b',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #334155'
    };

    const headerStyle = {
        color: '#a78bfa',
        fontSize: '0.9rem',
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        marginBottom: '16px',
        borderLeft: '4px solid #a78bfa',
        paddingLeft: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
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
        fontWeight: 'bold' as const
    };

    const valueStyle = {
        fontSize: '1.2rem',
        fontWeight: 'bold' as const,
        color: '#fff'
    };

    // Calculate last flight date for display
    const lastFlightDisplay = useMemo(() => {
        if (logbookEntries.length === 0) return 'N/A';
        const dates = logbookEntries.map(e => e.date).sort();
        const last = dates[dates.length - 1]; // YYYY-MM-DD
        if (!last) return 'N/A';
        const [y, m, d] = last.split('-');
        return `${d}/${m}/${y}`;
    }, [logbookEntries]);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{ ...cardStyle, borderLeft: '4px solid #a78bfa' }}>
            <div style={headerStyle}>
                <span>📊 Statistics</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>
                    Until {lastFlightDisplay}
                </span>
            </div>

            {/* QUICK STATS */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>LIFETIME TOTALS</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
                    {/* Row 1 */}
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#10b981' }}>{minsToTime(overallStats.totalBlock)}</div>
                        <div style={labelStyle}>TOTAL HR.</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#38bdf8' }}>{minsToTime(overallStats.totalPIC)}</div>
                        <div style={labelStyle}>PIC</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#f59e0b' }}>{minsToTime(overallStats.totalSIC)}</div>
                        <div style={labelStyle}>SIC</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#a78bfa' }}>{minsToTime(overallStats.totalNight)}</div>
                        <div style={labelStyle}>NIGHT</div>
                    </div>

                    {/* Row 2 */}
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#94a3b8' }}>{minsToTime(overallStats.totalDual)}</div>
                        <div style={labelStyle}>DUAL</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={{ ...valueStyle, color: '#94a3b8' }}>{minsToTime(overallStats.totalInstructor)}</div>
                        <div style={labelStyle}>IP</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{overallStats.totalDayLandings}</div>
                        <div style={labelStyle}>Day Ldg</div>
                    </div>
                    <div style={boxStyle}>
                        <div style={valueStyle}>{overallStats.totalNightLandings}</div>
                        <div style={labelStyle}>Night Ldg</div>
                    </div>
                </div>
            </div>

            {/* AIRCRAFT CURRENCY */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>AIRCRAFT CURRENCY (90-Day)</div>
                {aircraftStats.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '12px' }}>No flights logged yet</div>
                ) : (
                    aircraftStats.map(stat => (
                        <div
                            key={stat.model}
                            style={{
                                background: '#020617',
                                borderRadius: '6px',
                                padding: '10px',
                                marginBottom: '8px',
                                borderLeft: `3px solid ${getCurrencyColor(stat.currencyStatus)}`
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
                                        {stat.currencyStatus === 'current' && '✓ '}
                                        {stat.currencyStatus === 'warning' && '⚠️ '}
                                        {stat.currencyStatus === 'expired' && '❌ '}
                                        {stat.model}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                        {stat.registrations.join(', ')}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: getCurrencyColor(stat.currencyStatus), fontWeight: 'bold' }}>
                                        {stat.daysSinceLastFlight} days ago
                                    </div>
                                    {stat.currencyStatus === 'warning' && (
                                        <div style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                                            {90 - stat.daysSinceLastFlight} days left
                                        </div>
                                    )}
                                    {stat.currencyStatus === 'expired' && (
                                        <div style={{ fontSize: '0.65rem', color: '#ef4444' }}>
                                            Expired
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* DATE RANGE QUERY */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>QUERY BY DATE RANGE</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                        type="date"
                        value={dateRangeStart}
                        onChange={handleStartDateChange}
                        min={profile?.recordDate}
                        style={{
                            flex: 1,
                            background: '#020617',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '8px',
                            color: '#fff',
                            fontSize: '0.85rem'
                        }}
                    />
                    <input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                        style={{
                            flex: 1,
                            background: '#020617',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '8px',
                            color: '#fff',
                            fontSize: '0.85rem'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    <button onClick={() => setQuickRange(30)} style={quickButtonStyle}>Last 30d</button>
                    <button onClick={() => setQuickRange(90)} style={quickButtonStyle}>Last 90d</button>
                    <button onClick={() => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = now.getMonth() + 1; // 0-indexed, so add 1
                        const day = now.getDate();

                        // Format as YYYY-MM-DD without timezone conversion
                        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
                        const endDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

                        setDateRangeStart(startDate);
                        setDateRangeEnd(endDate);
                    }} style={quickButtonStyle}>This Month</button>
                </div>
                {dateRangeStats && (
                    <div style={{ background: '#020617', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>Results:</div>
                        {Object.keys(dateRangeStats.byAircraft).length === 0 ? (
                            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No flights in this period</div>
                        ) : (
                            <>
                                {Object.entries(dateRangeStats.byAircraft).map(([model, hours]) => (
                                    <div key={model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                        <span style={{ color: '#94a3b8' }}>{model}:</span>
                                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>{minsToTime(hours)}</span>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span style={{ color: '#fff' }}>Total:</span>
                                    <span style={{ color: '#10b981' }}>{minsToTime(dateRangeStats.totalHours)}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* MONTHLY BREAKDOWN */}
            <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>MONTHLY BREAKDOWN</div>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                        width: '100%',
                        background: '#020617',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        marginBottom: '12px'
                    }}
                />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button onClick={handleExportMonth} style={{ ...quickButtonStyle, background: '#38bdf8', color: '#0f172a' }}>
                        📥 Export {selectedMonth}
                    </button>
                    <button onClick={handleImportClick} style={{ ...quickButtonStyle, background: '#10b981', color: '#fff' }}>
                        📤 Import Data
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        multiple
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </div>
                <div style={{ background: '#020617', borderRadius: '6px', padding: '12px' }}>
                    {Object.keys(monthlyStats.byAircraft).length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No flights in this month</div>
                    ) : (
                        <>
                            {Object.entries(monthlyStats.byAircraft).map(([model, hours]) => (
                                <div key={model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                    <span style={{ color: '#94a3b8' }}>• {model}:</span>
                                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>{minsToTime(hours)}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span style={{ color: '#fff' }}>Total:</span>
                                <span style={{ color: '#10b981' }}>{minsToTime(monthlyStats.totalHours)}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const quickButtonStyle = {
    flex: 1,
    background: '#334155',
    border: 'none',
    borderRadius: '4px',
    padding: '6px',
    color: '#94a3b8',
    fontSize: '0.7rem',
    cursor: 'pointer',
    fontWeight: 'bold' as const
};

export default StatisticsCard;
