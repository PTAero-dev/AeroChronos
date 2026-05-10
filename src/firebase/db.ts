import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from './config';
import type { LogbookEntry, PilotProfile, FltckExperience, LogbookData } from '../types';

// --- Logbook Entries ---

export const fetchLogbookEntries = async (uid: string): Promise<LogbookEntry[]> => {
  const q = query(collection(db, 'users', uid, 'logbookEntries'), orderBy('date'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as LogbookEntry);
};

export const saveLogbookEntry = async (uid: string, entry: LogbookEntry): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'logbookEntries', entry.id), entry);
};

export const removeLogbookEntry = async (uid: string, entryId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'logbookEntries', entryId));
};

export const bulkImportEntries = async (uid: string, entries: LogbookEntry[]): Promise<void> => {
  await Promise.all(
    entries.map(e => setDoc(doc(db, 'users', uid, 'logbookEntries', e.id), e))
  );
};

// --- Profile ---

export const fetchProfile = async (uid: string): Promise<PilotProfile | undefined> => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'));
  return snap.exists() ? (snap.data() as PilotProfile) : undefined;
};

export const persistProfile = async (uid: string, profile: PilotProfile): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'data', 'profile'), profile);
};

// --- FLTCK / FIVP Experience ---

export const fetchFltckExperience = async (uid: string): Promise<FltckExperience | undefined> => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'fltckExperience'));
  return snap.exists() ? (snap.data() as FltckExperience) : undefined;
};

export const persistFltckExperience = async (uid: string, exp: FltckExperience): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'data', 'fltckExperience'), exp);
};

// --- Current Mission Draft ---

export const fetchCurrentMission = async (uid: string): Promise<LogbookData | undefined> => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'currentMission'));
  return snap.exists() ? (snap.data() as LogbookData) : undefined;
};

export const persistCurrentMission = async (uid: string, mission: LogbookData): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'data', 'currentMission'), mission);
};
