import { NextResponse } from 'next/server';
import { checkAuth, getRawFiles } from '@/actions';
import { getBucket } from '@/lib/firebase-admin';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');

  if (!hostId) {
    return NextResponse.json({ error: 'Missing hostId' }, { status: 400 });
  }

  const authenticated = await checkAuth(hostId);
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = await getRawFiles(hostId);
    const zip = new JSZip();

    for (const file of files) {
      try {
        const [url] = await getBucket().file(file.storagePath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        zip.file(file.fullPath, Buffer.from(buffer));
      } catch (err) {
        console.error(`Failed to add ${file.fullPath} to zip:`, err);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${hostId}-files.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create zip' }, { status: 500 });
  }
}
