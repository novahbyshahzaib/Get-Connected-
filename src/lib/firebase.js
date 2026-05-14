import { initializeApp, getApps } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC4DUpH8TYhzwErRH7iMNFejcFEQlU3hh0',
  authDomain: 'get-connected-4c9e4.firebaseapp.com',
  projectId: 'get-connected-4c9e4',
  storageBucket: 'get-connected-4c9e4.firebasestorage.app',
  messagingSenderId: '336490868928',
  appId: '1:336490868928:web:f28570226e29a2b0bebd25',
  measurementId: 'G-Q2WRB31LGK',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const storage = getStorage(app);
const db = getFirestore(app);

export { app, storage, db };
