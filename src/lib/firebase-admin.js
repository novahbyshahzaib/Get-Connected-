import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let initialized = false;

function ensureInit() {
  if (initialized) return true;
  if (admin.apps.length) {
    initialized = true;
    return true;
  }

  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let serviceAccount = null;
  if (envPath) {
    try {
      const absPath = join(process.cwd(), envPath.replace('./', ''));
      const raw = readFileSync(absPath, 'utf-8');
      serviceAccount = JSON.parse(raw);
    } catch {
      return false;
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    initialized = true;
    return true;
  }

  return false;
}

export function getAdminDb() {
  if (!ensureInit()) throw new Error('Firebase Admin not initialized (missing credentials)');
  return admin.firestore();
}

export function getBucket() {
  if (!ensureInit()) throw new Error('Firebase Admin not initialized (missing credentials)');
  return admin.storage().bucket();
}
