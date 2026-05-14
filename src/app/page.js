'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyPin, verifySessionToken } from '@/actions';

export default function Home() {
  const router = useRouter();
  const [hostId, setHostId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('join');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    tryAutoLogin();
  }, []);

  const tryAutoLogin = async () => {
    try {
      const raw = localStorage.getItem('gc_auth');
      if (!raw) { setCheckingAuth(false); return; }

      const sessions = JSON.parse(raw);
      for (const [sid, token] of Object.entries(sessions)) {
        const result = await verifySessionToken(sid, token);
        if (result.valid) {
          router.push(`/dashboard/${sid}`);
          return;
        }
      }
    } catch {}
    setCheckingAuth(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await verifyPin(hostId, pin);
      if (result.success) {
        storeAuth(hostId, result.token);
        router.push(`/dashboard/${hostId}`);
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const storeAuth = (sid, token) => {
    try {
      const raw = localStorage.getItem('gc_auth');
      const sessions = raw ? JSON.parse(raw) : {};
      sessions[sid] = token;
      localStorage.setItem('gc_auth', JSON.stringify(sessions));
    } catch {}
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="glass rounded-2xl p-8 md:p-12 w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Get Connected
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            {mode === 'join'
              ? 'Enter a Host ID and PIN to access shared files'
              : 'Upload and share files securely'}
          </p>
        </div>

        {mode === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Host ID</label>
              <input
                type="text"
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                placeholder="Enter Host ID"
                className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !hostId || !pin}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Access Files'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm text-center">
              Want to share files? Click below to create a new share link.
            </p>
            <button
              onClick={() => router.push('/host')}
              className="btn-primary w-full"
            >
              Share Files
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'join' ? 'share' : 'join');
              setError('');
            }}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {mode === 'join'
              ? 'Want to share files instead?'
              : 'Want to access files instead?'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Firebase Connected
      </div>
    </div>
  );
}
