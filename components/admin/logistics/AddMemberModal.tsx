'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { X, Loader2, UserPlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddMemberModalProps {
  teamId: string;
  teamName: string;
  currentMemberCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls =
  'w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all';

export function AddMemberModal({
  teamId,
  teamName,
  currentMemberCount,
  onClose,
  onSuccess,
}: AddMemberModalProps) {
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    college: '',
    degree: '',
    year: '',
    role: 'MEMBER' as 'MEMBER' | 'CO_LEADER',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addMember = trpc.logistics.addMember.useMutation({
    onSuccess: () => {
      toast.success(`${form.name || form.email} added to ${teamName}`);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
      setErrors({ _global: err.message });
    },
  });

  const set = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key]; delete n._global; return n; });
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    addMember.mutate({
      teamId,
      email: form.email.trim(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      college: form.college.trim() || undefined,
      degree: form.degree.trim() || undefined,
      year: form.year.trim() || undefined,
      role: form.role,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0A0A0A] rounded-xl border border-white/[0.08] w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-400" />
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wider">ADD MEMBER</h2>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                {teamName} · {currentMemberCount}/6 members
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Global error */}
          {errors._global && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <p className="text-[10px] font-mono text-red-300">{errors._global}</p>
            </div>
          )}

          {/* Required fields */}
          <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
            <p className="text-[8px] font-mono font-bold text-emerald-400 tracking-widest">REQUIRED</p>

            <div>
              <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                EMAIL <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="member@example.com"
                className={`${inputCls} ${errors.email ? 'border-red-500/30' : ''}`}
                autoFocus
              />
              {errors.email && <p className="text-[9px] font-mono text-red-400 mt-1">{errors.email}</p>}
              <p className="text-[8px] font-mono text-gray-700 mt-1">
                If this email is already registered, the existing account will be used.
              </p>
            </div>

            <div>
              <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                FULL NAME <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Full name"
                className={`${inputCls} ${errors.name ? 'border-red-500/30' : ''}`}
              />
              {errors.name && <p className="text-[9px] font-mono text-red-400 mt-1">{errors.name}</p>}
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-3">
            <p className="text-[8px] font-mono font-bold text-gray-600 tracking-widest">OPTIONAL</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-mono font-bold text-gray-600 tracking-widest mb-1">PHONE</label>
                <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                  placeholder="+91 XXXXXXXXXX" className={inputCls} />
              </div>
              <div>
                <label className="block text-[8px] font-mono font-bold text-gray-600 tracking-widest mb-1">YEAR</label>
                <input type="text" value={form.year} onChange={(e) => set('year', e.target.value)}
                  placeholder="2nd Year" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-[8px] font-mono font-bold text-gray-600 tracking-widest mb-1">COLLEGE</label>
              <input type="text" value={form.college} onChange={(e) => set('college', e.target.value)}
                placeholder="College name" className={inputCls} />
            </div>

            <div>
              <label className="block text-[8px] font-mono font-bold text-gray-600 tracking-widest mb-1">DEGREE / BRANCH</label>
              <input type="text" value={form.degree} onChange={(e) => set('degree', e.target.value)}
                placeholder="B.Tech Computer Science" className={inputCls} />
            </div>

            <div>
              <label className="block text-[8px] font-mono font-bold text-gray-600 tracking-widest mb-1">ROLE IN TEAM</label>
              <div className="flex gap-2">
                {(['MEMBER', 'CO_LEADER'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('role', r)}
                    className={`flex-1 py-1.5 text-[9px] font-mono font-bold rounded border transition-all ${
                      form.role === r
                        ? r === 'CO_LEADER'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'text-gray-600 border-white/[0.06] hover:text-gray-400'
                    }`}
                  >
                    {r === 'CO_LEADER' ? 'CO-LEADER' : 'MEMBER'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Capacity warning */}
          {currentMemberCount >= 5 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[9px] font-mono text-amber-300">
                {currentMemberCount >= 6
                  ? 'Team is full (6/6). Cannot add more members.'
                  : `Team is almost full (${currentMemberCount}/6). This will be the last slot.`}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:bg-white/[0.05] transition-all">
              CANCEL
            </button>
            <button type="submit" disabled={addMember.isPending || currentMemberCount >= 6}
              className="flex-1 py-2 text-[10px] font-mono font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {addMember.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> ADDING...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> ADD MEMBER</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
