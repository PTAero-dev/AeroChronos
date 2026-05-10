import React, { useState, useMemo } from 'react';
import type { LogbookEntry, NavaidRecord, FltckExperience, IfpRecord, PilotProfile } from '../types';
import { rawToMins, minsToTime } from '../utils/calculations';

interface FltckExperienceViewProps {
    logbookEntries: LogbookEntry[];
    fltckExperience: FltckExperience;
    onUpdateFltckExperience: (data: FltckExperience) => void;
    userInitials: string;
    profile: PilotProfile | undefined;
}

const NAVAID_TYPES = ['NDB', 'VOR', 'ILS', 'RADAR', 'PAPI'] as const;
const IFP_TYPES = ['APP', 'SID', 'STAR'] as const;

const FltckExperienceView: React.FC<FltckExperienceViewProps> = ({
    logbookEntries,
    fltckExperience,
    onUpdateFltckExperience,
    userInitials,
    profile
}) => {
    // Date range state for query
    const [dateRangeStart, setDateRangeStart] = useState('');
    const [dateRangeEnd, setDateRangeEnd] = useState('');

    // NAVAID tracking start date (1-year period) - use stored value
    const [navaidStartDate, setNavaidStartDate] = useState(() => {
        if (fltckExperience.navaidStartDate) return fltckExperience.navaidStartDate;
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    });

    // New NAVAID record form state
    const [newNavaidType, setNewNavaidType] = useState<typeof NAVAID_TYPES[number]>('NDB');
    const [newNavaidStation, setNewNavaidStation] = useState('');
    const [newNavaidDate, setNewNavaidDate] = useState(new Date().toISOString().split('T')[0]);
    const [newNavaidRemarks, setNewNavaidRemarks] = useState('');

    // IFP tracking start date (2-year period) - use stored value
    const [ifpStartDate, setIfpStartDate] = useState(() => {
        if (fltckExperience.ifpStartDate) return fltckExperience.ifpStartDate;
        const d = new Date();
        d.setFullYear(d.getFullYear() - 2);
        return d.toISOString().split('T')[0];
    });

    // New IFP record form state
    const [newIfpType, setNewIfpType] = useState<typeof IFP_TYPES[number]>('APP');
    const [newIfpProcedure, setNewIfpProcedure] = useState('');
    const [newIfpDate, setNewIfpDate] = useState(new Date().toISOString().split('T')[0]);
    const [newIfpRemarks, setNewIfpRemarks] = useState('');
    const [showIfpReqSettings, setShowIfpReqSettings] = useState(false);

    // Collapsible states for NAVAID and IFP cards
    const [navaidCollapsed, setNavaidCollapsed] = useState(false);
    const [ifpCollapsed, setIfpCollapsed] = useState(false);

    // State for editing requirements
    const [showReqSettings, setShowReqSettings] = useState(false);

    // Export/Import period filter state
    const [exportPeriod, setExportPeriod] = useState<'all' | 'monthly' | 'yearly'>('all');
    const [exportMonth, setExportMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const [exportYear, setExportYear] = useState(() => new Date().getFullYear().toString());

    // Calculate total FLTCK hours from logbook (CAAT and Abroad)
    const fltckHoursFromLogbook = useMemo(() => {
        let totalCaat = 0;
        let totalAbroad = 0;
        const user = userInitials.toUpperCase();

        logbookEntries.forEach(entry => {
            entry.legs.forEach(leg => {
                // Only FLTCK (O) or NAV/FLTCK (N/O) legs
                // Skip if IFP is checked - those hours go to IFP total instead
                if ((leg.condition === 'O' || leg.condition === 'N/O') && !leg.isIfp) {
                    // Check if user is PF or PM
                    const pf = leg.pf?.trim().toUpperCase() || '';
                    const pm = leg.pm?.trim().toUpperCase() || '';
                    const dual = leg.dual?.trim().toUpperCase() || '';
                    const ip = leg.ip?.trim().toUpperCase() || '';

                    if (pf === user || pm === user || dual === user || ip === user) {
                        // Use block time (start to stop)
                        if (leg.start && leg.stop) {
                            const s = rawToMins(leg.start);
                            const e = rawToMins(leg.stop);
                            let block = e - s;
                            if (block < 0) block += 1440; // Handle overnight

                            // Check if domestic (CAAT) or abroad
                            const dep = (leg.dep || '').toUpperCase();
                            const arr = (leg.arr || '').toUpperCase();
                            const isDomestic = dep.startsWith('VT') && arr.startsWith('VT');

                            if (isDomestic) {
                                totalCaat += block;
                            } else {
                                totalAbroad += block;
                            }
                        }
                    }
                }
            });
        });

        return { caat: totalCaat, abroad: totalAbroad };
    }, [logbookEntries, userInitials]);

    // Calculate IFP hours from logbook (legs with isIfp checked)
    // Uses BLK time (start to stop), separated by CAAT and Abroad
    const ifpHoursFromLogbook = useMemo(() => {
        let totalCaat = 0;
        let totalAbroad = 0;
        logbookEntries.forEach(entry => {
            entry.legs.forEach(leg => {
                if (leg.isIfp && leg.start && leg.stop) {
                    const s = rawToMins(leg.start);
                    const e = rawToMins(leg.stop);
                    let block = e - s;
                    if (block < 0) block += 1440;

                    // Check if domestic (CAAT) or abroad
                    const dep = (leg.dep || '').toUpperCase();
                    const arr = (leg.arr || '').toUpperCase();
                    const isDomestic = dep.startsWith('VT') && arr.startsWith('VT');

                    if (isDomestic) {
                        totalCaat += block;
                    } else {
                        totalAbroad += block;
                    }
                }
            });
        });
        return { caat: totalCaat, abroad: totalAbroad };
    }, [logbookEntries]);

    // Total hours calculations (previous from profile + from logbook)
    const fltckHoursCaat = (profile?.prevFltckHoursCaat || 0) + fltckHoursFromLogbook.caat;
    const fltckHoursAbroad = (profile?.prevFltckHoursAbroad || 0) + fltckHoursFromLogbook.abroad;
    const totalFltckHours = fltckHoursCaat + fltckHoursAbroad;

    const ifpHoursCaat = (profile?.prevIfpHoursCaat || 0) + ifpHoursFromLogbook.caat;
    const ifpHoursAbroad = (profile?.prevIfpHoursAbroad || 0) + ifpHoursFromLogbook.abroad;
    const totalIfpHours = ifpHoursCaat + ifpHoursAbroad;

    // Date range query - calculate FLTCK and IFP hours separated by CAAT and Abroad
    const dateRangeHours = useMemo(() => {
        if (!dateRangeStart || !dateRangeEnd) return null;

        let fltckCaat = 0;
        let fltckAbroad = 0;
        let ifpCaat = 0;
        let ifpAbroad = 0;
        const user = userInitials.toUpperCase();

        const filtered = logbookEntries.filter(e => e.date >= dateRangeStart && e.date <= dateRangeEnd);

        filtered.forEach(entry => {
            entry.legs.forEach(leg => {
                const dep = (leg.dep || '').toUpperCase();
                const arr = (leg.arr || '').toUpperCase();
                const isDomestic = dep.startsWith('VT') && arr.startsWith('VT');

                // IFP hours (isIfp checked)
                if (leg.isIfp && leg.start && leg.stop) {
                    const s = rawToMins(leg.start);
                    const e = rawToMins(leg.stop);
                    let block = e - s;
                    if (block < 0) block += 1440;

                    if (isDomestic) {
                        ifpCaat += block;
                    } else {
                        ifpAbroad += block;
                    }
                }
                // FLTCK hours (O or N/O condition, not IFP)
                else if ((leg.condition === 'O' || leg.condition === 'N/O') && !leg.isIfp) {
                    const pf = leg.pf?.trim().toUpperCase() || '';
                    const pm = leg.pm?.trim().toUpperCase() || '';
                    const dual = leg.dual?.trim().toUpperCase() || '';
                    const ip = leg.ip?.trim().toUpperCase() || '';

                    if (pf === user || pm === user || dual === user || ip === user) {
                        if (leg.start && leg.stop) {
                            const s = rawToMins(leg.start);
                            const e = rawToMins(leg.stop);
                            let block = e - s;
                            if (block < 0) block += 1440;

                            if (isDomestic) {
                                fltckCaat += block;
                            } else {
                                fltckAbroad += block;
                            }
                        }
                    }
                }
            });
        });

        return { fltckCaat, fltckAbroad, ifpCaat, ifpAbroad };
    }, [logbookEntries, dateRangeStart, dateRangeEnd, userInitials]);

    // NAVAID experience tracking - count unique stations per type within 1 year
    const navaidStats = useMemo(() => {
        const endDate = new Date(navaidStartDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const stats: Record<string, Set<string>> = {
            NDB: new Set(),
            VOR: new Set(),
            ILS: new Set(),
            RADAR: new Set(),
            PAPI: new Set()
        };

        fltckExperience.navaidRecords
            .filter(r => r.date >= navaidStartDate && r.date <= endDateStr)
            .forEach(r => {
                if (stats[r.type]) {
                    stats[r.type].add(r.station.toUpperCase());
                }
            });

        return {
            NDB: stats.NDB.size,
            VOR: stats.VOR.size,
            ILS: stats.ILS.size,
            RADAR: stats.RADAR.size,
            PAPI: stats.PAPI.size
        };
    }, [fltckExperience.navaidRecords, navaidStartDate]);

    // Expiry warning - check if 3 months or less remaining with unmet requirements
    const expiryWarning = useMemo(() => {
        const endDate = new Date(navaidStartDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        const now = new Date();

        // Calculate days remaining
        const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const monthsRemaining = Math.floor(daysRemaining / 30);

        // Check which NAVAIDs are not met
        const unmetTypes: string[] = [];
        NAVAID_TYPES.forEach(type => {
            const count = navaidStats[type];
            const required = fltckExperience.navaidRequirements?.[type] ?? 2;
            if (count < required) {
                const remaining = required - count;
                unmetTypes.push(`${type} (need ${remaining} more)`);
            }
        });

        return {
            daysRemaining,
            monthsRemaining,
            isWarning: daysRemaining <= 90 && daysRemaining > 0 && unmetTypes.length > 0,
            isExpired: daysRemaining <= 0 && unmetTypes.length > 0,
            unmetTypes,
            endDateStr: endDate.toISOString().split('T')[0]
        };
    }, [navaidStartDate, navaidStats, fltckExperience.navaidRequirements]);

    // IFP experience tracking - count unique procedures per type within 2 years
    const ifpStats = useMemo(() => {
        const endDate = new Date(ifpStartDate);
        endDate.setFullYear(endDate.getFullYear() + 2);
        const endDateStr = endDate.toISOString().split('T')[0];

        const stats: Record<string, Set<string>> = {
            APP: new Set(),
            SID: new Set(),
            STAR: new Set()
        };

        (fltckExperience.ifpRecords || [])
            .filter(r => r.date >= ifpStartDate && r.date <= endDateStr)
            .forEach(r => {
                if (stats[r.type]) {
                    stats[r.type].add(r.procedureName.toUpperCase());
                }
            });

        return {
            APP: stats.APP.size,
            SID: stats.SID.size,
            STAR: stats.STAR.size,
            total: stats.APP.size + stats.SID.size + stats.STAR.size // Total unique procedures from any type
        };
    }, [fltckExperience.ifpRecords, ifpStartDate]);



    // IFP expiry warning - check if 6 months or less remaining with unmet requirement
    const ifpExpiryWarning = useMemo(() => {
        const endDate = new Date(ifpStartDate);
        endDate.setFullYear(endDate.getFullYear() + 2);
        const now = new Date();

        const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const monthsRemaining = Math.floor(daysRemaining / 30);

        // Requirement: at least 1 procedure from any type
        const isUnmet = ifpStats.total < 1;

        return {
            daysRemaining,
            monthsRemaining,
            isWarning: daysRemaining <= 180 && daysRemaining > 0 && isUnmet,
            isExpired: daysRemaining <= 0 && isUnmet,
            isUnmet,
            endDateStr: endDate.toISOString().split('T')[0]
        };
    }, [ifpStartDate, ifpStats]);

    // Toggle lock for NAVAID start date
    const handleToggleNavaidStartLock = () => {
        onUpdateFltckExperience({
            ...fltckExperience,
            navaidStartDateLocked: !fltckExperience.navaidStartDateLocked
        });
    };

    // Handle NAVAID start date change
    const handleNavaidStartDateChange = (date: string) => {
        setNavaidStartDate(date);
        onUpdateFltckExperience({
            ...fltckExperience,
            navaidStartDate: date
        });
    };

    // Toggle lock for IFP start date
    const handleToggleIfpStartLock = () => {
        onUpdateFltckExperience({
            ...fltckExperience,
            ifpStartDateLocked: !fltckExperience.ifpStartDateLocked
        });
    };

    // Handle IFP start date change
    const handleIfpStartDateChange = (date: string) => {
        setIfpStartDate(date);
        onUpdateFltckExperience({
            ...fltckExperience,
            ifpStartDate: date
        });
    };

    // Update NAVAID requirement
    const handleReqChange = (type: typeof NAVAID_TYPES[number], value: number) => {
        onUpdateFltckExperience({
            ...fltckExperience,
            navaidRequirements: {
                ...fltckExperience.navaidRequirements,
                [type]: Math.max(1, value)
            }
        });
    };

    // Update IFP requirement
    const handleIfpReqChange = (type: typeof IFP_TYPES[number], value: number) => {
        onUpdateFltckExperience({
            ...fltckExperience,
            ifpRequirements: {
                ...(fltckExperience.ifpRequirements || { APP: 2, SID: 2, STAR: 2 }),
                [type]: Math.max(1, value)
            }
        });
    };

    // Add new IFP record
    const handleAddIfp = () => {
        if (!newIfpProcedure.trim()) {
            alert('Please enter a procedure name');
            return;
        }

        const newRecord: IfpRecord = {
            id: `ifp-${Date.now()}`,
            date: newIfpDate,
            type: newIfpType,
            procedureName: newIfpProcedure.trim().toUpperCase(),
            remarks: newIfpRemarks
        };

        onUpdateFltckExperience({
            ...fltckExperience,
            ifpRecords: [...(fltckExperience.ifpRecords || []), newRecord]
        });

        // Reset form
        setNewIfpProcedure('');
        setNewIfpRemarks('');
    };

    // Delete IFP record
    const handleDeleteIfp = (id: string) => {
        onUpdateFltckExperience({
            ...fltckExperience,
            ifpRecords: (fltckExperience.ifpRecords || []).filter(r => r.id !== id)
        });
    };

    // Add new NAVAID record
    const handleAddNavaid = () => {
        if (!newNavaidStation.trim()) {
            alert('Please enter a station name');
            return;
        }

        const newRecord: NavaidRecord = {
            id: `navaid-${Date.now()}`,
            date: newNavaidDate,
            type: newNavaidType,
            station: newNavaidStation.trim().toUpperCase(),
            remarks: newNavaidRemarks
        };

        onUpdateFltckExperience({
            ...fltckExperience,
            navaidRecords: [...fltckExperience.navaidRecords, newRecord]
        });

        // Reset form
        setNewNavaidStation('');
        setNewNavaidRemarks('');
    };

    // Delete NAVAID record
    const handleDeleteNavaid = (id: string) => {
        onUpdateFltckExperience({
            ...fltckExperience,
            navaidRecords: fltckExperience.navaidRecords.filter(r => r.id !== id)
        });
    };

    // Export data with period filter
    const handleExport = () => {
        let recordsToExport = fltckExperience.navaidRecords;
        let periodLabel = 'all';

        if (exportPeriod === 'monthly') {
            recordsToExport = fltckExperience.navaidRecords.filter(r => r.date.startsWith(exportMonth));
            periodLabel = exportMonth;
        } else if (exportPeriod === 'yearly') {
            recordsToExport = fltckExperience.navaidRecords.filter(r => r.date.startsWith(exportYear));
            periodLabel = exportYear;
        }

        if (recordsToExport.length === 0 && exportPeriod !== 'all') {
            alert(`No NAVAID records found for ${periodLabel}`);
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            exportPeriod: exportPeriod,
            periodLabel: periodLabel,
            fltckExperience: {
                ...fltckExperience,
                navaidRecords: recordsToExport
            }
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fltck-${periodLabel}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert(`✅ Exported ${recordsToExport.length} records for ${periodLabel}`);
    };

    // Import data (supports multiple files)
    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = true; // Allow multiple files

        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files || files.length === 0) return;

            let totalNewRecords = 0;
            let processedFiles = 0;
            let failedFiles = 0;

            // Build up merged state
            let mergedNavaidRecords = [...fltckExperience.navaidRecords];
            let latestPrevHours = fltckExperience.prevHours;
            let latestPrevHoursDate = fltckExperience.prevHoursDate;
            let latestPrevHoursLocked = fltckExperience.prevHoursLocked;
            let latestNavaidRequirements = fltckExperience.navaidRequirements;

            const readFile = (file: File): Promise<void> => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const data = JSON.parse(event.target?.result as string);
                            if (data.fltckExperience) {
                                // Merge NAVAID records
                                const existingIds = new Set(mergedNavaidRecords.map(r => r.id));
                                const newRecords = (data.fltckExperience.navaidRecords || [])
                                    .filter((r: NavaidRecord) => !existingIds.has(r.id));

                                mergedNavaidRecords = [...mergedNavaidRecords, ...newRecords];
                                totalNewRecords += newRecords.length;

                                // Use latest values from files (last file wins for scalar values)
                                if (data.fltckExperience.prevHours !== undefined) {
                                    latestPrevHours = data.fltckExperience.prevHours;
                                }
                                if (data.fltckExperience.prevHoursDate) {
                                    latestPrevHoursDate = data.fltckExperience.prevHoursDate;
                                }
                                if (data.fltckExperience.prevHoursLocked !== undefined) {
                                    latestPrevHoursLocked = data.fltckExperience.prevHoursLocked;
                                }
                                if (data.fltckExperience.navaidRequirements) {
                                    latestNavaidRequirements = data.fltckExperience.navaidRequirements;
                                }

                                processedFiles++;
                            }
                        } catch (err) {
                            failedFiles++;
                        }
                        resolve();
                    };
                    reader.onerror = () => {
                        failedFiles++;
                        resolve();
                    };
                    reader.readAsText(file);
                });
            };

            // Process all files
            const filePromises = Array.from(files).map(file => readFile(file));
            await Promise.all(filePromises);

            // Apply merged state with all fields
            onUpdateFltckExperience({
                ...fltckExperience,
                prevHours: latestPrevHours,
                prevHoursDate: latestPrevHoursDate,
                prevHoursLocked: latestPrevHoursLocked,
                navaidRecords: mergedNavaidRecords,
                navaidRequirements: latestNavaidRequirements
            });

            // Show summary
            let message = `✅ Processed ${processedFiles} file(s)\n`;
            message += `📋 Imported ${totalNewRecords} new NAVAID records`;
            if (failedFiles > 0) {
                message += `\n⚠️ Failed to process ${failedFiles} file(s)`;
            }
            alert(message);
        };
        input.click();
    };

    const cardStyle: React.CSSProperties = {
        background: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid #334155'
    };

    const inputStyle: React.CSSProperties = {
        background: '#020617',
        color: '#fff',
        border: '1px solid #334155',
        borderRadius: '6px',
        padding: '10px',
        fontSize: '1rem',
        width: '100%',
        boxSizing: 'border-box'
    };

    const buttonStyle: React.CSSProperties = {
        background: 'var(--accent-cyan)',
        color: '#0f172a',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: 'pointer'
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ color: '#38bdf8', marginBottom: '20px', textAlign: 'center' }}>
                ✈️ FLTCK EXPERIENCE
            </h2>

            {/* FIVP Hours Statistics Card */}
            <div style={cardStyle}>
                <h3 style={{ color: '#10b981', marginBottom: '16px', fontSize: '0.85rem', letterSpacing: '1px' }}>
                    📊 FIVP HOURS STATISTICS
                </h3>

                {/* FLTCK & IFP Hours Side by Side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {/* FLTCK Hours */}
                    <div style={{
                        background: '#0f172a',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                        border: '1px solid #f59e0b'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px' }}>TOTAL FLTCK HOURS</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                            {minsToTime(totalFltckHours)}
                        </div>
                    </div>

                    {/* IFP Hours */}
                    <div style={{
                        background: '#0f172a',
                        borderRadius: '8px',
                        padding: '12px',
                        textAlign: 'center',
                        border: '1px solid #f472b6'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px' }}>TOTAL IFP HOURS</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f472b6' }}>
                            {minsToTime(totalIfpHours)}
                        </div>
                    </div>
                </div>

                {/* CAAT (Domestic) Hours */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#10b981', marginBottom: '8px', fontWeight: 'bold' }}>
                        CAAT (Domestic)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            border: '1px solid #10b981'
                        }}>
                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>FLTCK (CAAT)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                                {minsToTime(fltckHoursCaat)}
                            </div>
                            <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '2px' }}>
                                (Prev: {minsToTime(profile?.prevFltckHoursCaat || 0)} + Log: {minsToTime(fltckHoursFromLogbook.caat)})
                            </div>
                        </div>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            border: '1px solid #10b981'
                        }}>
                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>IFP (CAAT)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f472b6' }}>
                                {minsToTime(ifpHoursCaat)}
                            </div>
                            <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '2px' }}>
                                (Prev: {minsToTime(profile?.prevIfpHoursCaat || 0)} + Log: {minsToTime(ifpHoursFromLogbook.caat)})
                            </div>
                        </div>
                    </div>
                </div>

                {/* Abroad Hours */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginBottom: '8px', fontWeight: 'bold' }}>
                        ✈️ ABROAD (International)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            border: '1px solid #60a5fa'
                        }}>
                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>FLTCK (Abroad)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                                {minsToTime(fltckHoursAbroad)}
                            </div>
                            <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '2px' }}>
                                (Prev: {minsToTime(profile?.prevFltckHoursAbroad || 0)} + Log: {minsToTime(fltckHoursFromLogbook.abroad)})
                            </div>
                        </div>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            border: '1px solid #60a5fa'
                        }}>
                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>IFP (Abroad)</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f472b6' }}>
                                {minsToTime(ifpHoursAbroad)}
                            </div>
                            <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '2px' }}>
                                (Prev: {minsToTime(profile?.prevIfpHoursAbroad || 0)} + Log: {minsToTime(ifpHoursFromLogbook.abroad)})
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date Range Query */}
                <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>
                        QUERY BY DATE RANGE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                        <input
                            type="date"
                            value={dateRangeStart}
                            onChange={e => setDateRangeStart(e.target.value)}
                            min={profile?.recordDate || undefined}
                            style={inputStyle}
                        />
                        <input
                            type="date"
                            value={dateRangeEnd}
                            onChange={e => setDateRangeEnd(e.target.value)}
                            min={profile?.recordDate || undefined}
                            style={inputStyle}
                        />
                    </div>
                    {dateRangeHours !== null && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px'
                        }}>
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '10px',
                                textAlign: 'center',
                                border: '1px solid #10b981'
                            }}>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>FLTCK (CAAT)</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f59e0b' }}>
                                    {minsToTime(dateRangeHours.fltckCaat)}
                                </div>
                            </div>
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '10px',
                                textAlign: 'center',
                                border: '1px solid #10b981'
                            }}>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>IFP (CAAT)</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f472b6' }}>
                                    {minsToTime(dateRangeHours.ifpCaat)}
                                </div>
                            </div>
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '10px',
                                textAlign: 'center',
                                border: '1px solid #60a5fa'
                            }}>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>FLTCK (Abroad)</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f59e0b' }}>
                                    {minsToTime(dateRangeHours.fltckAbroad)}
                                </div>
                            </div>
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '10px',
                                textAlign: 'center',
                                border: '1px solid #60a5fa'
                            }}>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>IFP (Abroad)</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f472b6' }}>
                                    {minsToTime(dateRangeHours.ifpAbroad)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* NAVAID Experience Card */}
            <div style={cardStyle}>
                <h3
                    onClick={() => setNavaidCollapsed(!navaidCollapsed)}
                    style={{
                        color: '#a855f7',
                        marginBottom: navaidCollapsed ? '0' : '16px',
                        fontSize: '0.85rem',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <span>📡 NAVAID EXPERIENCE TRACKING</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {navaidCollapsed ? '▼ EXPAND' : '▲ MINIMIZE'}
                    </span>
                </h3>

                {!navaidCollapsed && (
                    <>
                        {/* Tracking Period */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                    TRACKING START DATE (1-Year Period)
                                </div>
                                <button
                                    onClick={handleToggleNavaidStartLock}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid #334155',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        color: fltckExperience.navaidStartDateLocked ? '#ef4444' : '#10b981'
                                    }}
                                >
                                    {fltckExperience.navaidStartDateLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
                                </button>
                            </div>
                            <input
                                type="date"
                                value={navaidStartDate}
                                onChange={e => handleNavaidStartDateChange(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    opacity: fltckExperience.navaidStartDateLocked ? 0.6 : 1
                                }}
                                disabled={fltckExperience.navaidStartDateLocked}
                            />
                        </div>

                        {/* NAVAID Status Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '8px',
                            marginBottom: '8px'
                        }}>
                            {NAVAID_TYPES.map(type => {
                                const count = navaidStats[type];
                                const required = fltckExperience.navaidRequirements?.[type] ?? 2;
                                const isMet = count >= required;

                                return (
                                    <div key={type} style={{
                                        background: '#0f172a',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        textAlign: 'center',
                                        border: `1px solid ${isMet ? '#10b981' : '#f59e0b'}`
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{type}</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isMet ? '#10b981' : '#f59e0b' }}>
                                            {count}/{required}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                                            {isMet ? '✅' : '⚠️'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Expiry Warning Alert */}
                        {(expiryWarning.isWarning || expiryWarning.isExpired) && (
                            <div style={{
                                background: expiryWarning.isExpired ? '#450a0a' : '#451a03',
                                border: `1px solid ${expiryWarning.isExpired ? '#ef4444' : '#f59e0b'}`,
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    color: expiryWarning.isExpired ? '#ef4444' : '#f59e0b',
                                    marginBottom: '8px'
                                }}>
                                    {expiryWarning.isExpired ? '❌ PERIOD EXPIRED' : '⚠️ WARNING: EXPIRING SOON'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#fcd34d', marginBottom: '8px' }}>
                                    {expiryWarning.isExpired
                                        ? `Period ended on ${expiryWarning.endDateStr}`
                                        : `${expiryWarning.daysRemaining} days remaining (≈${expiryWarning.monthsRemaining} months) - ends ${expiryWarning.endDateStr}`
                                    }
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#fef3c7' }}>
                                    <strong>Stations needed:</strong>
                                </div>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.7rem', color: '#fde68a' }}>
                                    {expiryWarning.unmetTypes.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Settings Toggle */}
                        <button
                            onClick={() => setShowReqSettings(!showReqSettings)}
                            style={{
                                background: 'transparent',
                                color: '#64748b',
                                border: '1px dashed #334155',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                width: '100%',
                                marginBottom: '16px'
                            }}
                        >
                            {showReqSettings ? '▲ Hide Settings' : '⚙️ Set Requirements'}
                        </button>

                        {/* Editable Requirements */}
                        {showReqSettings && (
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '12px',
                                marginBottom: '16px',
                                border: '1px dashed #334155'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>REQUIRED STATIONS PER NAVAID</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                    {NAVAID_TYPES.map(type => (
                                        <div key={type} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px' }}>{type}</div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={fltckExperience.navaidRequirements?.[type] ?? 2}
                                                onChange={e => handleReqChange(type, parseInt(e.target.value) || 2)}
                                                style={{
                                                    ...inputStyle,
                                                    padding: '6px',
                                                    textAlign: 'center',
                                                    width: '100%'
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add New NAVAID Record */}
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '10px' }}>ADD NEW NAVAID RECORD</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                                <select
                                    value={newNavaidType}
                                    onChange={e => setNewNavaidType(e.target.value as typeof NAVAID_TYPES[number])}
                                    style={inputStyle}
                                >
                                    {NAVAID_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newNavaidStation}
                                    onChange={e => setNewNavaidStation(e.target.value.toUpperCase())}
                                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                                    placeholder="Station Name"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="date"
                                    value={newNavaidDate}
                                    onChange={e => setNewNavaidDate(e.target.value)}
                                    style={inputStyle}
                                />
                                <input
                                    type="text"
                                    value={newNavaidRemarks}
                                    onChange={e => setNewNavaidRemarks(e.target.value.toUpperCase())}
                                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                                    placeholder="Remarks (optional)"
                                />
                            </div>
                            <button onClick={handleAddNavaid} style={{ ...buttonStyle, width: '100%' }}>
                                + ADD RECORD
                            </button>
                        </div>

                        {/* NAVAID Records Table */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#0f172a' }}>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Type</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Station</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'center' }}>🗑️</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fltckExperience.navaidRecords
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .map(record => (
                                            <tr key={record.id} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ padding: '8px', color: '#e2e8f0' }}>{record.date}</td>
                                                <td style={{ padding: '8px', color: '#f59e0b' }}>{record.type}</td>
                                                <td style={{ padding: '8px', color: '#38bdf8' }}>{record.station}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                    <span
                                                        onClick={() => handleDeleteNavaid(record.id)}
                                                        style={{ cursor: 'pointer', color: '#ef4444' }}
                                                    >
                                                        ✕
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    {fltckExperience.navaidRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                                No NAVAID records yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* IFP Experience Card */}
            <div style={cardStyle}>
                <h3
                    onClick={() => setIfpCollapsed(!ifpCollapsed)}
                    style={{
                        color: '#f472b6',
                        marginBottom: ifpCollapsed ? '0' : '16px',
                        fontSize: '0.85rem',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <span>✈️ IFP EXPERIENCE TRACKING</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {ifpCollapsed ? '▼ EXPAND' : '▲ MINIMIZE'}
                    </span>
                </h3>

                {!ifpCollapsed && (
                    <>
                        {/* IFP Tracking Period */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                    TRACKING START DATE (2-Year Period)
                                </div>
                                <button
                                    onClick={handleToggleIfpStartLock}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid #334155',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        color: fltckExperience.ifpStartDateLocked ? '#ef4444' : '#10b981'
                                    }}
                                >
                                    {fltckExperience.ifpStartDateLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
                                </button>
                            </div>
                            <input
                                type="date"
                                value={ifpStartDate}
                                onChange={e => handleIfpStartDateChange(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    opacity: fltckExperience.ifpStartDateLocked ? 0.6 : 1
                                }}
                                disabled={fltckExperience.ifpStartDateLocked}
                            />
                        </div>

                        {/* IFP Status Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px',
                            marginBottom: '8px'
                        }}>
                            {IFP_TYPES.map(type => {
                                const count = ifpStats[type];

                                return (
                                    <div key={type} style={{
                                        background: '#0f172a',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        textAlign: 'center',
                                        border: '1px solid #334155'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{type}</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>
                                            {count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* IFP Expiry Warning Alert */}
                        {(ifpExpiryWarning.isWarning || ifpExpiryWarning.isExpired) && (
                            <div style={{
                                background: ifpExpiryWarning.isExpired ? '#450a0a' : '#451a03',
                                border: `1px solid ${ifpExpiryWarning.isExpired ? '#ef4444' : '#f59e0b'}`,
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    color: ifpExpiryWarning.isExpired ? '#ef4444' : '#f59e0b',
                                    marginBottom: '8px'
                                }}>
                                    {ifpExpiryWarning.isExpired ? '❌ PERIOD EXPIRED' : '⚠️ WARNING: EXPIRING SOON'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#fcd34d', marginBottom: '8px' }}>
                                    {ifpExpiryWarning.isExpired
                                        ? `Period ended on ${ifpExpiryWarning.endDateStr}`
                                        : `${ifpExpiryWarning.daysRemaining} days remaining (≈${ifpExpiryWarning.monthsRemaining} months) - ends ${ifpExpiryWarning.endDateStr}`
                                    }
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#fef3c7' }}>
                                    Need at least <strong>1 procedure</strong> from APP, SID, or STAR within the 2-year period.
                                </div>
                            </div>
                        )}

                        {/* IFP Settings Toggle */}
                        <button
                            onClick={() => setShowIfpReqSettings(!showIfpReqSettings)}
                            style={{
                                background: 'transparent',
                                color: '#64748b',
                                border: '1px dashed #334155',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                width: '100%',
                                marginBottom: '16px'
                            }}
                        >
                            {showIfpReqSettings ? '▲ Hide Settings' : '⚙️ Set Requirements'}
                        </button>

                        {/* IFP Editable Requirements */}
                        {showIfpReqSettings && (
                            <div style={{
                                background: '#0f172a',
                                borderRadius: '6px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>
                                    REQUIRED PROCEDURES PER TYPE
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {IFP_TYPES.map(type => (
                                        <div key={type}>
                                            <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px', textAlign: 'center' }}>
                                                {type}
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={fltckExperience.ifpRequirements?.[type] ?? 2}
                                                onChange={e => handleIfpReqChange(type, parseInt(e.target.value) || 2)}
                                                style={{
                                                    ...inputStyle,
                                                    padding: '6px',
                                                    textAlign: 'center',
                                                    width: '100%'
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add New IFP Record */}
                        <div style={{
                            background: '#0f172a',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '10px' }}>ADD NEW IFP RECORD</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                                <select
                                    value={newIfpType}
                                    onChange={e => setNewIfpType(e.target.value as typeof IFP_TYPES[number])}
                                    style={inputStyle}
                                >
                                    {IFP_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newIfpProcedure}
                                    onChange={e => setNewIfpProcedure(e.target.value.toUpperCase())}
                                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                                    placeholder="Procedure Name"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="date"
                                    value={newIfpDate}
                                    onChange={e => setNewIfpDate(e.target.value)}
                                    style={inputStyle}
                                />
                                <input
                                    type="text"
                                    value={newIfpRemarks}
                                    onChange={e => setNewIfpRemarks(e.target.value.toUpperCase())}
                                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                                    placeholder="Remarks (optional)"
                                />
                            </div>
                            <button onClick={handleAddIfp} style={{ ...buttonStyle, width: '100%' }}>
                                + ADD RECORD
                            </button>
                        </div>

                        {/* IFP Records Table */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#0f172a' }}>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Type</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'left' }}>Procedure</th>
                                        <th style={{ padding: '8px', color: '#94a3b8', textAlign: 'center' }}>🗑️</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(fltckExperience.ifpRecords || [])
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .map(record => (
                                            <tr key={record.id} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ padding: '8px', color: '#e2e8f0' }}>{record.date}</td>
                                                <td style={{ padding: '8px', color: '#f472b6' }}>{record.type}</td>
                                                <td style={{ padding: '8px', color: '#38bdf8' }}>{record.procedureName}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                    <span
                                                        onClick={() => handleDeleteIfp(record.id)}
                                                        style={{ cursor: 'pointer', color: '#ef4444' }}
                                                    >
                                                        ✕
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    {(fltckExperience.ifpRecords || []).length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                                No IFP records yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Export/Import Section */}
            <div style={cardStyle}>
                <h3 style={{ color: '#38bdf8', marginBottom: '16px', fontSize: '0.85rem', letterSpacing: '1px' }}>
                    📤 EXPORT / IMPORT
                </h3>

                {/* Period Selector */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>EXPORT/IMPORT PERIOD</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button
                            onClick={() => setExportPeriod('all')}
                            style={{
                                flex: 1,
                                background: exportPeriod === 'all' ? '#38bdf8' : '#0f172a',
                                color: exportPeriod === 'all' ? '#0f172a' : '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ALL
                        </button>
                        <button
                            onClick={() => setExportPeriod('monthly')}
                            style={{
                                flex: 1,
                                background: exportPeriod === 'monthly' ? '#38bdf8' : '#0f172a',
                                color: exportPeriod === 'monthly' ? '#0f172a' : '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            MONTHLY
                        </button>
                        <button
                            onClick={() => setExportPeriod('yearly')}
                            style={{
                                flex: 1,
                                background: exportPeriod === 'yearly' ? '#38bdf8' : '#0f172a',
                                color: exportPeriod === 'yearly' ? '#0f172a' : '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            YEARLY
                        </button>
                    </div>

                    {/* Month Selector */}
                    {exportPeriod === 'monthly' && (
                        <input
                            type="month"
                            value={exportMonth}
                            onChange={e => setExportMonth(e.target.value)}
                            style={inputStyle}
                        />
                    )}

                    {/* Year Selector */}
                    {exportPeriod === 'yearly' && (
                        <select
                            value={exportYear}
                            onChange={e => setExportYear(e.target.value)}
                            style={inputStyle}
                        >
                            {Array.from({ length: 10 }, (_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={handleExport} style={buttonStyle}>
                        📥 Export {exportPeriod === 'all' ? 'All' : exportPeriod === 'monthly' ? exportMonth : exportYear}
                    </button>
                    <button onClick={handleImport} style={{ ...buttonStyle, background: '#64748b' }}>
                        📤 Import Data
                    </button>
                </div>
            </div>
        </div >
    );
};

export default FltckExperienceView;
