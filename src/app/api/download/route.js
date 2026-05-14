import { NextResponse } from 'next/server';
import { checkAuth, getRawFiles } from '@/actions';
import { bucket } from '@/lib/firebase-admin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');
  const storagePath = searchParams.get('path');

  if (!hostId || !storagePath) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const authenticated = await checkAuth(hostId);
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [url] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
