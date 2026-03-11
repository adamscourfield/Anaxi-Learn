import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { loadIngestionContext } from '@/features/content-ingestion/modeBank';
import { readStagedBatch } from '@/features/content-ingestion/staging';
import { publishImportedBatch } from '@/features/content-ingestion/publish/publishImportedBatch';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { batchFile?: string };
  if (!body.batchFile) {
    return NextResponse.json({ error: 'Missing batchFile' }, { status: 400 });
  }

  const batch = readStagedBatch(body.batchFile);
  const context = loadIngestionContext();
  const result = await publishImportedBatch(
    batch.map((entry) => entry.question),
    context,
    { batchLabel: `republish-${body.batchFile.replace(/\.json$/, '')}` }
  );

  return NextResponse.json(result);
}
