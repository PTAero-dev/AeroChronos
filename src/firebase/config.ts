import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBPKVetkmJz0hVQ11_upMp-EJ0F90JMxME",
  authDomain: "aerochronos-6d81c.firebaseapp.com",
  projectId: "aerochronos-6d81c",
  storageBucket: "aerochronos-6d81c.firebasestorage.app",
  messagingSenderId: "247145190520",
  appId: "1:247145190520:web:c53e9d66e7469f08e6898d"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
