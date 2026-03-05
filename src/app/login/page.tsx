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
    <main className="mx-auto flex min-h-[78vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-4xl leading-none text-slate-700">⌁</p>
        <p className="mt-2 text-[42px] font-semibold tracking-[-0.03em] text-slate-900">Anaxi Learn</p>
        <p className="mt-1 text-sm text-slate-500">Future Education</p>
      </div>

      <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-800">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="student@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-800">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div className="flex justify-end">
            <a className="text-sm text-slate-500 hover:text-slate-800" href="#">
              Forgot password?
            </a>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Log in →'}
          </button>
        </form>
      </div>

      <p className="text-xs text-slate-400">© 2026 Anaxi. All rights reserved.</p>
    </main>
  );
}
