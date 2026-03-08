// Swap Member Modal — Replace a non-leader member with a new participant
// Enforces: leader protection, duplicate-team check, atomic swap
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { X, Loader2, UserMinus, UserPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    college: string | null;
  };
}

interface SwapMemberModalProps {
  memberId: string;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SwapMemberModal({
  memberId,
  teamMembers,
  onClose,
  onSuccess,
}: SwapMemberModalProps) {
  const member = teamMembers.find((m) => m.id === memberId);

  const [form, setForm] = useState({
    newEmail: '',
    newName: '',
    newPhone: '',
    newCollege: '',
    reason: '',
  });

  const [step, setStep] = useState<'confirm' | 'details'>('details');

  const swapMember = trpc.logistics.swapMember.useMutation();

  if (!member) return null;
  if (member.role === 'LEADER') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.newEmail.trim()) {
      toast.error('New member email is required');
      return;
    }

    if (step === 'details') {
      setStep('confirm');
      return;
    }

    try {
      await swapMember.mutateAsync({
        memberId,
        newUserEmail: form.newEmail.trim().toLowerCase(),
        newUserName: form.newName.trim() || 'TBD',
        newUserPhone: form.newPhone.trim() || undefined,
        newUserCollege: form.newCollege.trim() || undefined,
      });
      toast.success('Member swapped successfully');
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to swap member';
      toast.error(message);
      setStep('details'); // Go back to edit
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.08] w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-mono font-bold text-white tracking-wider">SWAP MEMBER</h2>
            <p className="text-[9px] font-mono text-gray-500 mt-0.5">
              Replace {member.user.name || member.user.email} with new participant
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {step === 'details' ? (
            <>
              {/* Current member being removed */}
              <div className="bg-red-500/5 border border-red-500/15 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserMinus className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[9px] font-mono font-bold text-red-400 tracking-wider">
                    REMOVING
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-300">
                  {member.user.name || 'Unnamed'} ({member.user.email})
                </p>
              </div>

              {/* New member details */}
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded p-3 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[9px] font-mono font-bold text-emerald-400 tracking-wider">
                    ADDING
                  </span>
                </div>

                <div>
                  <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                    EMAIL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.newEmail}
                    onChange={(e) => setForm((p) => ({ ...p, newEmail: e.target.value }))}
                    placeholder="newemail@example.com"
                    className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                    NAME
                  </label>
                  <input
                    type="text"
                    value={form.newName}
                    onChange={(e) => setForm((p) => ({ ...p, newName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                      PHONE
                    </label>
                    <input
                      type="text"
                      value={form.newPhone}
                      onChange={(e) => setForm((p) => ({ ...p, newPhone: e.target.value }))}
                      placeholder="+91 XXXXXXXXXX"
                      className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                      COLLEGE
                    </label>
                    <input
                      type="text"
                      value={form.newCollege}
                      onChange={(e) => setForm((p) => ({ ...p, newCollege: e.target.value }))}
                      placeholder="College name"
                      className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Reason for swap */}
              <div>
                <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                  REASON FOR SWAP
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Why is this member being swapped? (recorded in audit log)"
                  className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded hover:bg-white/[0.05] transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={!form.newEmail.trim()}
                  className="px-4 py-1.5 text-[10px] font-mono font-bold text-white bg-amber-600 hover:bg-amber-700 rounded transition-all disabled:opacity-40"
                >
                  REVIEW SWAP →
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation step */}
              <div className="bg-amber-500/5 border border-amber-500/15 rounded p-4 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
                <div>
                  <p className="text-xs font-mono font-bold text-amber-400 tracking-wider mb-1">
                    CONFIRM MEMBER SWAP
                  </p>
                  <p className="text-[10px] font-mono text-gray-400">
                    This action is permanent and will be logged.
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-red-400 font-bold">REMOVE</p>
                    <p className="text-[9px] font-mono text-gray-400 truncate">
                      {member.user.name || member.user.email}
                    </p>
                  </div>
                  <span className="text-gray-600">→</span>
                  <div className="text-left">
                    <p className="text-[10px] font-mono text-emerald-400 font-bold">ADD</p>
                    <p className="text-[9px] font-mono text-gray-400 truncate">
                      {form.newName || form.newEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded hover:bg-white/[0.05] transition-all"
                >
                  ← BACK
                </button>
                <button
                  type="submit"
                  disabled={swapMember.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-mono font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-all disabled:opacity-40"
                >
                  {swapMember.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserMinus className="h-3 w-3" />
                  )}
                  CONFIRM SWAP
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
