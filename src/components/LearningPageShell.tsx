import { ReactNode } from 'react';

interface LearningPageShellProps {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
}

export function LearningPageShell({
  title,
  subtitle,
  meta,
  actions,
  children,
  maxWidthClassName = 'max-w-5xl',
}: LearningPageShellProps) {
  return (
    <main className="anx-shell">
      <div className={`mx-auto w-full ${maxWidthClassName} px-4 sm:px-6`}>
        <header className="mb-8 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--anx-text)' }}>{title}</h1>
              {subtitle && <p className="text-sm sm:text-base" style={{ color: 'var(--anx-text-muted)' }}>{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {meta && (
            <div className="anx-card p-4 text-sm" style={{ color: 'var(--anx-text-secondary)' }}>
              {meta}
            </div>
          )}
        </header>

        <div className="space-y-6">{children}</div>
      </div>
    </main>
  );
}
