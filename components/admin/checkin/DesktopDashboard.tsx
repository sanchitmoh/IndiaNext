'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  Users,
  MapPin,
  UserCheck,
  Flag,
  RotateCcw,
  Search,
  Activity,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { getPusherClient } from '@/lib/pusher';
import { assignDesk } from '@/lib/logistics-utils';
import { useAdminRole } from '../AdminRoleContext';

export default function DesktopDashboard() {
  const { desk: contextDesk } = useAdminRole();
  const [deskId, setDeskId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_checkin_desk');
    }
    return null;
  });
  const [activeTeam, setActiveTeam] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<string>('');

  const utils = trpc.useUtils();
  const { data: stats } = trpc.admin.getCheckInStats.useQuery(undefined, {
    refetchInterval: 30000, // Polling backup
  });

  const confirmMutation = trpc.admin.confirmCheckIn.useMutation({
    onSuccess: () => {
      utils.admin.getCheckInStats.invalidate();
    },
  });

  const flagMutation = trpc.admin.flagCheckInIssue.useMutation();

  // Initialize desk from context or localStorage
  // Sync with context if provided
  useEffect(() => {
    if (contextDesk) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeskId(contextDesk);
    }
  }, [contextDesk]);

  useEffect(() => {
    if (!deskId) return;

    const pusher = getPusherClient();
    const channelName = `admin-checkin-${deskId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('qr:scanned', (data: any) => {
      setActiveTeam(data.team);
      // Avoid duplicates in recent scans list
      setRecentScans((prev) => {
        const filtered = prev.filter((t) => t.id !== data.team.id);
        return [data.team, ...filtered.slice(0, 8)];
      });
      setSelectedDesk(assignDesk(data.team.teamIndex));

      // Play subtle notification sound if possible?
      // For now, just a distinct toast
      toast.success(`NEW_SCAN: ${data.team.name}`, {
        description: `Team ${data.team.shortCode} identified at Station ${deskId}`,
        icon: <Activity className="h-4 w-4 text-orange-500" />,
      });
    });

    channel.bind('checkin:confirmed', (data: any) => {
      if (activeTeam?.id === data.teamId) setActiveTeam(null);
      setRecentScans((prev) => prev.filter((t) => t.id !== data.teamId));
      utils.admin.getCheckInStats.invalidate();
    });

    const updateStatus = () => setIsConnected(pusher.connection.state === 'connected');
    pusher.connection.bind('state_change', updateStatus);
    updateStatus();

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [deskId, activeTeam?.id, utils]);

  const selectDesk = (id: string) => {
    setDeskId(id);
    localStorage.setItem('admin_checkin_desk', id);
  };

  const handleConfirm = async () => {
    if (!activeTeam || !deskId) return;
    try {
      await confirmMutation.mutateAsync({
        teamId: activeTeam.id,
        deskId: deskId,
        desk: selectedDesk,
      });
      toast.success(`ACCESS_GRANTED: ${activeTeam.name}`, {
        description: `Successfully checked in and assigned to Desk ${selectedDesk}`,
      });
      setActiveTeam(null);
    } catch {
      toast.error('DATABASE_ERROR: Failed to confirm check-in');
    }
  };

  const handleFlag = async () => {
    if (!activeTeam || !deskId) return;
    const reason = window.prompt('ENTER_FLAG_REASON:');
    if (!reason) return;

    try {
      await flagMutation.mutateAsync({
        teamId: activeTeam.id,
        deskId: deskId,
        reason,
      });
      toast.warning(`INCIDENT_LOGGED: ${activeTeam.name}`, {
        description: reason,
      });
      setActiveTeam(null);
    } catch {
      toast.error('FLAG_SUBMISSION_FAILED');
    }
  };

  if (!deskId) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-12 font-mono">
        <div className="w-full max-w-xl space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold tracking-[0.2em] mb-4">
              SYSTEM_INITIALIZATION
            </div>
            <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-2">
              Select_Command_Station
            </h1>
            <p className="text-zinc-500 text-xs tracking-wider">
              BIND THIS TERMINAL TO A PHYSICAL CHECK-IN DESK FOR REAL-TIME SYNC
            </p>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {['A', 'B', 'C', 'D'].map((id) => (
              <button
                key={id}
                onClick={() => selectDesk(id)}
                className="aspect-square rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-orange-500 hover:bg-orange-500/5 transition-all group flex flex-col items-center justify-center"
              >
                <div className="text-5xl font-black text-zinc-700 group-hover:text-orange-500 transition-colors">
                  {id}
                </div>
                <div className="text-[10px] text-zinc-800 group-hover:text-orange-500/50 mt-2 font-bold uppercase tracking-widest">
                  Station
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white font-mono overflow-hidden">
      {/* Sidebar - Command Feed */}
      <div className="w-80 border-r border-white/5 bg-[#080808] flex flex-col">
        <div className="p-6 border-b border-white/5 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h2 className="text-[9px] font-bold tracking-[0.4em] text-zinc-500 uppercase leading-none mb-1">
                Station_{deskId}
              </h2>
              <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                Operator Terminal
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
            >
              <div
                className={`w-1 h-1 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
              />
              <span className="text-[8px] font-bold uppercase tracking-widest">
                {isConnected ? 'Link_Active' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-5 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Activity className="h-10 w-10 text-orange-500" />
            </div>
            <p className="text-[8px] text-zinc-500 mb-1 font-bold tracking-widest">
              OCCUPANCY_METRICS
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-orange-500 tracking-tighter">
                {stats?.checkedIn || 0}
              </span>
              <span className="text-xs font-bold text-zinc-600">/ {stats?.total || 0}</span>
            </div>
            <div className="mt-4 w-full bg-white/5 rounded-full h-1 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((stats?.checkedIn || 0) / (stats?.total || 1)) * 100}%` }}
                className="bg-gradient-to-r from-orange-600 to-orange-400 h-full"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-white/5">
          <h3 className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-4 flex items-center gap-2">
            <Clock className="h-3 w-3" /> RECENT_ACTIVITY_FEED
          </h3>
          <div className="overflow-y-auto max-h-[calc(screen-400px)] space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {recentScans.length === 0 ? (
                <div className="text-center py-12 text-zinc-800 border border-dashed border-white/5 rounded-xl">
                  <Search className="h-6 w-6 mx-auto mb-2 opacity-20" />
                  <p className="text-[9px] tracking-widest">AWAITING_UPLINK...</p>
                </div>
              ) : (
                recentScans.map((team) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setActiveTeam(team)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all group ${activeTeam?.id === team.id ? 'bg-orange-500/10 border-orange-500/30' : 'bg-[#111] border-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-[10px] font-bold ${activeTeam?.id === team.id ? 'text-orange-400' : 'text-zinc-300'} truncate group-hover:text-white transition-colors`}
                        >
                          {team.name}
                        </p>
                        <p className="text-[8px] text-zinc-600 mt-1 font-mono tracking-widest">
                          {team.shortCode}
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-3 w-3 mt-0.5 transition-transform ${activeTeam?.id === team.id ? 'text-orange-500 translate-x-0.5' : 'text-zinc-800'}`}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-auto p-4 opacity-50">
          <button
            onClick={() => {
              localStorage.removeItem('admin_checkin_desk');
              setDeskId(null);
            }}
            className="w-full py-2 rounded border border-white/10 text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white transition-all"
          >
            Switch_Terminal_Station
          </button>
        </div>
      </div>

      {/* Main Command Processor */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-black relative">
        {/* Animated Background Overlay */}
        <div className="absolute inset-0 opacity-[0.15] pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,102,0,0.1) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
          <motion.div
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none"
          />
        </div>

        <AnimatePresence mode="wait">
          {activeTeam ? (
            <motion.div
              key={activeTeam.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.2 } }}
              className="w-full max-w-2xl bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,1)] ring-1 ring-white/5"
            >
              {/* Card Header - Visual ID */}
              <div className="p-10 border-b border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`px-2 py-0.5 rounded text-[9px] font-black tracking-[0.2em] uppercase border ${activeTeam.track === 'IDEA_SPRINT' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}
                    >
                      {activeTeam.track.replace('_', ' ')}
                    </div>
                    <div className="h-1 w-1 rounded-full bg-zinc-800" />
                    <span className="text-zinc-500 text-[10px] font-bold tracking-widest">
                      {activeTeam.shortCode}
                    </span>
                  </div>
                  <h1 className="text-4xl font-black tracking-tight text-white mb-3 uppercase">
                    {activeTeam.name}
                  </h1>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <p className="text-[11px] font-bold tracking-wider">
                      {activeTeam.college || 'Universal Academy of Tech'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[8px] font-black text-zinc-600 tracking-[0.4em] mb-2 uppercase">
                    Assignment_Ref
                  </span>
                  <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-5xl font-black text-white relative z-10">
                      {selectedDesk || '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="p-10 grid grid-cols-2 gap-10 bg-black/40">
                <div className="space-y-6">
                  <h3 className="text-[9px] font-bold text-zinc-500 tracking-[0.3em] uppercase flex items-center gap-2">
                    <Users className="h-3 w-3 text-orange-500" /> MANIFEST_DETAILS
                  </h3>
                  <div className="space-y-4">
                    {activeTeam.members?.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[11px] font-bold text-zinc-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                          0{i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-white font-bold group-hover:text-orange-400 transition-colors">
                            {m.user.name}
                          </p>
                          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">
                            {m.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-[9px] font-bold text-zinc-500 tracking-[0.3em] uppercase flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" /> LOGISTICS_CONTROL
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {['A', 'B', 'C', 'D'].map((desk) => (
                        <button
                          key={desk}
                          onClick={() => setSelectedDesk(desk)}
                          className={`py-4 rounded-xl border text-sm font-black transition-all ${selectedDesk === desk ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)]' : 'bg-white/5 border-white/5 text-zinc-600 hover:border-white/20 hover:text-white'}`}
                        >
                          {desk}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 bg-orange-500/[0.03] border border-orange-500/10 rounded-xl flex items-start gap-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-300 font-bold leading-none uppercase tracking-widest">
                        Protocol Check
                      </p>
                      <p className="text-[9px] text-zinc-600 leading-relaxed italic">
                        Verify Government IDs and Student Credentials before committing to ledger.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Tier */}
              <div className="p-10 bg-[#0A0A0A] border-t border-white/5 flex gap-4">
                <button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className="flex-[4] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-orange-900/20"
                >
                  {confirmMutation.isPending ? (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-5 w-5" />
                  )}
                  Finalize_CheckIn_&_Deploy
                </button>
                <button
                  onClick={handleFlag}
                  className="flex-1 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-all group"
                  title="Flag Issue"
                >
                  <Flag className="h-5 w-5 group-hover:fill-red-500 transition-all" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-8 relative z-10"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative w-32 h-32 rounded-3xl border border-white/10 bg-[#080808]/50 backdrop-blur-md flex items-center justify-center shadow-2xl">
                  <RotateCcw className="h-12 w-12 text-zinc-800 animate-spin-slow" />
                  <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-orange-500/50 blur-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em]">
                  Ready_For_Uplink
                </h2>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase max-w-[400px]">
                    Waiting for mobile scanners to authenticate team shortcodes
                  </p>
                  <div className="flex items-center gap-2 mt-4 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full">
                    <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                      Listening on station {deskId}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
