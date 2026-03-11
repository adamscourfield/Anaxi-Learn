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
    <main className="min-h-screen bg-gray-50 py-10 sm:py-12">
      <div className={`mx-auto w-full ${maxWidthClassName} px-4 sm:px-6`}>
        <header className="mb-6 space-y-3 sm:mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
              {subtitle && <p className="text-sm text-gray-600 sm:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {meta && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{meta}</div>}
        </header>

        <div className="space-y-6">{children}</div>
      </div>
    </main>
  );
}
