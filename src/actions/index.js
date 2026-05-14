'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/firebase-admin';

function getSessionDoc(hostId) {
  return adminDb.collection('sessions').doc(hostId);
}

export async function createSession(pin) {
  const hostId = nanoid(8);
  const pinHash = await bcrypt.hash(pin, 10);

  await getSessionDoc(hostId).set({
    pinHash,
    files: [],
    createdAt: new Date().toISOString(),
    accessTokens: [],
  });

  return hostId;
}

export async function saveFileMetadata(hostId, files) {
  const session = await getSessionDoc(hostId).get();
  if (!session.exists) throw new Error('Session not found');

  await getSessionDoc(hostId).update({
    files: adminDb.FieldValue.arrayUnion(...files),
  });

  return { success: true };
}

export async function verifyPin(hostId, pin) {
  const session = await getSessionDoc(hostId).get();
  if (!session.exists) {
    return { success: false, error: 'Invalid Host ID' };
  }

  const data = session.data();
  const match = await bcrypt.compare(pin, data.pinHash);
  if (!match) {
    return { success: false, error: 'Invalid PIN' };
  }

  const token = nanoid(32);
  await getSessionDoc(hostId).update({
    accessTokens: adminDb.FieldValue.arrayUnion(token),
  });

  const cookieStore = await cookies();
  cookieStore.set(`auth_${hostId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return { success: true };
}

export async function checkAuth(hostId) {
  const cookieStore = await cookies();
  const token = cookieStore.get(`auth_${hostId}`);
  if (!token) return false;

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return false;

  const data = session.data();
  return data.accessTokens?.includes(token.value) || false;
}

export async function getFiles(hostId) {
  const authenticated = await checkAuth(hostId);
  if (!authenticated) {
    redirect('/');
  }

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return [];

  const data = session.data();
  return buildFileTree(data.files || []);
}

export async function getRawFiles(hostId) {
  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return [];

  const data = session.data();
  return data.files || [];
}

function buildFileTree(flatFiles) {
  const tree = [];

  for (const file of flatFiles) {
    const parts = file.fullPath.split('/');
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        currentLevel.push({
          name: part,
          type: 'file',
          size: file.size,
          mimeType: file.mimeType,
          storagePath: file.storagePath,
          fullPath: file.fullPath,
        });
      } else {
        let existing = currentLevel.find(
          (item) => item.name === part && item.type === 'folder'
        );
        if (!existing) {
          existing = { name: part, type: 'folder', children: [] };
          currentLevel.push(existing);
        }
        currentLevel = existing.children;
      }
    }
  }

  return tree;
}

export async function getFileDownloadUrl(hostId, storagePath) {
  const authenticated = await checkAuth(hostId);
  if (!authenticated) {
    redirect('/');
  }

  const { bucket } = await import('@/lib/firebase-admin');
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  return url;
}
