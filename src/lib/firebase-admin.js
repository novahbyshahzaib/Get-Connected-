import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadServiceAccount() {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!envPath) return null;
  const absolutePath = join(process.cwd(), envPath.replace('./', ''));
  try {
    const raw = readFileSync(absolutePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
}

const adminDb = admin.firestore();
const adminStorage = admin.storage();
const bucket = adminStorage.bucket();

export { admin, adminDb, adminStorage, bucket };
