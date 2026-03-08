'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'LOGIN' }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      setStep('OTP');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, purpose: 'LOGIN' }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Invalid OTP');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center font-mono p-4">
      <div className="w-full max-w-md border border-white/10 bg-[#050505] p-8 md:p-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">
            Participant <span className="text-orange-500">Login</span>
          </h1>
          <p className="text-gray-400 text-xs tracking-widest uppercase mb-4">
            IndiaNext Hackathon
          </p>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 p-3 mb-6 flex items-center gap-3">
            <span className="text-red-500">⚠</span>
            <span className="text-xs text-red-400 capitalize">{errorMsg}</span>
          </div>
        )}

        {step === 'EMAIL' ? (
          <form onSubmit={requestOtp} className="space-y-6">
            <div>
              <label className="block text-[10px] text-gray-500 tracking-[0.2em] font-black uppercase mb-2">
                Registered Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="leader@example.com"
                required
                className="w-full bg-black border border-white/20 p-4 text-sm focus:border-orange-500 outline-none transition-colors"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-black font-black uppercase tracking-widest py-4 text-xs transition-colors"
            >
              {loading ? 'Sending OTP...' : 'Send Login OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-6">
            <div>
              <label className="block text-[10px] text-gray-500 tracking-[0.2em] font-black uppercase mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                required
                maxLength={6}
                className="w-full bg-black border border-white/20 p-4 text-center text-xl tracking-[0.5em] focus:border-orange-500 outline-none transition-colors font-bold"
                autoComplete="one-time-code"
              />
              <p className="text-[10px] text-gray-500 mt-2">Sent to {email}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-black font-black uppercase tracking-widest py-4 text-xs transition-colors"
            >
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('EMAIL');
                setOtp('');
                setErrorMsg('');
              }}
              className="w-full text-[10px] text-gray-500 hover:text-white uppercase tracking-widest text-center"
            >
              ← Use different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
