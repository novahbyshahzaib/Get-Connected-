'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase-admin';

function getSessionDoc(hostId) {
  return getAdminDb().collection('sessions').doc(hostId);
}

export async function createSession(pin) {
  const hostId = nanoid(8);
  const pinHash = await bcrypt.hash(pin, 10);
  const hostToken = nanoid(32);
  const accessToken = nanoid(32);

  await getSessionDoc(hostId).set({
    pinHash,
    files: [],
    createdAt: new Date().toISOString(),
    hostToken,
    accessTokens: [accessToken],
  });

  const cookieStore = await cookies();
  cookieStore.set(`auth_${hostId}`, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return { hostId, hostToken, accessToken };
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
    accessTokens: admin.firestore.FieldValue.arrayUnion(token),
  });

  const cookieStore = await cookies();
  cookieStore.set(`auth_${hostId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return { success: true, token };
}

export async function verifySessionToken(hostId, token) {
  if (!hostId || !token) return { valid: false };

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return { valid: false };

  const data = session.data();
  const valid = data.accessTokens?.includes(token) || false;

  if (valid) {
    const cookieStore = await cookies();
    cookieStore.set(`auth_${hostId}`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return {
      valid: true,
      isHost: data.hostToken === token,
    };
  }

  return { valid: false };
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
  if (!authenticated) redirect('/');

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return [];

  const data = session.data();
  return { files: buildFileTree(data.files || []), isHost: false };
}

export async function getSessionInfo(hostId) {
  const authenticated = await checkAuth(hostId);
  if (!authenticated) redirect('/');

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return null;

  const data = session.data();

  const cookieStore = await cookies();
  const token = cookieStore.get(`auth_${hostId}`);

  return {
    fileCount: data.files?.length || 0,
    isHost: data.hostToken === token?.value,
    createdAt: data.createdAt,
  };
}

export async function getRawFiles(hostId) {
  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return [];

  const data = session.data();
  return data.files || [];
}

export async function addFiles(hostId, files) {
  const authenticated = await checkAuth(hostId);
  if (!authenticated) throw new Error('Not authenticated');

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) throw new Error('Session not found');

  await getSessionDoc(hostId).update({
    files: admin.firestore.FieldValue.arrayUnion(...files),
  });

  return { success: true };
}

export async function changePin(hostId, currentPin, newPin) {
  const cookieStore = await cookies();
  const token = cookieStore.get(`auth_${hostId}`);
  if (!token) return { success: false, error: 'Not authenticated' };

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return { success: false, error: 'Session not found' };

  const data = session.data();
  if (data.hostToken !== token.value) {
    return { success: false, error: 'Only the host can change the PIN' };
  }

  const match = await bcrypt.compare(currentPin, data.pinHash);
  if (!match) return { success: false, error: 'Current PIN is incorrect' };

  const newPinHash = await bcrypt.hash(newPin, 10);
  await getSessionDoc(hostId).update({ pinHash: newPinHash });

  return { success: true };
}

export async function kickUsers(hostId) {
  const cookieStore = await cookies();
  const token = cookieStore.get(`auth_${hostId}`);
  if (!token) return { success: false, error: 'Not authenticated' };

  const session = await getSessionDoc(hostId).get();
  if (!session.exists) return { success: false, error: 'Session not found' };

  const data = session.data();
  if (data.hostToken !== token.value) {
    return { success: false, error: 'Only the host can kick users' };
  }

  await getSessionDoc(hostId).update({ accessTokens: [data.hostToken] });

  return { success: true };
}

export async function getFileDownloadUrl(hostId, storagePath) {
  const authenticated = await checkAuth(hostId);
  if (!authenticated) redirect('/');

  const { getBucket } = await import('@/lib/firebase-admin');
  const [url] = await getBucket().file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  return url;
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
