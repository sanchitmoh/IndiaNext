'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import { 
  MapPin, 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Monitor,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  Zap,
  Building,
  Dices,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Venue {
  id: string;
  name: string;
}

interface Table {
  id: string;
  code: string;
  venueId: string;
  team?: {
    name: string;
    shortCode: string;
  } | null;
}

interface TeamLogistics {
  id: string;
  name: string;
  shortCode: string;
  track: string;
  venueId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  attendance: string;
  college?: string | null;
  venue?: Venue | null;
  table?: Table | null;
}

export function VenueManagement() {
  const [activeTab, setActiveTab] = useState<'assignment' | 'settings'>('assignment');
  const [search, setSearch] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [updatingTeamId, setUpdatingTeamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterVenue, setFilterVenue] = useState<string>('all');

  // Bulk Table Generation State
  const [showBulkGen, setShowBulkGen] = useState<string | null>(null);
  const [bulkPrefix, setBulkPrefix] = useState('TP-');
  const [bulkCount, setBulkCount] = useState(50);

  // Queries
  const { data: venues, refetch: refetchVenues, isLoading: loadingVenues } = trpc.admin.getVenues.useQuery();
  const { data: shortlistedTeamsData, isLoading: loadingTeams, refetch: refetchTeams } = trpc.admin.getShortlistedTeams.useQuery();

  // Mutations
  const createVenueMutation = trpc.admin.createVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue created successfully');
      setNewVenueName('');
      refetchVenues();
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteVenueMutation = trpc.admin.deleteVenue.useMutation({
    onSuccess: () => {
      toast.success('Venue deleted');
      refetchVenues();
    },
    onError: (e) => toast.error(e.message)
  });

  const bulkGenMutation = trpc.admin.bulkGenerateTables.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} tables`);
      setShowBulkGen(null);
      refetchVenues(); // Refresh venues to show table counts if we add them later
    },
    onError: (e) => toast.error(e.message)
  });

  const updateLogisticsMutation = trpc.admin.updateTeamLogistics.useMutation({
    onSuccess: () => {
      toast.success('Logistics updated');
      setUpdatingTeamId(null);
      refetchTeams();
    },
    onError: (e) => {
      toast.error(e.message);
      setUpdatingTeamId(null);
    }
  });

  // Filter and Search Logic
  const filteredTeams = useMemo(() => {
    if (!shortlistedTeamsData) return [];
    return shortlistedTeamsData.filter((team: any) => {
      const matchesSearch = 
        team.name.toLowerCase().includes(search.toLowerCase()) || 
        team.shortCode.toLowerCase().includes(search.toLowerCase()) ||
        (team.college && team.college.toLowerCase().includes(search.toLowerCase()));
      
      const matchesVenue = filterVenue === 'all' || 
        (filterVenue === 'unassigned' ? !team.venueId : team.venueId === filterVenue);

      return matchesSearch && matchesVenue;
    });
  }, [shortlistedTeamsData, search, filterVenue]);

  const stats = useMemo(() => {
    if (!shortlistedTeamsData) return { total: 0, assigned: 0, unassigned: 0 };
    const total = shortlistedTeamsData.length;
    const assigned = shortlistedTeamsData.filter((t: any) => t.venueId).length;
    return {
      total,
      assigned,
      unassigned: total - assigned
    };
  }, [shortlistedTeamsData]);

  const handleUpdateLogistics = (teamId: string, venueId: string | null, tableId: string | null, tableNumber: string | null) => {
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
                    {venues?.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-4 flex items-center gap-3">
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
                {filteredTeams.map((team: any) => (
                  viewMode === 'grid' ? (
                    <TeamLogisticsCard 
                      key={team.id}
                      team={team}
                      venues={venues || []}
                      isUpdating={updatingTeamId === team.id}
                      onUpdate={handleUpdateLogistics}
                    />
                  ) : (
                    <TeamLogisticsListItem 
                      key={team.id}
                      team={team}
                      venues={venues || []}
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
                  
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-mono text-gray-500 uppercase px-1 font-bold">Identity_Tag</label>
                      <input
                        type="text"
                        placeholder="e.g. CORE_HUB_01"
                        value={newVenueName}
                        onChange={(e) => setNewVenueName(e.target.value.toUpperCase())}
                        className="w-full bg-black/60 border border-white/[0.1] rounded-2xl px-5 py-4 text-[12px] font-mono text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all uppercase placeholder:text-gray-800"
                      />
                    </div>
                    <button
                      onClick={() => createVenueMutation.mutate({ name: newVenueName })}
                      disabled={createVenueMutation.isPending || !newVenueName}
                      className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] disabled:opacity-30 rounded-2xl text-[11px] text-white font-black tracking-[0.3em] uppercase transition-all shadow-2xl shadow-orange-950/20 flex items-center justify-center gap-3 group"
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
                      <p className="text-[9px] font-mono text-orange-400/60 uppercase">Generate seats for {venues?.find(v => v.id === showBulkGen)?.name}</p>
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
                    <div key={v.id} className="p-6 flex items-center justify-between group hover:bg-white/[0.015] transition-all">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-orange-500/20 group-hover:bg-orange-500/5 transition-all">
                          <MapPin className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-mono font-black text-gray-200 tracking-wider uppercase">{v.name}</p>
                          <p className="text-[10px] font-mono text-gray-600 mt-1 uppercase tracking-tighter opacity-60">System_ID: {v.id.slice(-12)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowBulkGen(v.id)}
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-mono font-black text-gray-400 hover:text-orange-500 hover:border-orange-500/30 transition-all flex items-center gap-2"
                        >
                          <Dices className="h-3.5 w-3.5" />
                          GEN_TABLES
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Decommission this sector? All associated mappings will be reset.')) {
                              deleteVenueMutation.mutate({ id: v.id });
                            }
                          }}
                          className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
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

function TeamLogisticsCard({ team, venues, isUpdating, onUpdate }: any) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(team.venueId || 'none');
  const [selectedTableId, setSelectedTableId] = useState<string>(team.tableId || 'none');
  const [customTableNo, setCustomTableNo] = useState(team.tableNumber || '');

  // Fetch tables for the selected venue
  const { data: venueTables, isLoading: loadingTables } = trpc.admin.getVenueTables.useQuery(
    { venueId: selectedVenueId },
    { enabled: selectedVenueId !== 'none' }
  );

  const hasChanges = (selectedVenueId === 'none' ? null : selectedVenueId) !== (team.venueId || null) || 
                     (selectedTableId === 'none' ? null : selectedTableId) !== (team.tableId || null) ||
                     (customTableNo || null) !== (team.tableNumber || null);

  const isAssigned = !!team.venueId;

  const handleVenueChange = (vId: string) => {
    setSelectedVenueId(vId);
    setSelectedTableId('none'); // Reset table when venue changes
  };

  return (
    <motion.div 
      layout
      className={`relative group bg-[#0A0A0A]/40 border rounded-[32px] p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/5 ${
        isAssigned ? 'border-orange-500/30 bg-orange-500/[0.01]' : 'border-white/[0.08]'
      }`}
    >
      <div className={`absolute -inset-px rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
        isAssigned ? 'bg-gradient-to-br from-orange-500/10 to-transparent' : 'bg-gradient-to-br from-white/5 to-transparent'
      }`} />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h4 className="text-[14px] font-mono font-black text-white truncate leading-tight group-hover:text-orange-400 transition-colors">{team.name}</h4>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] font-mono px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-500 tracking-tighter">
                {team.shortCode}
              </span>
              <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border tracking-tighter ${
                team.track === 'IDEA_SPRINT' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/5 text-blue-500 border-blue-500/20'
              }`}>
                {team.track?.replace('_', '')}
              </span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
            isAssigned ? 'bg-orange-500/20 border-orange-500/40 text-orange-500 shadow-lg shadow-orange-500/20' : 'bg-white/5 border-white/10 text-gray-700'
          }`}>
            {isAssigned ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono text-gray-600 uppercase font-black tracking-widest px-1">Sector</label>
            <select
              value={selectedVenueId}
              onChange={(e) => handleVenueChange(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-[11px] font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            >
              <option value="none">UNASSIGNED</option>
              {venues.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono text-gray-600 uppercase font-black tracking-widest px-1">Table_Identity</label>
            <div className="flex flex-col gap-2">
              <select
                disabled={selectedVenueId === 'none' || loadingTables}
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-[11px] font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all disabled:opacity-30"
              >
                <option value="none">SELECT_TABLE</option>
                {venueTables?.map((t: any) => (
                  <option key={t.id} value={t.id} disabled={t.team && t.team.shortCode !== team.shortCode}>
                    {t.code} {t.team ? `(Occupied: ${t.team.shortCode})` : '(Available)'}
                  </option>
                ))}
              </select>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="CUSTOM_OVERRIDE (e.g. VIP-01)"
                  value={customTableNo}
                  onChange={(e) => setCustomTableNo(e.target.value.toUpperCase())}
                  className="w-full bg-black/60 border border-white/[0.05] rounded-xl px-4 py-2 text-[10px] font-mono text-gray-400 focus:outline-none placeholder:text-gray-800"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const table = venueTables?.find((t: any) => t.id === selectedTableId);
              onUpdate(
                team.id, 
                selectedVenueId === 'none' ? null : selectedVenueId, 
                selectedTableId === 'none' ? null : selectedTableId, 
                table ? table.code : (customTableNo || null)
              );
            }}
            disabled={!hasChanges || isUpdating}
            className={`w-full py-3.5 rounded-2xl text-[10px] font-mono font-black tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 active:scale-[0.97] ${
              hasChanges 
                ? 'bg-white text-black shadow-xl' 
                : 'bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed'
            }`}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
            {isUpdating ? 'UPDATING...' : 'COMMIT_CHANGES'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TeamLogisticsListItem({ team, venues, isUpdating, onUpdate }: any) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(team.venueId || 'none');
  const [selectedTableId, setSelectedTableId] = useState<string>(team.tableId || 'none');

  const { data: venueTables, isLoading: loadingTables } = trpc.admin.getVenueTables.useQuery(
    { venueId: selectedVenueId },
    { enabled: selectedVenueId !== 'none' }
  );

  const hasChanges = (selectedVenueId === 'none' ? null : selectedVenueId) !== (team.venueId || null) || 
                     (selectedTableId === 'none' ? null : selectedTableId) !== (team.tableId || null);

  const isAssigned = !!team.venueId;

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-black/40 border rounded-2xl transition-all ${
      isAssigned ? 'border-orange-500/20 bg-orange-500/[0.01]' : 'border-white/[0.05]'
    }`}>
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
          isAssigned ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-white/5 border-white/10 text-gray-700'
        }`}>
          {isAssigned ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-mono font-black text-white truncate">{team.name}</p>
          <p className="text-[10px] font-mono text-gray-600 truncate mt-0.5">{team.college || 'NO COLLEGE'}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <select
          value={selectedVenueId}
          onChange={(e) => {
            setSelectedVenueId(e.target.value);
            setSelectedTableId('none');
          }}
          className="w-full sm:w-48 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono text-gray-300"
        >
          <option value="none">UNASSIGNED</option>
          {venues.map((v: any) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <select
          disabled={selectedVenueId === 'none' || loadingTables}
          value={selectedTableId}
          onChange={(e) => setSelectedTableId(e.target.value)}
          className="w-full sm:w-40 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono text-gray-300"
        >
          <option value="none">SELECT_TABLE</option>
          {venueTables?.map((t: any) => (
            <option key={t.id} value={t.id} disabled={t.team && t.team.shortCode !== team.shortCode}>
              {t.code}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            const table = venueTables?.find((t: any) => t.id === selectedTableId);
            onUpdate(team.id, selectedVenueId, selectedTableId === 'none' ? null : selectedTableId, table?.code || null);
          }}
          disabled={!hasChanges || isUpdating}
          className={`w-full sm:w-auto px-6 py-2 rounded-xl text-[10px] font-mono font-black transition-all flex items-center justify-center gap-2 ${
            hasChanges 
              ? 'bg-orange-500 text-white' 
              : 'bg-white/5 text-gray-700 cursor-not-allowed'
          }`}
        >
          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {isUpdating ? 'UPDATING' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}
