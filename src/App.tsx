import React, { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';
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
import { onAuthChange, signOutUser } from './firebase/auth';
import {
  fetchLogbookEntries, fetchProfile, fetchFltckExperience, fetchCurrentMission,
  saveLogbookEntry, removeLogbookEntry, persistProfile, persistFltckExperience,
  persistCurrentMission, bulkImportEntries
} from './firebase/db';

const DEFAULT_FLTCK: FltckExperience = {
  prevHours: 0,
  prevHoursDate: '',
  prevHoursLocked: false,
  navaidRecords: [],
  navaidRequirements: { NDB: 2, VOR: 2, ILS: 2, RADAR: 2, PAPI: 2 },
  navaidStartDate: '',
  navaidStartDateLocked: false,
  ifpRecords: [],
  ifpStartDate: '',
  ifpStartDateLocked: false,
  ifpRequirements: { APP: 1, SID: 1, STAR: 1 },
  prevIfpHours: 0,
  prevIfpHoursDate: '',
  prevIfpHoursLocked: false,
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('mission');
  const [logbookData, setLogbookData] = useState<LogbookData>({
    date: new Date().toISOString().split('T')[0],
    ac: 'HS-AIM',
    crew: ['', '', '', ''],
    legs: [],
  });
  const [logbookEntries, setLogbookEntries] = useState<LogbookEntry[]>([]);
  const [profile, setProfile] = useState<PilotProfile | undefined>(undefined);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [fltckExperience, setFltckExperience] = useState<FltckExperience>(DEFAULT_FLTCK);

  // Prevent Firestore writes during initial data load
  const initialized = useRef(false);
  const missionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Auth state listener ---
  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        await loadAllData(u.uid);
      } else {
        // Reset state on sign-out
        initialized.current = false;
        setLogbookEntries([]);
        setProfile(undefined);
        setFltckExperience(DEFAULT_FLTCK);
        setLogbookData({
          date: new Date().toISOString().split('T')[0],
          ac: 'HS-AIM',
          crew: ['', '', '', ''],
          legs: [],
        });
      }
    });
    return unsub;
  }, []);

  const loadAllData = async (uid: string) => {
    setDataLoading(true);
    initialized.current = false;
    try {
      const [entries, prof, fltck, mission] = await Promise.all([
        fetchLogbookEntries(uid),
        fetchProfile(uid),
        fetchFltckExperience(uid),
        fetchCurrentMission(uid),
      ]);
      setLogbookEntries(entries);
      if (prof) setProfile(prof);
      if (fltck) setFltckExperience(fltck);
      if (mission) setLogbookData(mission);
    } catch (e) {
      console.error('Failed to load data from Firestore', e);
    } finally {
      setDataLoading(false);
      initialized.current = true;
    }
  };

  // --- Auto-save current mission draft (debounced) ---
  useEffect(() => {
    if (!user || !initialized.current) return;
    if (missionDebounce.current) clearTimeout(missionDebounce.current);
    missionDebounce.current = setTimeout(() => {
      persistCurrentMission(user.uid, logbookData).catch(console.error);
    }, 1500);
  }, [logbookData, user]);

  // --- Auto-save profile ---
  useEffect(() => {
    if (!user || !initialized.current || !profile) return;
    persistProfile(user.uid, profile).catch(console.error);
  }, [profile, user]);

  // --- Auto-save FLTCK experience ---
  useEffect(() => {
    if (!user || !initialized.current) return;
    persistFltckExperience(user.uid, fltckExperience).catch(console.error);
  }, [fltckExperience, user]);

  // --- Save mission to logbook ---
  const handleSaveToLogbook = async () => {
    if (!user) return;

    if (logbookData.legs.length === 0) {
      alert('No flight legs to save. Please add legs in the FLIGHT tab.');
      return;
    }
    const hasValidLeg = logbookData.legs.some(l => l.start && l.stop);
    if (!hasValidLeg) {
      alert('Please complete at least one leg with start and stop times.');
      return;
    }

    const userInitials = profile?.pilotName?.trim()?.toUpperCase() || 'PT';
    if (!userInitials) {
      alert('Error: Your Pilot Profile name is missing. Please update your profile.');
      return;
    }

    const isCrew = logbookData.legs.some(l => {
      const pf = l.pf?.trim()?.toUpperCase();
      const pm = l.pm?.trim()?.toUpperCase();
      const dual = l.dual?.trim()?.toUpperCase();
      const ip = l.ip?.trim()?.toUpperCase();
      return pf === userInitials || pm === userInitials || dual === userInitials || ip === userInitials;
    });

    if (!isCrew) {
      alert(`⚠️ ERROR: Your Initial Name (${userInitials}) was not found in any leg as PF or PM.\n\nYou cannot save this mission because it would not credit any flight hours to your logbook.\n\nPlease update the Crew Initials in the legs to match your Profile Name.`);
      return;
    }

    let totalBlock = 0, totalFlight = 0, totalIFR = 0, totalVFR = 0, totalNight = 0;
    let picTime = 0, sicTime = 0, dayLandings = 0, nightLandings = 0;

    logbookData.legs.forEach(leg => {
      if (leg.start && leg.stop) {
        const start = rawToMins(leg.start);
        const stop = rawToMins(leg.stop);
        let block = stop - start;
        if (block < 0) block += 1440;
        totalBlock += block;
        totalFlight += block;
        if (leg.pf?.trim()?.toUpperCase() === userInitials) picTime += block;
        if (leg.pm?.trim()?.toUpperCase() === userInitials) sicTime += block;
      }
      totalIFR += rawToMins(leg.ifrTime);
      totalVFR += rawToMins(leg.vfrTime);
      totalNight += rawToMins(leg.nightTime);
      if (leg.landingCount > 0) {
        if (leg.isNight) nightLandings += leg.landingCount;
        else dayLandings += leg.landingCount;
      }
    });

    const hasMultiCrew = logbookData.legs.some(l => l.pf && l.pm);
    const aircraftConfig = getAircraftConfig(logbookData.ac);
    const weightClass = aircraftConfig.weightClass;
    const firstLeg = logbookData.legs[0];
    const lastLeg = logbookData.legs[logbookData.legs.length - 1];

    let fdpData = { reportTime: '', offDuty: '', actualFDP: 0, maxFDP: 0, fdpViolation: false };
    if (firstLeg.start && lastLeg.stop) {
      const fdpResult = calculateFDP(
        firstLeg.start, lastLeg.stop, logbookData.legs.length, weightClass, 'multi',
        logbookData.dutyOverrideEnabled ? logbookData.dutyOverrideTime : undefined
      );
      if (fdpResult) {
        const reportMins = fdpResult.reportMins < 0 ? fdpResult.reportMins + 1440 : fdpResult.reportMins;
        const offDutyMins = fdpResult.offDutyMins >= 1440 ? fdpResult.offDutyMins - 1440 : fdpResult.offDutyMins;
        const rH = Math.floor(reportMins / 60).toString().padStart(2, '0');
        const rM = (reportMins % 60).toString().padStart(2, '0');
        const oH = Math.floor(offDutyMins / 60).toString().padStart(2, '0');
        const oM = (offDutyMins % 60).toString().padStart(2, '0');
        fdpData = {
          reportTime: rH + rM, offDuty: oH + oM,
          actualFDP: fdpResult.actualFdpMins, maxFDP: fdpResult.maxFdpMins,
          fdpViolation: fdpResult.violation,
        };
      }
    }

    const entryId = editingEntryId || (Date.now().toString() + Math.random().toString(36).substr(2, 9));
    const newEntry: LogbookEntry = {
      id: entryId,
      date: logbookData.date,
      ac: logbookData.ac,
      crew: [...logbookData.crew],
      legs: [...logbookData.legs],
      totalBlock, totalFlight, totalIFR, totalVFR, totalNight,
      ...fdpData,
      weightClass,
      picTime, sicTime, dualTime: 0, instructorTime: 0,
      dayLandings, nightLandings,
      isSinglePilot: !hasMultiCrew,
      isMultiCrew: hasMultiCrew,
      aircraftModel: aircraftConfig.model,
      isMultiEngine: aircraftConfig.isMultiEngine,
    };

    try {
      await saveLogbookEntry(user.uid, newEntry);
      if (editingEntryId) {
        setLogbookEntries(prev => prev.map(e => e.id === editingEntryId ? newEntry : e));
        setEditingEntryId(null);
      } else {
        setLogbookEntries(prev => [...prev, newEntry].sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (e) {
      console.error('Failed to save entry', e);
      alert('Failed to save to cloud. Check your connection and try again.');
      return;
    }

    const clearedMission: LogbookData = {
      date: new Date().toISOString().split('T')[0],
      ac: logbookData.ac,
      crew: ['', '', '', ''],
      legs: [],
    };
    setLogbookData(clearedMission);
    setActiveTab('logbook');
    alert('Mission saved to logbook!');
  };

  // --- Delete entry ---
  const handleDeleteEntry = async (id: string) => {
    if (!user) return;
    if (confirm('Delete this logbook entry?')) {
      try {
        await removeLogbookEntry(user.uid, id);
        setLogbookEntries(prev => prev.filter(e => e.id !== id));
      } catch (e) {
        console.error('Failed to delete entry', e);
        alert('Failed to delete. Check your connection and try again.');
      }
    }
  };

  // --- Load entry for editing ---
  const handleLoadEntry = (entry: LogbookEntry) => {
    setLogbookData({
      date: entry.date,
      ac: entry.ac,
      crew: entry.crew as [string, string, string, string],
      legs: entry.legs,
    });
    setEditingEntryId(entry.id);
    setActiveTab('mission');
  };

  const handleReset = () => {
    setLogbookData({
      date: new Date().toISOString().split('T')[0],
      ac: logbookData.ac,
      crew: ['', '', '', ''],
      legs: [],
    });
    setEditingEntryId(null);
  };

  // --- Import logbook entries (merge) ---
  const handleImportLogbook = async (importedEntries: LogbookEntry[]) => {
    if (!user) return;
    const currentIds = new Set(logbookEntries.map(e => e.id));
    const newEntries = importedEntries.filter(e => !currentIds.has(e.id));
    try {
      await bulkImportEntries(user.uid, newEntries);
      setLogbookEntries(prev =>
        [...prev, ...newEntries].sort((a, b) => a.date.localeCompare(b.date))
      );
      alert(`Imported ${newEntries.length} new entries to cloud.`);
    } catch (e) {
      console.error('Import failed', e);
      alert('Import failed. Check your connection and try again.');
    }
  };

  // --- Export full backup ---
  const handleExportFullData = () => {
    const fullData = {
      exportDate: new Date().toISOString(),
      type: 'AERO_CHRONOS_FULL_BACKUP',
      version: '1.0',
      data: { profile, logbookEntries, fltckExperience, currentMission: logbookData },
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

  // --- Import full backup (restore) ---
  const handleImportFullData = async (importedData: any) => {
    if (!user) return;
    try {
      if (!importedData?.data) throw new Error('Invalid backup file format');
      const { data } = importedData;
      if (!confirm('⚠️ WARNING: This will OVERWRITE all your current data (Profile, Logbook, Experience). Are you sure?')) return;

      if (data.profile) {
        await persistProfile(user.uid, data.profile);
        setProfile(data.profile);
      }
      if (data.logbookEntries && Array.isArray(data.logbookEntries)) {
        await bulkImportEntries(user.uid, data.logbookEntries);
        setLogbookEntries([...data.logbookEntries].sort((a: LogbookEntry, b: LogbookEntry) => a.date.localeCompare(b.date)));
      }
      if (data.fltckExperience) {
        await persistFltckExperience(user.uid, data.fltckExperience);
        setFltckExperience(data.fltckExperience);
      }
      if (data.currentMission) {
        await persistCurrentMission(user.uid, data.currentMission);
        setLogbookData(data.currentMission);
      }
      alert('✅ Full data restored to cloud successfully!');
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Failed to restore data. Invalid file format.');
    }
  };

  // --- Loading states ---
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(56,189,248,0.2)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: '#475569', fontSize: '0.85rem', letterSpacing: '2px' }}>AEROCHRONOS</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (dataLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(56,189,248,0.2)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading your logbook...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} user={user} onSignOut={signOutUser}>
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
