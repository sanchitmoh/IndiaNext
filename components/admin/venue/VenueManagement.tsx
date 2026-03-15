'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { RouterOutputs } from '@/lib/trpc-client';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw,
  CheckCircle2,
  Loader2,
  Monitor,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  Zap,
  Building,
  Dices,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ── Inferred types from tRPC — no `any` ──────────────────────────────────────
type VenueRow = RouterOutputs['admin']['getVenues'][number];
type ShortlistedTeam = RouterOutputs['admin']['getShortlistedTeamsForVenue'][number];
type VenueTableRow = RouterOutputs['admin']['getAllVenueTables'][number];

/**
 * Pre-compute a venueId → VenueTableRow[] map from the flat getAllVenueTables result.
 * Memoised at the parent so child cards never fetch individually (fixes N+1).
 */
function buildTablesMap(tables: VenueTableRow[]): Map<string, VenueTableRow[]> {
  const map = new Map<string, VenueTableRow[]>();
  for (const t of tables) {
    const list = map.get(t.venueId) ?? [];
    list.push(t);
    map.set(t.venueId, list);
  }
  return map;
}

export function VenueManagement() {
  const [activeTab, setActiveTab] = useState<'assignment' | 'settings'>('assignment');
  const [search, setSearch] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newBlock, setNewBlock] = useState('');
  const [newCapacity, setNewCapacity] = useState<number>(0);
  const [updatingTeamId, setUpdatingTeamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterVenue, setFilterVenue] = useState<string>('all');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  // Inline delete confirmation — replaces blocking window.confirm()
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);

  // Bulk Table Generation State
  const [showBulkGen, setShowBulkGen] = useState<string | null>(null);
  const [bulkPrefix, setBulkPrefix] = useState('TP-');
  const [bulkCount, setBulkCount] = useState(50);

  const utils = trpc.useUtils();

  // ── Queries ─────────────────────────────────────────────────────────────────
  // staleTime: venues barely change — 30s prevents needless refetches on focus
  const { data: venues, refetch: refetchVenues, isLoading: loadingVenues } =
    trpc.admin.getVenues.useQuery(undefined, { staleTime: 30_000 });

  // Lean projection — only fields the venue component actually uses
  const { data: shortlistedTeamsData, isLoading: loadingTeams, refetch: refetchTeams } =
    trpc.admin.getShortlistedTeamsForVenue.useQuery(undefined, { staleTime: 10_000 });

  // Single query for ALL tables — eliminates N+1 per-card queries
  const { data: allTablesFlat } =
    trpc.admin.getAllVenueTables.useQuery(undefined, { staleTime: 10_000 });

  // Group tables by venueId once for the entire page
  const allTablesMap = useMemo(
    () => buildTablesMap(allTablesFlat ?? []),
    [allTablesFlat]
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createVenueMutation = trpc.admin.createVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue created successfully');
      setNewVenueName('');
      setNewFloor('');
      setNewBlock('');
      setNewCapacity(0);
      refetchVenues();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVenueMutation = trpc.admin.deleteVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue deleted');
      setDeletingVenueId(null);
      refetchVenues();
    },
    onError: (e) => {
      toast.error(e.message);
      setDeletingVenueId(null);
    },
  });

  const bulkGenMutation = trpc.admin.bulkGenerateTables.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} tables`);
      setShowBulkGen(null);
      // Refetch all tables so cards pick up the new ones
      utils.admin.getAllVenueTables.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLogisticsMutation = trpc.admin.updateTeamLogistics.useMutation({
    // ── Optimistic update — makes assign feel instant ──────────────────────
    onMutate: async ({ teamId, venueId, tableId, tableNumber }) => {
      await utils.admin.getShortlistedTeamsForVenue.cancel();
      const prev = utils.admin.getShortlistedTeamsForVenue.getData();

      utils.admin.getShortlistedTeamsForVenue.setData(undefined, (old) =>
        old?.map((t) =>
          t.id === teamId
            ? { ...t, venueId: venueId ?? null, tableId: tableId ?? null, tableNumber: tableNumber ?? null }
            : t
        )
      );

      return { prev };
    },
    onSuccess: (_data, { teamId }) => {
      toast.success('Logistics updated');
      setUpdatingTeamId(null);
      // Refresh tables map so "Occupied" badges update
      utils.admin.getAllVenueTables.invalidate();
    },
    onError: (e, _vars, ctx) => {
      // Roll back optimistic update
      if (ctx?.prev) utils.admin.getShortlistedTeamsForVenue.setData(undefined, ctx.prev);
      toast.error(e.message);
      setUpdatingTeamId(null);
    },
    onSettled: () => {
      utils.admin.getShortlistedTeamsForVenue.invalidate();
    },
  });

  // ── Filter & Search ──────────────────────────────────────────────────────────
  const filteredTeams = useMemo(() => {
    if (!shortlistedTeamsData) return [];
    return shortlistedTeamsData.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.shortCode.toLowerCase().includes(search.toLowerCase()) ||
        (team.college && team.college.toLowerCase().includes(search.toLowerCase()));

      const matchesVenue =
        filterVenue === 'all' ||
        (filterVenue === 'unassigned' ? !team.venueId : team.venueId === filterVenue);

      const matchesTrack = filterTrack === 'all' || team.track === filterTrack;

      return matchesSearch && matchesVenue && matchesTrack;
    });
  }, [shortlistedTeamsData, search, filterVenue, filterTrack]);

  const stats = useMemo(() => {
    if (!shortlistedTeamsData) return { total: 0, assigned: 0, unassigned: 0 };
    const total = shortlistedTeamsData.length;
    const assigned = shortlistedTeamsData.filter((t) => t.venueId).length;
    return { total, assigned, unassigned: total - assigned };
  }, [shortlistedTeamsData]);

  const handleUpdateLogistics = (
    teamId: string,
    venueId: string | null,
    tableId: string | null,
    tableNumber: string | null
  ) => {
    setUpdatingTeamId(teamId);
    updateLogisticsMutation.mutate({ teamId, venueId, tableId, tableNumber });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* ── Navigation Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#0A0A0A]/60 backdrop-blur-xl p-6 rounded-3xl border border-white/[0.08] shadow-2xl">
        <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('assignment')}
            className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-mono font-black tracking-[0.2em] rounded-xl transition-all ${
              activeTab === 'assignment'
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${activeTab === 'assignment' ? 'fill-current' : ''}`} />
            MAPPING_HUB
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-mono font-black tracking-[0.2em] rounded-xl transition-all ${
              activeTab === 'settings'
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Building className={`h-3.5 w-3.5 ${activeTab === 'settings' ? 'fill-current' : ''}`} />
            STRUCTURE
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-6 px-4 py-2 bg-black/40 border border-white/[0.05] rounded-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-mono font-black text-white leading-none">{stats.total}</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase tracking-tighter mt-1">TOTAL_TEAMS</span>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-mono font-black text-orange-500 leading-none">{stats.assigned}</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase tracking-tighter mt-1">MAPPED</span>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-mono font-black text-white/40 leading-none">{stats.unassigned}</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase tracking-tighter mt-1">PENDING</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'assignment' ? (
          <motion.div
            key="assignment"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* ── Filter Controls ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-600 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="SEARCH_TEAMS_OR_COLLEGES..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0A0A0A]/80 border border-white/[0.08] rounded-2xl pl-11 pr-4 py-4 text-[11px] font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all shadow-inner"
                />
              </div>

              <div className="md:col-span-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                  <select
                    value={filterVenue}
                    onChange={(e) => setFilterVenue(e.target.value)}
                    className="w-full bg-[#0A0A0A]/80 border border-white/[0.08] rounded-2xl pl-11 pr-4 py-4 text-[11px] font-mono text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer hover:border-white/20 transition-all uppercase"
                  >
                    <option value="all">ALL_LOCATIONS</option>
                    <option value="unassigned">UNASSIGNED_ONLY</option>
                    {venues?.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                  <select
                    value={filterTrack}
                    onChange={(e) => setFilterTrack(e.target.value)}
                    className="w-full bg-[#0A0A0A]/80 border border-white/[0.08] rounded-2xl pl-11 pr-4 py-4 text-[11px] font-mono text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer hover:border-white/20 transition-all uppercase"
                  >
                    <option value="all">ALL TRACKS</option>
                    <option value="IDEA_SPRINT">IDEA SPRINT</option>
                    <option value="BUILD_STORM">BUILD STORM</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <div className="flex items-center p-1 bg-black/40 border border-white/[0.06] rounded-2xl">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2.5 rounded-xl transition-all ${
                      viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2.5 rounded-xl transition-all ${
                      viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => refetchTeams()}
                  className="flex-1 bg-black/40 border border-white/[0.06] rounded-2xl py-3 text-[10px] font-mono font-bold text-gray-500 hover:text-orange-400 hover:border-orange-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingTeams ? 'animate-spin' : ''}`} />
                  SYNC_SERVER
                </button>
              </div>
            </div>

            {/* ── Teams View ── */}
            {loadingTeams ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-56 bg-white/[0.02] border border-white/[0.04] rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : filteredTeams.length > 0 ? (
              <div className={viewMode === 'grid'
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "flex flex-col gap-3"
              }>
                {filteredTeams.map((team) => (
                  viewMode === 'grid' ? (
                    <TeamLogisticsCard
                      key={team.id}
                      team={team}
                      venues={venues ?? []}
                      tablesMap={allTablesMap}
                      isUpdating={updatingTeamId === team.id}
                      onUpdate={handleUpdateLogistics}
                    />
                  ) : (
                    <TeamLogisticsListItem
                      key={team.id}
                      team={team}
                      venues={venues ?? []}
                      tablesMap={allTablesMap}
                      isUpdating={updatingTeamId === team.id}
                      onUpdate={handleUpdateLogistics}
                    />
                  )
                ))}
              </div>
            ) : (
              <div className="py-32 text-center bg-[#070707] border border-dashed border-white/5 rounded-[40px]">
                <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-6 border border-white/[0.05]">
                  <Monitor className="h-8 w-8 text-gray-800" />
                </div>
                <h3 className="text-sm font-mono font-black text-gray-500 uppercase tracking-[0.3em]">NO_RECORDS_FOUND</h3>
                <p className="text-[10px] font-mono text-gray-700 mt-2 uppercase">Adjust your parameters or sync again</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* ── Create Venue & Bulk Gen ── */}
            <div className="lg:col-span-4 lg:sticky lg:top-8 h-fit space-y-6">
              <div className="bg-[#0A0A0A] p-8 rounded-[32px] border border-white/[0.08] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Building className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col gap-6">
                  <div>
                    <h3 className="text-sm font-mono font-black text-white uppercase tracking-[0.2em] mb-1">Architecture</h3>
                    <p className="text-[10px] font-mono text-gray-600 uppercase">Construct physical data points</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-gray-500 uppercase px-1 font-bold">Venue_Name</label>
                      <input
                        type="text"
                        placeholder="e.g. CORE_HUB_01"
                        value={newVenueName}
                        onChange={(e) => setNewVenueName(e.target.value.toUpperCase())}
                        className="w-full bg-black/60 border border-white/[0.1] rounded-2xl px-5 py-4 text-[12px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40 transition-all uppercase placeholder:text-gray-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono text-gray-500 uppercase px-1 font-bold">Floor</label>
                        <input
                          type="text"
                          placeholder="LEVEL_01"
                          value={newFloor}
                          onChange={(e) => setNewFloor(e.target.value.toUpperCase())}
                          className="w-full bg-black/60 border border-white/[0.1] rounded-2xl px-5 py-3 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono text-gray-500 uppercase px-1 font-bold">Block</label>
                        <input
                          type="text"
                          placeholder="ALPHA"
                          value={newBlock}
                          onChange={(e) => setNewBlock(e.target.value.toUpperCase())}
                          className="w-full bg-black/60 border border-white/[0.1] rounded-2xl px-5 py-3 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-gray-500 uppercase px-1 font-bold">Team_Capacity</label>
                      <input
                        type="number"
                        placeholder="50"
                        value={newCapacity || ''}
                        onChange={(e) => setNewCapacity(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-black/60 border border-white/[0.1] rounded-2xl px-5 py-3 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                      />
                    </div>

                    <button
                      onClick={() => createVenueMutation.mutate({
                        name: newVenueName,
                        floor: newFloor || undefined,
                        block: newBlock || undefined,
                        capacity: newCapacity,
                      })}
                      disabled={createVenueMutation.isPending || !newVenueName}
                      className="w-full py-4 mt-2 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] disabled:opacity-30 rounded-2xl text-[11px] text-white font-black tracking-[0.3em] uppercase transition-all shadow-2xl shadow-orange-950/20 flex items-center justify-center gap-3 group"
                    >
                      {createVenueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />}
                      BUILD_STATION
                    </button>
                  </div>
                </div>
              </div>

              {/* Bulk Generation Card */}
              {showBulkGen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-orange-500/10 border border-orange-500/30 p-8 rounded-[32px] shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10 space-y-6">
                    <div>
                      <h3 className="text-xs font-mono font-black text-orange-500 uppercase tracking-[0.2em] mb-1">Bulk_Generator</h3>
                      <p className="text-[9px] font-mono text-orange-400/60 uppercase">Generate seats for {venues?.find((v) => v.id === showBulkGen)?.name}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-mono text-orange-500/50 uppercase font-black">Prefix</label>
                          <input
                            type="text"
                            value={bulkPrefix}
                            onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                            className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-mono text-orange-500/50 uppercase font-black">Quantity</label>
                          <input
                            type="number"
                            value={bulkCount}
                            onChange={(e) => setBulkCount(parseInt(e.target.value) || 0)}
                            className="w-full bg-black/40 border border-orange-500/20 rounded-xl px-4 py-2 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                        <Info className="h-3 w-3 text-orange-500/60" />
                        <p className="text-[8px] font-mono text-orange-400/40 leading-tight uppercase">
                          Will create {bulkPrefix}01 to {bulkPrefix}{bulkCount.toString().padStart(2, '0')}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowBulkGen(null)}
                          className="flex-1 py-3 border border-orange-500/20 rounded-xl text-[9px] font-mono font-black text-orange-500/60 uppercase hover:bg-orange-500/5 transition-all"
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={() => bulkGenMutation.mutate({ venueId: showBulkGen, prefix: bulkPrefix, count: bulkCount })}
                          disabled={bulkGenMutation.isPending}
                          className="flex-[2] py-3 bg-orange-500 text-white rounded-xl text-[9px] font-mono font-black uppercase shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                        >
                          {bulkGenMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Dices className="h-3 w-3" />}
                          EXEC_GENERATE
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Venues List ── */}
            <div className="lg:col-span-8 bg-[#0A0A0A] rounded-[32px] border border-white/[0.08] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <h3 className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-[0.3em]">Operational_Sectors</h3>
                <span className="text-[10px] font-mono text-orange-500/50">{venues?.length || 0}_ACTIVE</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {loadingVenues ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse bg-white/[0.01]" />
                  ))
                ) : venues?.length ? (
                  venues.map((v) => (
                    <div key={v.id} className="group">
                      <div className="p-6 flex items-center justify-between hover:bg-white/[0.015] transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-orange-500/20 group-hover:bg-orange-500/5 transition-all">
                            <MapPin className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-mono font-black text-gray-200 tracking-wider uppercase">{v.name}</p>
                            <div className="flex items-center gap-2 mt-1.5 opacity-60">
                              {v.floor && <span className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-white/5 border border-white/10 rounded uppercase">{v.floor}</span>}
                              {v.block && <span className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-white/5 border border-white/10 rounded uppercase">{v.block}</span>}
                              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">CAP_REF: {v.capacity} TEAMS</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowBulkGen(v.id)}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-mono font-black text-gray-400 hover:text-orange-500 hover:border-orange-500/30 transition-all flex items-center gap-2"
                          >
                            <Dices className="h-3.5 w-3.5" />
                            GEN_STATIONS
                          </button>
                          {/* Inline delete confirmation — no blocking window.confirm() */}
                          {deletingVenueId === v.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDeletingVenueId(null)}
                                className="px-3 py-2 text-[9px] font-mono font-black text-gray-500 uppercase hover:text-gray-300 transition-all"
                              >
                                CANCEL
                              </button>
                              <button
                                onClick={() => deleteVenueMutation.mutate({ id: v.id })}
                                disabled={deleteVenueMutation.isPending}
                                className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-[9px] font-mono font-black text-red-400 uppercase hover:bg-red-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                {deleteVenueMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                                CONFIRM_DELETE
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingVenueId(v.id)}
                              className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-32 text-center">
                    <MapPin className="h-10 w-10 text-gray-800 mx-auto mb-4" />
                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">No sector telemetry available</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Card subcomponent ─────────────────────────────────────────────────────────

interface CardProps {
  team: ShortlistedTeam;
  venues: VenueRow[];
  tablesMap: Map<string, VenueTableRow[]>;
  isUpdating: boolean;
  onUpdate: (teamId: string, venueId: string | null, tableId: string | null, tableNumber: string | null) => void;
}

function TeamLogisticsCard({ team, venues, tablesMap, isUpdating, onUpdate }: CardProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(team.venueId ?? 'none');
  const [selectedTableId, setSelectedTableId] = useState<string>(team.tableId ?? 'none');
  const [customTableNo, setCustomTableNo] = useState(team.tableNumber ?? '');

  // Pull from pre-fetched map — zero extra network requests
  const venueTables = selectedVenueId !== 'none' ? (tablesMap.get(selectedVenueId) ?? []) : [];

  const hasChanges =
    (selectedVenueId === 'none' ? null : selectedVenueId) !== (team.venueId ?? null) ||
    (selectedTableId === 'none' ? null : selectedTableId) !== (team.tableId ?? null) ||
    (customTableNo || null) !== (team.tableNumber ?? null);

  const isAssigned = !!team.venueId;

  return (
    // layout prop removed — was causing layout thrashing on every search keystroke
    <motion.div
      className={`relative group bg-black/40 border rounded-[28px] p-6 transition-all duration-300 ${
        isAssigned ? 'border-emerald-500/30' : 'border-white/[0.08]'
      }`}
    >
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-[13px] font-mono font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors truncate">
              {team.name}
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[9px] font-mono font-black px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-zinc-500 uppercase tracking-widest">
                {team.shortCode}
              </span>
              <div className={`px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest ${
                team.track === 'IDEA_SPRINT' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                {team.track?.replace('_', ' ')}
              </div>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 transition-all ${
            isAssigned ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/10 text-zinc-800'
          }`}>
            {isAssigned ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">Deployment_Sector</label>
            <select
              value={selectedVenueId}
              onChange={(e) => {
                setSelectedVenueId(e.target.value);
                setSelectedTableId('none');
              }}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500/40 transition-all"
            >
              <option value="none">UNASSIGNED</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">Logic_Terminal</label>
            <div className="flex flex-col gap-2">
              <select
                disabled={selectedVenueId === 'none'}
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500/40 transition-all disabled:opacity-20"
              >
                <option value="none">SELECT_STATION</option>
                {venueTables.map((t) => (
                  <option key={t.id} value={t.id} disabled={!!t.team && t.team.shortCode !== team.shortCode}>
                    {t.code} {t.team ? `[Occupied: ${t.team.shortCode}]` : '[Open]'}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="MANUAL_OVERRIDE..."
                value={customTableNo}
                onChange={(e) => setCustomTableNo(e.target.value.toUpperCase())}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[9px] font-mono text-zinc-500 focus:outline-none focus:border-white/10 placeholder:opacity-20 uppercase"
              />
            </div>
          </div>

          <button
            onClick={() => {
              const table = venueTables.find((t) => t.id === selectedTableId);
              onUpdate(
                team.id,
                selectedVenueId === 'none' ? null : selectedVenueId,
                selectedTableId === 'none' ? null : selectedTableId,
                table ? table.code : (customTableNo || null)
              );
            }}
            disabled={!hasChanges || isUpdating}
            className={`w-full py-4 rounded-xl text-[9px] font-black tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 active:scale-95 ${
              hasChanges
                ? 'bg-orange-600 text-white shadow-xl shadow-orange-950/20'
                : 'bg-white/5 text-zinc-800 border border-white/5 cursor-not-allowed'
            }`}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
            {isUpdating ? 'INITIALIZING...' : 'COMMIT_MAPPING'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── List-item subcomponent ───────────────────────────────────────────────────

function TeamLogisticsListItem({ team, venues, tablesMap, isUpdating, onUpdate }: CardProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(team.venueId ?? 'none');
  const [selectedTableId, setSelectedTableId] = useState<string>(team.tableId ?? 'none');

  // Pull from pre-fetched map — zero extra network requests
  const venueTables = selectedVenueId !== 'none' ? (tablesMap.get(selectedVenueId) ?? []) : [];

  const hasChanges =
    (selectedVenueId === 'none' ? null : selectedVenueId) !== (team.venueId ?? null) ||
    (selectedTableId === 'none' ? null : selectedTableId) !== (team.tableId ?? null);

  const isAssigned = !!team.venueId;

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center gap-6 p-6 bg-black/40 border rounded-[24px] transition-all group ${
      isAssigned ? 'border-emerald-500/20' : 'border-white/[0.05]'
    }`}>
      <div className="flex-1 flex items-center gap-6 min-w-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-all ${
          isAssigned ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-lg shadow-emerald-950/20' : 'bg-white/5 border-white/10 text-zinc-800'
        }`}>
          {isAssigned ? (
            <div className="relative">
              <CheckCircle2 className="h-6 w-6" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            </div>
          ) : (
            <MapPin className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-sm font-mono font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors truncate">
              {team.name}
            </p>
            <span className={`px-2 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-widest shrink-0 ${
              team.track === 'IDEA_SPRINT' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            }`}>
              {team.track?.replace('_', ' ')}
            </span>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mt-1.5 truncate">
            {team.college ?? 'Universal Academy of Tech'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex flex-col gap-1 w-full sm:w-48">
          <label className="text-[8px] font-black text-zinc-700 uppercase tracking-widest px-1">Sector</label>
          <select
            value={selectedVenueId}
            onChange={(e) => {
              setSelectedVenueId(e.target.value);
              setSelectedTableId('none');
            }}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
          >
            <option value="none">UNASSIGNED</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 w-full sm:w-40">
          <label className="text-[8px] font-black text-zinc-700 uppercase tracking-widest px-1">Terminal</label>
          <select
            disabled={selectedVenueId === 'none'}
            value={selectedTableId}
            onChange={(e) => setSelectedTableId(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500/40 disabled:opacity-20"
          >
            <option value="none">SELECT_ID</option>
            {venueTables.map((t) => (
              <option key={t.id} value={t.id} disabled={!!t.team && t.team.shortCode !== team.shortCode}>
                {t.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 w-full sm:w-auto pt-4 sm:pt-0">
          <div className="h-4 hidden sm:block" />
          <button
            onClick={() => {
              const table = venueTables.find((t) => t.id === selectedTableId);
              onUpdate(team.id, selectedVenueId === 'none' ? null : selectedVenueId, selectedTableId === 'none' ? null : selectedTableId, table?.code ?? null);
            }}
            disabled={!hasChanges || isUpdating}
            className={`w-full sm:w-32 py-2.5 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 shadow-xl ${
              hasChanges
                ? 'bg-orange-600 text-white shadow-orange-950/20 active:scale-95'
                : 'bg-white/[0.03] text-zinc-800 border border-white/5 cursor-not-allowed uppercase'
            }`}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className={`h-3.5 w-3.5 ${hasChanges ? 'fill-current' : ''}`} />}
            {isUpdating ? 'UPLOADING' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}
