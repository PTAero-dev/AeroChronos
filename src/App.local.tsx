import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MissionDashboard from './components/MissionDashboard';
import FDPView from './components/FDPView';
import ProfileView from './components/ProfileView';
import LogbookView from './components/LogbookView';
import TimeCalculatorView from './components/TimeCalculatorView';
import FltckExperienceView from './components/FltckExperienceView';
import type { Tab, LogbookData, LogbookEntry, PilotProfile, FltckExperience } from './types';
import { calculateFDP } from './utils/fdp';
import { rawToMins } from './utils/calculations';
import { getAircraftConfig } from './utils/aircraft';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('mission');
  const [logbookData, setLogbookData] = useState<LogbookData>({
    date: new Date().toISOString().split('T')[0],
    ac: 'HS-AIM',
    crew: ['', '', '', ''],
    legs: []
  });
  const [logbookEntries, setLogbookEntries] = useState<LogbookEntry[]>([]);
  const [profile, setProfile] = useState<PilotProfile | undefined>(undefined);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [fltckExperience, setFltckExperience] = useState<FltckExperience>({
    prevHours: 0,
    prevHoursDate: '',
    prevHoursLocked: false,
    navaidRecords: [],
    navaidRequirements: {
      NDB: 2,
      VOR: 2,
      ILS: 2,
      RADAR: 2,
      PAPI: 2
    },
    navaidStartDate: '',
    navaidStartDateLocked: false,
    ifpRecords: [],
    ifpStartDate: '',
    ifpStartDateLocked: false,
    ifpRequirements: {
      APP: 1,
      SID: 1,
      STAR: 1
    },
    prevIfpHours: 0,
    prevIfpHoursDate: '',
    prevIfpHoursLocked: false
  });

  // Load initial data
  useEffect(() => {
    const saved = localStorage.getItem('logbook_v2_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLogbookData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }

    const savedEntries = localStorage.getItem('logbook_v2_entries');
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        setLogbookEntries(parsed);
      } catch (e) {
        console.error("Failed to load logbook entries", e);
      }
    }

    const savedProfile = localStorage.getItem('logbook_v2_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    }

    const savedFltckExp = localStorage.getItem('logbook_v2_fltck');
    if (savedFltckExp) {
      try {
        setFltckExperience(JSON.parse(savedFltckExp));
      } catch (e) {
        console.error("Failed to load FLTCK experience", e);
      }
    }
  }, []);

  // Save current mission data on change
  useEffect(() => {
    if (logbookData.legs.length > 0 || logbookData.crew.some(c => c)) {
      localStorage.setItem('logbook_v2_data', JSON.stringify(logbookData));
    }
  }, [logbookData]);

  // Save logbook entries on change
  useEffect(() => {
    localStorage.setItem('logbook_v2_entries', JSON.stringify(logbookEntries));
  }, [logbookEntries]);

  // Save profile on change
  useEffect(() => {
    if (profile) {
      localStorage.setItem('logbook_v2_profile', JSON.stringify(profile));
    }
  }, [profile]);

  // Save FLTCK experience on change
  useEffect(() => {
    localStorage.setItem('logbook_v2_fltck', JSON.stringify(fltckExperience));
  }, [fltckExperience]);

  // Save current mission to logbook
  const handleSaveToLogbook = () => {
    // Validate mission has data
    if (logbookData.legs.length === 0) {
      alert('No flight legs to save. Please add legs in the FLIGHT tab.');
      return;
    }

    const hasValidLeg = logbookData.legs.some(l => l.start && l.stop);
    if (!hasValidLeg) {
      alert('Please complete at least one leg with start and stop times.');
      return;
    }

    // Check if user is listed in crew
    // Check if user is listed in crew
    const userInitials = profile?.pilotName?.trim()?.toUpperCase() || 'PT';

    // Ensure we don't match empty strings if userInitials somehow became empty
    if (!userInitials) {
      alert('Error: Your Pilot Profile name is missing. Please update your profile.');
      return;
    }

    const isCrew = logbookData.legs.some(l => {
      const pf = l.pf?.trim()?.toUpperCase();
      const pm = l.pm?.trim()?.toUpperCase();
      const dual = l.dual?.trim()?.toUpperCase();
      const ip = l.ip?.trim()?.toUpperCase();

      return (pf === userInitials) ||
        (pm === userInitials) ||
        (dual === userInitials) ||
        (ip === userInitials);
    });

    if (!isCrew) {
      alert(`⚠️ ERROR: Your Initial Name (${userInitials}) was not found in any leg as PF or PM.\n\nYou cannot save this mission because it would not credit any flight hours to your logbook.\n\nPlease update the Crew Initials in the legs to match your Profile Name.`);
      return;
    }

    // Calculate totals
    let totalBlock = 0;
    let totalFlight = 0;
    let totalIFR = 0;
    let totalVFR = 0;
    let totalNight = 0;
    let picTime = 0;
    let sicTime = 0;
    let dayLandings = 0;
    let nightLandings = 0;

    logbookData.legs.forEach(leg => {
      if (leg.start && leg.stop) {
        const start = rawToMins(leg.start);
        const stop = rawToMins(leg.stop);
        let block = stop - start;
        if (block < 0) block += 1440;
        totalBlock += block;

        // Calculate pilot function time for this leg
        // Only count PIC/SIC if user 'PT' (or Profile Name) is in PF/PM
        const userInitials = profile?.pilotName ? profile.pilotName.trim().toUpperCase() : 'PT';

        if (leg.pf && leg.pf.trim().toUpperCase() === userInitials) {
          picTime += block; // User was PF (PIC)
        }
        if (leg.pm && leg.pm.trim().toUpperCase() === userInitials) {
          sicTime += block; // User was PM (SIC)
        }

        // Standard logbook: Total Time of Flight usually equals Block Time
        totalFlight += block;
      }
      
      totalIFR += rawToMins(leg.ifrTime);
      totalVFR += rawToMins(leg.vfrTime);
      totalNight += rawToMins(leg.nightTime);

      // Count landings
      if (leg.landingCount > 0) {
        if (leg.isNight) {
          nightLandings += leg.landingCount;
        } else {
          dayLandings += leg.landingCount;
        }
      }
    });

    // Determine crew type (single vs multi)
    const hasMultiCrew = logbookData.legs.some(l => l.pf && l.pm);
    const isSinglePilot = !hasMultiCrew;
    const isMultiCrew = hasMultiCrew;

    // Get aircraft details
    const aircraftConfig = getAircraftConfig(logbookData.ac);

    // Calculate FDP data
    const firstLeg = logbookData.legs[0];
    const lastLeg = logbookData.legs[logbookData.legs.length - 1];

    // Determine weight class from aircraft
    const weightClass = aircraftConfig.weightClass;

    let fdpData = {
      reportTime: '',
      offDuty: '',
      actualFDP: 0,
      maxFDP: 0,
      fdpViolation: false
    };

    if (firstLeg.start && lastLeg.stop) {
      const fdpResult = calculateFDP(
        firstLeg.start,
        lastLeg.stop,
        logbookData.legs.length,
        weightClass,
        'multi',
        logbookData.dutyOverrideEnabled ? logbookData.dutyOverrideTime : undefined
      );

      if (fdpResult) {
        // Convert reportMins and offDutyMins to raw format (HHMM)
        const reportMins = fdpResult.reportMins < 0 ? fdpResult.reportMins + 1440 : fdpResult.reportMins;
        const offDutyMins = fdpResult.offDutyMins >= 1440 ? fdpResult.offDutyMins - 1440 : fdpResult.offDutyMins;

        const reportHH = Math.floor(reportMins / 60).toString().padStart(2, '0');
        const reportMM = (reportMins % 60).toString().padStart(2, '0');
        const offDutyHH = Math.floor(offDutyMins / 60).toString().padStart(2, '0');
        const offDutyMM = (offDutyMins % 60).toString().padStart(2, '0');

        fdpData = {
          reportTime: reportHH + reportMM,
          offDuty: offDutyHH + offDutyMM,
          actualFDP: fdpResult.actualFdpMins,
          maxFDP: fdpResult.maxFdpMins,
          fdpViolation: fdpResult.violation
        };
      }
    }

    // Create new entry with enhanced fields
    const newEntry: LogbookEntry = {
      id: editingEntryId || (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
      date: logbookData.date,
      ac: logbookData.ac,
      crew: [...logbookData.crew],
      legs: [...logbookData.legs],
      totalBlock,
      totalFlight,
      totalIFR,
      totalVFR,
      totalNight,
      ...fdpData,
      weightClass,
      // New fields
      picTime,
      sicTime,
      dualTime: 0, // Not currently tracked
      instructorTime: 0, // Not currently tracked
      dayLandings,
      nightLandings,
      isSinglePilot,
      isMultiCrew,
      aircraftModel: aircraftConfig.model,
      isMultiEngine: aircraftConfig.isMultiEngine
    };

    // Add to entries
    // Add to entries (Update if editing, else add new)
    if (editingEntryId) {
      setLogbookEntries(prev => prev.map(e => e.id === editingEntryId ? newEntry : e));
      setEditingEntryId(null); // Clear edit mode
    } else {
      setLogbookEntries(prev => [...prev, newEntry]);
    }

    // Clear current mission
    // Clear current mission
    setLogbookData({
      date: new Date().toISOString().split('T')[0],
      ac: logbookData.ac, // keep aircraft
      crew: ['', '', '', ''], // clear crew
      legs: []
    });

    // Switch to logbook tab
    setActiveTab('logbook');

    alert('Mission saved to logbook!');
  };

  // Delete entry from logbook
  const handleDeleteEntry = (id: string) => {
    if (confirm('Delete this logbook entry?')) {
      setLogbookEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // Load entry back to FLIGHT tab for editing
  const handleLoadEntry = (entry: LogbookEntry) => {
    setLogbookData({
      date: entry.date,
      ac: entry.ac,
      crew: entry.crew as [string, string, string, string],
      legs: entry.legs
    });
    setEditingEntryId(entry.id);
    setActiveTab('mission');
  };

  const handleReset = () => {
    setLogbookData({
      date: new Date().toISOString().split('T')[0],
      ac: logbookData.ac,
      crew: ['', '', '', ''],
      legs: []
    });
    setEditingEntryId(null);
  };

  // Import entries (merge)
  const handleImportLogbook = (importedEntries: LogbookEntry[]) => {
    setLogbookEntries(prev => {
      const currentIds = new Set(prev.map(e => e.id));
      const newEntries = importedEntries.filter(e => !currentIds.has(e.id));
      return [...prev, ...newEntries].sort((a, b) => a.date.localeCompare(b.date));
    });
    alert(`Imported ${importedEntries.length} entries.`);
  };

  // Export all data (Full Backup)
  const handleExportFullData = () => {
    const fullData = {
      exportDate: new Date().toISOString(),
      type: 'AERO_CHRONOS_FULL_BACKUP',
      version: '1.0',
      data: {
        profile,
        logbookEntries,
        fltckExperience,
        currentMission: logbookData
      }
    };

    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aero-chronos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Full backup downloaded successfully!');
  };

  // Import all data (Full Restore)
  const handleImportFullData = (importedData: any) => {
    try {
      // Basic validation
      if (!importedData || !importedData.data) {
        throw new Error('Invalid backup file format');
      }

      const { data } = importedData;

      if (confirm('⚠️ WARNING: This will OVERWRITE all your current data (Profile, Logbook, Experience). Are you sure?')) {
        // Restore each piece of data if present
        if (data.profile) setProfile(data.profile);
        if (data.logbookEntries && Array.isArray(data.logbookEntries)) setLogbookEntries(data.logbookEntries);
        if (data.fltckExperience) setFltckExperience(data.fltckExperience);
        if (data.currentMission) setLogbookData(data.currentMission);

        alert('✅ Full data restored successfully!');
      }
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Failed to restore data. Invalid file format.');
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'mission' && (
        <MissionDashboard data={logbookData} updateData={setLogbookData} onSave={handleSaveToLogbook} onReset={handleReset} onNavigateToFDP={() => setActiveTab('duty')} />
      )}
      {activeTab === 'duty' && (
        <FDPView data={logbookData} onUpdateData={setLogbookData} onSave={handleSaveToLogbook} />
      )}
      {activeTab === 'logbook' && (
        <LogbookView
          currentMission={logbookData}
          logbookEntries={logbookEntries}
          onSaveToLogbook={handleSaveToLogbook}
          onDeleteEntry={handleDeleteEntry}
          onLoadEntry={handleLoadEntry}
          onImportLogbook={handleImportLogbook}
          profile={profile}
        />
      )}
      {activeTab === 'fltck' && (
        <FltckExperienceView
          logbookEntries={logbookEntries}
          fltckExperience={fltckExperience}
          onUpdateFltckExperience={setFltckExperience}
          userInitials={profile?.pilotName?.trim()?.toUpperCase() || 'PT'}
          profile={profile}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileView
          profile={profile}
          onSave={setProfile}
          onExportFullData={handleExportFullData}
          onImportFullData={handleImportFullData}
        />
      )}
      {activeTab === 'calculator' && (
        <TimeCalculatorView />
      )}
    </Layout>
  );
};

export default App;
