import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="anx-shell flex items-center">
      <div className="anx-container">
        <section className="anx-panel mx-auto max-w-3xl px-8 py-12 sm:px-14 sm:py-16">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3d63ff] to-[#5578ff]">
              <span className="text-xl font-bold text-white tracking-tight">A</span>
            </div>
            <p className="anx-section-label">Anaxi Family</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: 'var(--anx-text)' }}>
              Anaxi Learn
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed sm:text-lg" style={{ color: 'var(--anx-text-muted)' }}>
              Adaptive mastery learning with clean pacing, targeted practice, and progress that stays easy to read.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xs">
            <div className="anx-divider" />
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/login" className="anx-btn-primary px-8 py-3.5 text-base">
              Sign In
            </Link>
            <Link href="/dashboard" className="anx-btn-secondary px-8 py-3.5 text-base">
              Open Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
