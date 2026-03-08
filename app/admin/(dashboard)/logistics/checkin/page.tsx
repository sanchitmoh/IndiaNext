// QR Check-in Landing Page
// When logistics scans a team's QR code from the approval email,
// this page auto-looks up the team and provides instant check-in action.
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  MapPin,
  Clock,
  QrCode,
} from 'lucide-react';

function CheckinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code') || '';

  const [shortCode, setShortCode] = useState(code);
  const [teamData, setTeamData] = useState<{
    id: string;
    name: string;
    shortCode: string;
    track: string;
    college: string | null;
    size: number;
    attendance: string;
    checkedInAt: Date | null;
    members: Array<{
      id: string;
      role: string;
      isPresent: boolean;
      user: { name: string; email: string };
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkinDone, setCheckinDone] = useState(false);

  const utils = trpc.useUtils();
  const markAttendance = trpc.logistics.markTeamAttendance.useMutation();

  const lookupTeam = useCallback(
    async (codeToLookup: string) => {
      if (!codeToLookup.trim()) return;
      setLoading(true);
      setError('');
      setTeamData(null);
      setCheckinDone(false);
      try {
        const result = await utils.logistics.getTeamByShortCode.fetch({
          shortCode: codeToLookup.trim().toUpperCase(),
        });
        setTeamData(result as typeof teamData);
        if (result.attendance === 'PRESENT') {
          setCheckinDone(true);
        }
      } catch {
        setError('Team not found. Please check the code and try again.');
      } finally {
        setLoading(false);
      }
    },
    [utils]
  );

  // Auto-lookup when page loads with code param
  useEffect(() => {
    if (code) {
      setShortCode(code);
      lookupTeam(code);
    }
  }, [code, lookupTeam]);

  const handleCheckIn = async () => {
    if (!teamData) return;
    try {
      await markAttendance.mutateAsync({
        teamId: teamData.id,
        attendance: 'PRESENT',
        notes: 'Checked in via QR code scan',
      });
      setCheckinDone(true);
      toast.success(`${teamData.name} checked in successfully!`);
    } catch {
      toast.error('Failed to mark attendance. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin/logistics')}
            className="text-gray-400 hover:text-white transition-colors"
            title="Back to Logistics"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider flex items-center gap-2">
              <QrCode className="w-5 h-5 text-orange-500" />
              QR CHECK-IN
            </h1>
            <p className="text-xs text-gray-500 font-mono">Scan result — mark attendance</p>
          </div>
        </div>

        {/* Manual Entry */}
        {!teamData && !loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
            <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">
              Team Short Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                placeholder="e.g. BS-7K3X"
                className="flex-1 bg-black border border-zinc-700 rounded px-3 py-2 text-white font-mono text-sm focus:border-orange-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && lookupTeam(shortCode)}
              />
              <button
                onClick={() => lookupTeam(shortCode)}
                disabled={!shortCode.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-mono rounded transition-colors"
              >
                LOOKUP
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-gray-400 font-mono">Looking up team...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={() => {
                setError('');
                setShortCode('');
              }}
              className="mt-3 text-xs text-orange-500 hover:text-orange-400 font-mono underline"
            >
              Try another code
            </button>
          </div>
        )}

        {/* Team Found — Check-in Card */}
        {teamData && (
          <div className="space-y-4">
            {/* Success banner if already checked in */}
            {checkinDone && (
              <div className="bg-emerald-900/20 border-2 border-emerald-500 rounded-lg p-4 flex items-center gap-3 animate-in fade-in">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-emerald-400 font-mono font-bold text-sm">CHECKED IN</p>
                  <p className="text-emerald-300/70 text-xs font-mono">
                    {teamData.name} — attendance marked
                  </p>
                </div>
              </div>
            )}

            {/* Team Info Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {/* Team Header */}
              <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-mono font-bold text-lg">{teamData.name}</p>
                    <p className="text-orange-500 font-mono text-xs tracking-widest">
                      {teamData.shortCode}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                      teamData.track === 'BUILD_STORM'
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                        : 'bg-purple-900/30 text-purple-400 border border-purple-800'
                    }`}
                  >
                    {teamData.track === 'BUILD_STORM' ? 'BuildStorm' : 'IdeaSprint'}
                  </span>
                </div>
              </div>

              {/* Team Details */}
              <div className="px-4 py-3 space-y-2">
                {teamData.college && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-gray-300 font-mono text-xs">{teamData.college}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-300 font-mono text-xs">
                    {teamData.size} member{teamData.size !== 1 ? 's' : ''}
                  </span>
                </div>
                {teamData.checkedInAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-gray-300 font-mono text-xs">
                      Checked in: {new Date(teamData.checkedInAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Members List */}
              <div className="border-t border-zinc-800 px-4 py-3">
                <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">
                  Members
                </p>
                <div className="space-y-2">
                  {teamData.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            member.isPresent ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                        />
                        <span className="text-gray-300 font-mono">{member.user.name}</span>
                        {member.role === 'LEADER' && (
                          <span className="text-orange-500 text-[10px] font-mono">LEAD</span>
                        )}
                      </div>
                      <span className="text-gray-500 font-mono text-[10px]">
                        {member.user.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {!checkinDone && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCheckIn}
                  disabled={markAttendance.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-mono text-sm font-bold rounded-lg transition-colors"
                >
                  {markAttendance.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  PRESENT
                </button>
                <button
                  onClick={async () => {
                    if (!teamData) return;
                    try {
                      await markAttendance.mutateAsync({
                        teamId: teamData.id,
                        attendance: 'ABSENT',
                        notes: 'Marked absent via QR scan check-in',
                      });
                      toast.info(`${teamData.name} marked as absent`);
                      router.push('/admin/logistics');
                    } catch {
                      toast.error('Failed to mark attendance');
                    }
                  }}
                  disabled={markAttendance.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-gray-300 font-mono text-sm font-bold rounded-lg border border-zinc-700 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  ABSENT
                </button>
              </div>
            )}

            {/* Back to list */}
            <button
              onClick={() => router.push('/admin/logistics')}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-400 font-mono py-2 transition-colors"
            >
              ← Back to Logistics Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      }
    >
      <CheckinContent />
    </Suspense>
  );
}
