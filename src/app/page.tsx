import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-4xl font-bold text-gray-900">Anaxi Learn</h1>
        <p className="text-lg text-gray-600">Adaptive mastery learning, built for students.</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
