// Edit Member Modal — Edit non-leader member info (name, phone, email, college)
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { X, Loader2, Save } from 'lucide-react';
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
    year: string | null;
  };
}

interface EditMemberModalProps {
  memberId: string;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMemberModal({
  memberId,
  teamMembers,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const member = teamMembers.find((m) => m.id === memberId);

  const [form, setForm] = useState({
    name: member?.user.name || '',
    email: member?.user.email || '',
    phone: member?.user.phone || '',
    college: member?.user.college || '',
    year: member?.user.year || '',
  });

  const editMember = trpc.logistics.editMemberInfo.useMutation();

  if (!member) return null;
  if (member.role === 'LEADER') return null; // Safety check

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      await editMember.mutateAsync({
        memberId,
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        college: form.college.trim() || undefined,
        year: form.year.trim() || undefined,
      });
      toast.success('Member info updated');
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update member';
      toast.error(message);
    }
  };

  const fields = [
    { key: 'name' as const, label: 'NAME', placeholder: 'Full name', required: true },
    {
      key: 'email' as const,
      label: 'EMAIL',
      placeholder: 'email@example.com',
      type: 'email',
      required: true,
    },
    { key: 'phone' as const, label: 'PHONE', placeholder: '+91 XXXXXXXXXX', required: false },
    {
      key: 'college' as const,
      label: 'COLLEGE',
      placeholder: 'College/University name',
      required: false,
    },
    { key: 'year' as const, label: 'YEAR', placeholder: 'e.g. 2nd Year', required: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.08] w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-mono font-bold text-white tracking-wider">EDIT MEMBER</h2>
            <p className="text-[9px] font-mono text-gray-500 mt-0.5">
              {member.user.name || member.user.email} • All changes are audit-logged
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

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[8px] font-mono font-bold text-gray-500 tracking-widest mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              <input
                type={('type' in field && field.type) || 'text'}
                value={form[field.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                required={field.required}
              />
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded hover:bg-white/[0.05] transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={editMember.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editMember.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              SAVE CHANGES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
