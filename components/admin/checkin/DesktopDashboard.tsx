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
  Camera,
} from 'lucide-react';
import { getPusherClient } from '@/lib/pusher';
import { useAdminRole } from '../AdminRoleContext';
import { 
  Check, 
  X, 
  Minus, 
  Plus, 
  Coffee, 
  Utensils, 
  FileText,
  Fingerprint,
  Info
} from 'lucide-react';

const BREAKFAST_BUDGET = 400;
const LUNCH_BUDGET = 400;

export default function DesktopDashboard() {
  const { desk: contextDesk } = useAdminRole();
  const [deskId, setDeskId] = useState<string | null>(() => {
    if (contextDesk) return contextDesk;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_checkin_desk');
    }
    return null;
  });
  const [activeTeam, setActiveTeam] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<string>('');

  const utils = trpc.useUtils();
  const { data: stats, refetch: refetchStats } = trpc.admin.getCheckInStats.useQuery(undefined, {
    refetchInterval: 30000, // Polling backup
  });

  const confirmMutation = trpc.admin.confirmCheckIn.useMutation({
    onSuccess: () => {
      utils.admin.getCheckInStats.invalidate();
      setActiveTeam(null);
    },
  });

  const flagMutation = trpc.admin.flagCheckInIssue.useMutation();

  // Check-in Specific State
  const [memberVerifications, setMemberVerifications] = useState<Record<string, { collegeId: boolean, govtId: boolean, note: string }>>({});
  const [breakfastCount, setBreakfastCount] = useState(0);
  const [lunchCount, setLunchCount] = useState(0);
  const [showException, setShowException] = useState<string | null>(null);

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
    if (!pusher) return;

    const channelName = `admin-checkin-${deskId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('qr:scanned', (data: any) => {
      setActiveTeam(data.team);
      // Initialize local states for the team
      const initialVerifications = data.team.members.reduce((acc: any, m: any) => {
        acc[m.id] = { collegeId: false, govtId: false, note: '' };
        return acc;
      }, {});
      setMemberVerifications(initialVerifications);
      setBreakfastCount(data.team.members.length);
      setLunchCount(data.team.members.length);

      // Avoid duplicates in recent scans list
      setRecentScans((prev) => {
        const filtered = prev.filter((t) => t.id !== data.team.id);
        return [data.team, ...filtered.slice(0, 8)];
      });

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

    const globalUpdateChannel = pusher.subscribe('admin-updates');
    globalUpdateChannel.bind('stats:updated', () => {
      refetchStats();
    });

    const updateStatus = () => setIsConnected(pusher.connection.state === 'connected');
    pusher.connection.bind('state_change', updateStatus);
    updateStatus();

    // Track scanner presence
    let presenceTimeout: NodeJS.Timeout;
    channel.bind('scanner:presence', () => {
      setIsScannerActive(true);
      clearTimeout(presenceTimeout);
      presenceTimeout = setTimeout(() => setIsScannerActive(false), 15000);
    });

    return () => {
      pusher.unsubscribe(channelName);
      pusher.unsubscribe('admin-updates');
    };
  }, [deskId, activeTeam?.id, utils]);

  const selectDesk = (id: string) => {
    if (contextDesk) return;
    setDeskId(id);
    localStorage.setItem('admin_checkin_desk', id);
  };

  const isFullyVerified = activeTeam?.members.every((m: any) => 
    memberVerifications[m.id]?.collegeId && memberVerifications[m.id]?.govtId
  );

  const verifiedCount = activeTeam?.members.filter((m: any) => 
    memberVerifications[m.id]?.collegeId && memberVerifications[m.id]?.govtId
  ).length;

  const handleConfirm = async () => {
    if (!activeTeam || !deskId) return;
    
    // Check if we need an exception note for unverified members
    const needsException = activeTeam.members.some((m: any) => 
      !(memberVerifications[m.id]?.collegeId && memberVerifications[m.id]?.govtId) && !memberVerifications[m.id]?.note
    );

    if (needsException) {
      toast.error('EXCEPTION_REQUIRED', { description: 'Please provide notes for unverified members' });
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        teamId: activeTeam.id,
        deskId: deskId,
        breakfastCoupons: breakfastCount,
        lunchCoupons: lunchCount,
        verifications: activeTeam.members.map((m: any) => ({
          memberId: m.id,
          collegeIdVerified: memberVerifications[m.id]?.collegeId || false,
          govtIdVerified: memberVerifications[m.id]?.govtId || false,
          exceptionNote: memberVerifications[m.id]?.note || undefined
        }))
      });
      
      toast.success(`ACCESS_GRANTED: ${activeTeam.name}`, {
        description: `Successfully checked in and issued coupons.`,
      });
    } catch (e: any) {
      toast.error('DATABASE_ERROR', { description: e.message });
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
          <div className="flex justify-center gap-6">
            {(contextDesk ? [contextDesk] : ['A', 'B', 'C', 'D']).map((id) => (
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
    <div className="flex flex-col h-screen bg-[#050505] text-white font-mono overflow-hidden">
      {/* ── Dashboard Stats Bar ── */}
      <div className="h-14 border-b border-white/[0.05] bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <span className="text-[10px] font-black tracking-widest uppercase">Check-In_Terminal_v2</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-6">
            <StatItem label="TEAMS" current={stats?.checkedIn || 0} total={stats?.total || 0} color="orange" />
            <StatItem label="BREAKFAST" current={stats?.breakfastCoupons || 0} total={BREAKFAST_BUDGET} color="emerald" />
            <StatItem label="LUNCH" current={stats?.lunchCoupons || 0} total={LUNCH_BUDGET} color="blue" />
            <StatItem label="FLAGGED" current={stats?.flaggedCount || 0} total={null} color="red" />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold border transition-colors ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'NODE_SYNCED' : 'UPLINK_LOST'}
          </div>
          <button 
            onClick={() => { localStorage.removeItem('admin_checkin_desk'); setDeskId(null); }}
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
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
            <div className="flex flex-col items-end gap-2">
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

              {isConnected && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${isScannerActive ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-white/5 text-zinc-600 border-white/5'}`}
                >
                  <Camera
                    className={`h-2.5 w-2.5 ${isScannerActive ? 'animate-pulse' : 'opacity-20'}`}
                  />
                  <span className="text-[7px] font-bold uppercase tracking-[0.2em]">
                    {isScannerActive ? 'Scanner_Live' : 'No_Scanner'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-5 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Activity className="h-10 w-10 text-orange-500" />
            </div>
            <p className="text-[8px] text-zinc-500 mb-1 font-bold tracking-widest uppercase italic">
              Terminal_Telemetry
            </p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{stats?.checkedIn || 0}</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase">CHECKED</span>
              </div>
              <div className="text-[10px] text-zinc-700 font-black">
                {Math.round(((stats?.checkedIn || 0) / (stats?.total || 1)) * 100)}%
              </div>
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
              {/* Enhanced Member Verification Matrix */}
              <div className="p-8 border-b border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black text-zinc-400 tracking-[0.2em] uppercase flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-orange-500" /> MEMBER_VERIFICATION_MATRIX
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${verifiedCount === activeTeam.members.length ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                    {verifiedCount} / {activeTeam.members.length} VERIFIED
                  </div>
                </div>

                <div className="space-y-2">
                  {activeTeam.members.map((m: any) => {
                    const v = memberVerifications[m.id];
                    const fullyVerified = v?.collegeId && v?.govtId;
                    return (
                      <div key={m.id} className="space-y-2">
                        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${fullyVerified ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${fullyVerified ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-700 border-white/5'}`}>
                              {fullyVerified ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{m.user.name}</p>
                              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{m.role}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <VerificationToggle 
                              label="COLLEGE" 
                              active={v?.collegeId} 
                              onClick={() => setMemberVerifications(prev => ({ ...prev, [m.id]: { ...prev[m.id], collegeId: !prev[m.id].collegeId } }))} 
                            />
                            <VerificationToggle 
                              label="GOVT" 
                              active={v?.govtId} 
                              onClick={() => setMemberVerifications(prev => ({ ...prev, [m.id]: { ...prev[m.id], govtId: !prev[m.id].govtId } }))} 
                            />
                            {!fullyVerified && (
                              <button 
                                onClick={() => setShowException(showException === m.id ? null : m.id)}
                                className={`ml-2 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border transition-all ${v?.note ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'text-zinc-500 border-white/5 hover:bg-white/5'}`}
                              >
                                {v?.note ? 'NOTED' : 'EXCEPTION'}
                              </button>
                            )}
                          </div>
                        </div>
                        {showException === m.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 pb-2">
                            <textarea
                              placeholder="Describe exception (e.g. ID lost, forgotten at home...)"
                              value={v?.note}
                              onChange={(e) => setMemberVerifications(prev => ({ ...prev, [m.id]: { ...prev[m.id], note: e.target.value.toUpperCase() } }))}
                              className="w-full bg-black/40 border border-orange-500/30 rounded-xl p-3 text-[10px] font-mono text-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                              rows={2}
                            />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coupon Management & Venue Metrics */}
              <div className="p-8 grid grid-cols-2 gap-8 bg-black/40">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase flex items-center gap-2">
                    <Utensils className="h-3.5 w-3.5 text-orange-500" /> FOOD_COUPON_LOGISTICS
                  </h3>
                  <div className="space-y-4">
                    <CouponCounter 
                      icon={Coffee} 
                      label="BREAKFAST_COUPONS" 
                      count={breakfastCount} 
                      max={activeTeam.members.length} 
                      setCount={setBreakfastCount} 
                      color="emerald"
                    />
                    <CouponCounter 
                      icon={Utensils} 
                      label="LUNCH_COUPONS" 
                      count={lunchCount} 
                      max={activeTeam.members.length} 
                      setCount={setLunchCount} 
                      color="blue"
                    />
                    <div className="pt-2 flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Total_Allocation</span>
                      <span className="text-xl font-black text-white">{breakfastCount + lunchCount}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" /> VENUE_DEPLOYMENT_PLAN
                  </h3>
                  
                  {activeTeam.venue ? (
                    <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <MapPin className="h-16 w-16" />
                      </div>
                      <div className="relative z-10 space-y-4">
                        <div>
                          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">Assigned_Venue</p>
                          <p className="text-sm font-black text-white">{activeTeam.venue.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">Physical_Ref</p>
                            <p className="text-[10px] text-zinc-300 font-bold">{activeTeam.venue.floor || 'GND_FLR'} • {activeTeam.venue.block || 'BLOK_A'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">Capacity</p>
                            <p className="text-[10px] text-zinc-300 font-bold">{activeTeam.venue.capacity} TEAMS</p>
                          </div>
                        </div>
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[9px] font-bold text-emerald-500/70 uppercase">POSITION_OPTIMIZED</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-start gap-4">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-white font-black uppercase tracking-widest">UNASSIGNED_LOCATION</p>
                        <p className="text-[9px] text-orange-400/60 leading-relaxed font-bold italic">
                          No venue found for this team. Check-in can still proceed, but manual escort may be required.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Tier */}
              <div className="p-10 bg-[#0A0A0A] border-t border-white/5 flex gap-4">
                <button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending || (activeTeam?.members.some((m: any) => 
                    !(memberVerifications[m.id]?.collegeId && memberVerifications[m.id]?.govtId) && !memberVerifications[m.id]?.note
                  ))}
                  className="flex-[4] bg-orange-600 hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-orange-900/20"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-5 w-5" />
                  )}
                  {isFullyVerified ? 'AUTHORIZE_CHECKIN' : 'AUTHORIZE_WITH_EXCEPTION'}
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
    </div>
  );
}

function StatItem({ label, current, total, color }: { label: string, current: number, total: number | null, color: string }) {
  const colorMap: any = {
    orange: 'text-orange-500',
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    red: 'text-red-500'
  };

  return (
    <div className="flex flex-col items-start min-w-[100px]">
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className={`text-sm font-black ${colorMap[color]}`}>{current}</span>
        {total !== null && <span className="text-[8px] text-zinc-600 font-bold">/ {total}</span>}
      </div>
      <span className="text-[7px] text-zinc-700 font-black tracking-widest uppercase mt-0.5">{label}</span>
    </div>
  );
}

function VerificationToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1.5 rounded-lg text-[8px] font-black tracking-tighter border transition-all flex items-center gap-1.5 ${active ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-900/10' : 'bg-white/5 text-zinc-600 border-white/5 hover:border-white/10'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white shadow-[0_0_5px_rgba(255,255,255,1)]' : 'bg-zinc-800'}`} />
      {label}_ID
    </button>
  );
}

function CouponCounter({ label, count, max, setCount, color, icon: Icon }: any) {
  const colorMap: any = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-2xl hover:bg-white/[0.03] transition-all group">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl border ${colorMap[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setCount(Math.max(0, count - 1))}
          className="p-1 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="text-xs font-black w-4 text-center">{count}</span>
        <button 
          onClick={() => setCount(Math.min(max, count + 1))}
          className="p-1 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
);

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`${className} animate-spin`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
);
