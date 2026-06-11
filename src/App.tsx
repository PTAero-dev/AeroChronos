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
import SimulatorView from './components/SimulatorView';
import type { Tab, LogbookData, LogbookEntry, PilotProfile, FltckExperience } from './types';
import { calculateFDP } from './utils/fdp';
import { rawToMins } from './utils/calculations';
import { getAircraftConfig } from './utils/aircraft';
import { calculateTypeRatingExpiry } from './utils/currencyTracking';
import { onAuthChange, signOutUser } from './firebase/auth';
import {
  fetchLogbookEntries, fetchProfile, fetchFltckExperience, fetchCurrentMission,
  saveLogbookEntry, removeLogbookEntry, persistProfile, persistFltckExperience,
  persistCurrentMission, bulkImportEntries, fetchSimMissionDraft, persistSimMissionDraft
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
  const [simLogbookData, setSimLogbookData] = useState<LogbookData>({
    date: new Date().toISOString().split('T')[0],
    ac: 'FSTD-136',
    fstdType: 'B300',
    trainingType: 'Recurrent',
    crew: ['', '', '', ''],
    legs: [],
    isSimulator: true,
  });
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
        setSimLogbookData({
          date: new Date().toISOString().split('T')[0],
          ac: 'FSTD-136',
          fstdType: 'B300',
          trainingType: 'Recurrent',
          crew: ['', '', '', ''],
          legs: [],
          isSimulator: true,
        });
      }
    });
    return unsub;
  }, []);

  const loadAllData = async (uid: string) => {
    setDataLoading(true);
    initialized.current = false;
    try {
      const [entries, prof, fltck, mission, simMission] = await Promise.all([
        fetchLogbookEntries(uid),
        fetchProfile(uid),
        fetchFltckExperience(uid),
        fetchCurrentMission(uid),
        fetchSimMissionDraft(uid),
      ]);
      setLogbookEntries(entries);
      if (prof) setProfile(prof);
      if (fltck) setFltckExperience(fltck);
      if (mission) setLogbookData(mission);
      if (simMission) {
        setSimLogbookData(simMission);
      } else {
        setSimLogbookData({
          date: new Date().toISOString().split('T')[0],
          ac: 'FSTD-136',
          fstdType: 'B300',
          trainingType: 'Recurrent',
          crew: ['', '', '', ''],
          legs: [],
          isSimulator: true,
        });
      }
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

  const simMissionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // --- Auto-save current sim mission draft (debounced) ---
  useEffect(() => {
    if (!user || !initialized.current) return;
    if (simMissionDebounce.current) clearTimeout(simMissionDebounce.current);
    simMissionDebounce.current = setTimeout(() => {
      persistSimMissionDraft(user.uid, simLogbookData).catch(console.error);
    }, 1500);
  }, [simLogbookData, user]);

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
  const handleSaveToLogbook = async (isSimParam: any = false) => {
    if (!user) return;

    const isSim = isSimParam === true;
    const currentDraft = isSim ? simLogbookData : logbookData;

    if (currentDraft.legs.length === 0) {
      alert(isSim ? 'No simulator legs to save.' : 'No flight legs to save. Please add legs.');
      return;
    }
    const hasValidLeg = currentDraft.legs.some(l => l.start && l.stop);
    if (!hasValidLeg) {
      alert('Please complete at least one leg with start and stop times.');
      return;
    }

    const userInitials = profile?.pilotName?.trim()?.toUpperCase() || 'PT';
    if (!userInitials) {
      alert('Error: Your Pilot Profile name is missing. Please update your profile.');
      return;
    }

    const isCrew = currentDraft.legs.some(l => {
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

    currentDraft.legs.forEach(leg => {
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

    const hasMultiCrew = currentDraft.legs.some(l => l.pf && l.pm);
    const aircraftConfig = isSim
      ? { model: currentDraft.fstdType || 'B300', isMultiEngine: true, weightClass: (currentDraft.fstdType === 'B200' ? 'light' : 'heavy') as 'light' | 'heavy' }
      : getAircraftConfig(currentDraft.ac);
    const weightClass = aircraftConfig.weightClass;
    const firstLeg = currentDraft.legs[0];
    const lastLeg = currentDraft.legs[currentDraft.legs.length - 1];

    let fdpData = { reportTime: '', offDuty: '', actualFDP: 0, maxFDP: 0, fdpViolation: false };
    if (!isSim && firstLeg.start && lastLeg.stop) {
      const fdpResult = calculateFDP(
        firstLeg.start, lastLeg.stop, currentDraft.legs.length, weightClass, 'multi',
        currentDraft.dutyOverrideEnabled ? currentDraft.dutyOverrideTime : undefined
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
      date: currentDraft.date,
      ac: currentDraft.ac,
      crew: [...currentDraft.crew],
      legs: [...currentDraft.legs],
      totalBlock,
      totalFlight: isSim ? 0 : totalFlight,
      totalIFR: isSim ? 0 : totalIFR,
      totalVFR: isSim ? 0 : totalVFR,
      totalNight: isSim ? 0 : totalNight,
      ...fdpData,
      weightClass,
      picTime: isSim ? 0 : picTime,
      sicTime: isSim ? 0 : sicTime,
      dualTime: 0,
      instructorTime: 0,
      dayLandings: isSim ? 0 : dayLandings,
      nightLandings: isSim ? 0 : nightLandings,
      isSinglePilot: isSim ? false : !hasMultiCrew,
      isMultiCrew: isSim ? false : hasMultiCrew,
      aircraftModel: aircraftConfig.model,
      isMultiEngine: isSim ? false : aircraftConfig.isMultiEngine,
      isSimulator: isSim || !!currentDraft.isSimulator,
      fstdType: isSim ? currentDraft.fstdType : undefined,
      fstdDeviceId: isSim ? currentDraft.ac : undefined,
      trainingType: isSim ? currentDraft.trainingType : undefined,
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

    if (isSim) {
      const clearedSim: LogbookData = {
        date: new Date().toISOString().split('T')[0],
        ac: 'FSTD-136',
        fstdType: 'B300',
        trainingType: 'Recurrent',
        crew: ['', '', '', ''],
        legs: [],
        isSimulator: true,
      };
      setSimLogbookData(clearedSim);
      setActiveTab('logbook');
      alert('Simulator session saved to logbook!');
    } else {
      const clearedMission: LogbookData = {
        date: new Date().toISOString().split('T')[0],
        ac: logbookData.ac,
        crew: ['', '', '', ''],
        legs: [],
      };
      setLogbookData(clearedMission);
      setActiveTab('logbook');
      alert('Mission saved to logbook!');
    }
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
    if (entry.isSimulator) {
      setSimLogbookData({
        date: entry.date,
        ac: entry.ac,
        crew: entry.crew as [string, string, string, string],
        legs: entry.legs,
        isSimulator: true,
        fstdType: entry.fstdType,
        trainingType: entry.trainingType,
      });
      setEditingEntryId(entry.id);
      setActiveTab('simulator');
    } else {
      setLogbookData({
        date: entry.date,
        ac: entry.ac,
        crew: entry.crew as [string, string, string, string],
        legs: entry.legs,
      });
      setEditingEntryId(entry.id);
      setActiveTab('mission');
    }
  };

  const handleReset = (isSim: boolean = false) => {
    if (isSim) {
      setSimLogbookData({
        date: new Date().toISOString().split('T')[0],
        ac: 'FSTD-136',
        fstdType: 'B300',
        trainingType: 'Recurrent',
        crew: ['', '', '', ''],
        legs: [],
        isSimulator: true,
      });
    } else {
      setLogbookData({
        date: new Date().toISOString().split('T')[0],
        ac: logbookData.ac,
        crew: ['', '', '', ''],
        legs: [],
      });
    }
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
      data: { profile, logbookEntries, fltckExperience, currentMission: logbookData, simMissionDraft: simLogbookData },
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
      if (data.simMissionDraft) {
        await persistSimMissionDraft(user.uid, data.simMissionDraft);
        setSimLogbookData(data.simMissionDraft);
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

  const b300Currency = calculateTypeRatingExpiry('B300', profile, logbookEntries);
  const b200Currency = calculateTypeRatingExpiry('B200', profile, logbookEntries);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} user={user} onSignOut={signOutUser}>
      {/* Type Rating Expiry Alert Banner */}
      {(() => {
        const alerts: { type: 'warning' | 'expired'; message: string }[] = [];
        
        if (b300Currency.status === 'warning') {
          alerts.push({ type: 'warning', message: `⚠️ B300 Type Rating renewal is open! Expiry: ${b300Currency.expiryDate}` });
        } else if (b300Currency.status === 'expired') {
          alerts.push({ type: 'expired', message: `🚨 B300 Type Rating is EXPIRED / INVALID! Expiry: ${b300Currency.expiryDate}` });
        }

        if (b200Currency.status === 'warning') {
          alerts.push({ type: 'warning', message: `⚠️ B200 Type Rating renewal is open! Expiry: ${b200Currency.expiryDate}` });
        } else if (b200Currency.status === 'expired') {
          alerts.push({ type: 'expired', message: `🚨 B200 Type Rating is EXPIRED / INVALID! Expiry: ${b200Currency.expiryDate}` });
        }

        if (alerts.length === 0) return null;

        return (
          <div style={{
            maxWidth: '800px',
            margin: '0 auto 16px auto',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  background: alert.type === 'expired' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${alert.type === 'expired' ? '#ef4444' : '#f59e0b'}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: alert.type === 'expired' ? '#fca5a5' : '#fde047',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                <span>{alert.message}</span>
                <button
                  onClick={() => setActiveTab('simulator')}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${alert.type === 'expired' ? '#ef4444' : '#f59e0b'}`,
                    color: alert.type === 'expired' ? '#ef4444' : '#f59e0b',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  View Sim
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {activeTab === 'mission' && (
        <MissionDashboard data={logbookData} updateData={setLogbookData} onSave={() => handleSaveToLogbook(false)} onReset={handleReset} onNavigateToFDP={() => setActiveTab('duty')} />
      )}
      {activeTab === 'simulator' && (
        <SimulatorView
          data={simLogbookData}
          updateData={setSimLogbookData}
          onSave={() => handleSaveToLogbook(true)}
          onReset={() => handleReset(true)}
          logbookEntries={logbookEntries}
          profile={profile}
        />
      )}
      {activeTab === 'duty' && (
        <FDPView data={logbookData} onUpdateData={setLogbookData} onSave={() => handleSaveToLogbook(false)} />
      )}
      {activeTab === 'logbook' && (
        <LogbookView
          currentMission={logbookData}
          logbookEntries={logbookEntries}
          onSaveToLogbook={() => handleSaveToLogbook(false)}
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
