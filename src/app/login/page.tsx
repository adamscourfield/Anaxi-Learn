'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3d63ff] to-[#5578ff]">
            <span className="text-xl font-bold text-white tracking-tight">A</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>
            Anaxi Learn
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
            Sign in to continue learning
          </p>
        </div>

        <div className="anx-panel p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium" style={{ color: 'var(--anx-text-secondary)' }}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="student@example.com"
                className="anx-input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium" style={{ color: 'var(--anx-text-secondary)' }}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                className="anx-input"
                required
              />
            </div>

            <div className="flex justify-end">
              <a className="anx-btn-ghost text-xs" href="#">
                Forgot password?
              </a>
            </div>

            {error ? (
              <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--anx-danger)', background: 'var(--anx-danger-soft)', color: '#dc2626' }}>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="anx-btn-primary w-full py-3"
            >
              {loading ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--anx-text-faint)' }}>
          &copy; 2026 Anaxi. All rights reserved.
        </p>
      </div>
    </main>
  );
}
