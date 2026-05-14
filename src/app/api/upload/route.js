import { NextResponse } from 'next/server';
import { checkAuth } from '@/actions';
import { getBucket } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const hostId = formData.get('hostId');
    const file = formData.get('file');
    const storagePath = formData.get('storagePath');

    if (!hostId || !file || !storagePath) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const authenticated = await checkAuth(hostId);
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getBucket();
    const blob = bucket.file(storagePath);

    await blob.save(buffer, {
      metadata: { contentType: file.type || 'application/octet-stream' },
    });

    const [downloadURL] = await blob.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    return NextResponse.json({
      success: true,
      storagePath,
      downloadURL,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
