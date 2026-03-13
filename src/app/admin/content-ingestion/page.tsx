import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/features/auth/authOptions';
import { listStagedBatches, readStagedBatch } from '@/features/content-ingestion/staging';
import { ContentIngestionReviewClient } from '@/components/admin/ContentIngestionReviewClient';

export default async function AdminContentIngestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const batches = listStagedBatches();
  const entriesByBatch = Object.fromEntries(batches.map((batch) => [batch.id, readStagedBatch(batch.fileName)]));

  return (
    <main className="anx-shell">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--anx-text)' }}>Content Ingestion Review</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
              Review staged imported items, inspect mapping issues, and publish the valid subset safely.
            </p>
          </div>
          <a href="/admin/content/ks3-maths" className="anx-link text-sm">
            ← Back to Question QA Lab
          </a>
        </div>

        <ContentIngestionReviewClient batches={batches} entriesByBatch={entriesByBatch} />
      </div>
    </main>
  );
}
