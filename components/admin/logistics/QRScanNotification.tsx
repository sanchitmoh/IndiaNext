// QRScanNotification — Real-time popup when a team QR is scanned on any device.
// The logistics dashboard subscribes to SSE; this component renders the slide-in
// notification with instant CHECK IN / VIEW DETAILS actions.
'use client';

import { useCallback } from 'react';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import { X, CheckCircle2, ChevronRight, Users, MapPin, QrCode, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ScanEvent } from '@/lib/scan-emitter';

interface QRScanNotificationProps {
  event: ScanEvent;
  onDismiss: () => void;
  onCheckedIn: () => void;
}

const attendanceColors: Record<string, string> = {
  NOT_MARKED: 'text-gray-400',
  PRESENT: 'text-emerald-400',
  ABSENT: 'text-red-400',
  PARTIAL: 'text-amber-400',
};

const trackLabels: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

export function QRScanNotification({ event, onDismiss, onCheckedIn }: QRScanNotificationProps) {
  const markAttendance = trpc.logistics.markTeamAttendance.useMutation();

  const handleCheckIn = useCallback(async () => {
    try {
      await markAttendance.mutateAsync({
        teamId: event.teamId,
        attendance: 'PRESENT',
        notes: 'Checked in via QR scan (mobile → laptop push)',
      });
      toast.success(`✅ ${event.teamName} checked in!`);
      onCheckedIn();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to check in');
    }
  }, [markAttendance, event, onCheckedIn]);

  const scannedTime = new Date(event.scannedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="w-80 rounded-lg border border-emerald-500/30 bg-[#0A0A0A] shadow-2xl shadow-emerald-900/20 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-900/20 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <QrCode className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">
            QR SCANNED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {scannedTime}
          </span>
          <button
            onClick={onDismiss}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Team info */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{event.teamName}</p>
            <p className="text-[10px] font-mono text-emerald-400 tracking-widest mt-0.5">
              {event.shortCode}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
              {trackLabels[event.track] || event.track}
            </span>
            <span className={`text-[9px] font-mono font-bold ${attendanceColors[event.attendance] || 'text-gray-400'}`}>
              {event.attendance.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-[10px] font-mono text-gray-500">
          {event.college && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate text-gray-400">{event.college}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 shrink-0" />
            <span className="text-gray-400">
              {event.members.length} member{event.members.length !== 1 ? 's' : ''} •{' '}
              {event.members.find((m) => m.role === 'LEADER')?.user.name || '—'}
            </span>
          </div>
        </div>

        {/* Members */}
        <div className="space-y-1">
          {event.members.slice(0, 4).map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.isPresent ? 'bg-emerald-400' : 'bg-zinc-600'}`}
              />
              <span className="text-[10px] font-mono text-gray-400 truncate">{m.user.name}</span>
              {m.role === 'LEADER' && (
                <span className="text-[8px] font-mono text-orange-500 shrink-0">LEAD</span>
              )}
            </div>
          ))}
          {event.members.length > 4 && (
            <p className="text-[9px] font-mono text-gray-600 pl-3">
              +{event.members.length - 4} more
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {event.attendance !== 'PRESENT' ? (
            <button
              onClick={handleCheckIn}
              disabled={markAttendance.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {markAttendance.isPending ? 'CHECKING IN…' : 'CHECK IN'}
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ALREADY PRESENT
            </div>
          )}
          <Link
            href={`/admin/logistics/${event.teamId}`}
            onClick={onDismiss}
            className="flex items-center gap-1 px-3 py-2 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:text-emerald-400 hover:border-emerald-500/20 rounded-md transition-all"
          >
            VIEW
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
