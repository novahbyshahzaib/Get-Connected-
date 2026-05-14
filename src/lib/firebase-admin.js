import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let initialized = false;

function loadServiceAccount() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonEnv) {
    try {
      return JSON.parse(jsonEnv);
    } catch {}
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    try {
      const absPath = join(process.cwd(), filePath.replace('./', ''));
      const raw = readFileSync(absPath, 'utf-8');
      return JSON.parse(raw);
    } catch {}
  }

  return null;
}

function ensureInit() {
  if (initialized) return true;
  if (admin.apps.length) {
    initialized = true;
    return true;
  }

  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    initialized = true;
    return true;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function getAdminDb() {
  if (!ensureInit()) throw new Error('Firebase Admin not initialized (missing credentials)');
  return admin.firestore();
}

export function getBucket() {
  if (!ensureInit()) throw new Error('Firebase Admin not initialized (missing credentials)');
  return admin.storage().bucket();
}
