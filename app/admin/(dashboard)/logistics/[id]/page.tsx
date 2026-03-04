// Logistics Team Detail — Per-member attendance, info editing, member swap, QR display
"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  GraduationCap,
  Crown,
  Shield,
  Edit3,
  UserMinus,
  QrCode,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { EditMemberModal } from "@/components/admin/logistics/EditMemberModal";
import { SwapMemberModal } from "@/components/admin/logistics/SwapMemberModal";
import { TeamQRCode } from "@/components/admin/logistics/TeamQRCode";

const POLL_INTERVAL = 30_000;

const attendanceBadge: Record<string, { label: string; style: string; icon: typeof CheckCircle2 }> = {
  NOT_MARKED: { label: "NOT MARKED", style: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
  PRESENT: { label: "PRESENT", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  ABSENT: { label: "ABSENT", style: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  PARTIAL: { label: "PARTIAL", style: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertTriangle },
};

const trackLabels: Record<string, string> = { IDEA_SPRINT: "Idea Sprint", BUILD_STORM: "Build Storm" };
const trackStyles: Record<string, string> = { IDEA_SPRINT: "bg-cyan-500/10 text-cyan-400", BUILD_STORM: "bg-orange-500/10 text-orange-400" };

export default function LogisticsTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [editMember, setEditMember] = useState<string | null>(null);
  const [swapMember, setSwapMember] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);

  const { data: team, isLoading, refetch } = trpc.logistics.getApprovedTeams.useQuery(
    { search: undefined, track: "all", attendance: "all", page: 1, pageSize: 1000 },
    { refetchInterval: POLL_INTERVAL }
  );

  // Find the specific team from the list
  const currentTeam = team?.teams.find((t) => t.id === id);

  const markTeamAttendance = trpc.logistics.markTeamAttendance.useMutation();
  const markMemberAttendance = trpc.logistics.markMemberAttendance.useMutation();

  const handleTeamAttendance = useCallback(
    async (attendance: "PRESENT" | "ABSENT") => {
      try {
        await markTeamAttendance.mutateAsync({
          teamId: id,
          attendance,
          notes: attendanceNotes || undefined,
        });
        toast.success(attendance === "PRESENT" ? "Team checked in!" : "Team marked absent");
        refetch();
      } catch {
        toast.error("Failed to update attendance");
      }
    },
    [id, attendanceNotes, markTeamAttendance, refetch]
  );

  const handleMemberToggle = useCallback(
    async (memberId: string, isPresent: boolean) => {
      try {
        await markMemberAttendance.mutateAsync({ memberId, isPresent });
        toast.success(isPresent ? "Member marked present" : "Member marked absent");
        refetch();
      } catch {
        toast.error("Failed to update member attendance");
      }
    },
    [markMemberAttendance, refetch]
  );

  const handleNotesUpdate = useCallback(async () => {
    try {
      await markTeamAttendance.mutateAsync({
        teamId: id,
        attendance: (currentTeam?.attendance || "NOT_MARKED") as "PRESENT" | "ABSENT" | "NOT_MARKED" | "PARTIAL",
        notes: attendanceNotes,
      });
      setNotesEditing(false);
      toast.success("Notes updated");
      refetch();
    } catch {
      toast.error("Failed to update notes");
    }
  }, [id, attendanceNotes, currentTeam, markTeamAttendance, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="text-center py-12">
        <p className="text-xs font-mono text-gray-600 tracking-widest">TEAM NOT FOUND OR NOT APPROVED</p>
        <button
          onClick={() => router.push("/admin/logistics")}
          className="mt-4 text-xs font-mono text-emerald-400 hover:text-emerald-300 tracking-wider"
        >
          &larr; BACK TO LOGISTICS
        </button>
      </div>
    );
  }

  const badge = attendanceBadge[currentTeam.attendance] || attendanceBadge.NOT_MARKED;
  const BadgeIcon = badge.icon;
  const _leader = currentTeam.members.find((m) => m.role === "LEADER");
  const presentCount = currentTeam.members.filter((m) => m.isPresent).length;

  return (
    <div className="space-y-6">
      {/* Header nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/logistics"
          className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-white/[0.03] rounded transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-mono font-bold text-white tracking-wider">{currentTeam.name}</h1>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {currentTeam.shortCode}
            </span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${trackStyles[currentTeam.track] || ""}`}>
              {trackLabels[currentTeam.track] || currentTeam.track}
            </span>
          </div>
          <p className="text-[10px] font-mono text-gray-500 mt-1">
            {currentTeam.college || "No college"} • {presentCount}/{currentTeam.members.length} members present
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQR(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR CODE
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-white/[0.03] rounded transition-all"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Team Attendance Section */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono font-bold text-gray-400 tracking-widest">TEAM ATTENDANCE</h2>
          <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded border ${badge.style}`}>
            <BadgeIcon className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        </div>

        {/* Attendance actions */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => handleTeamAttendance("PRESENT")}
            disabled={markTeamAttendance.isPending}
            className={`flex-1 py-2.5 text-[11px] font-mono font-bold rounded border transition-all disabled:opacity-40 ${
              currentTeam.attendance === "PRESENT"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-emerald-500/5 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/15"
            }`}
          >
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            CHECK IN (ALL PRESENT)
          </button>
          <button
            onClick={() => handleTeamAttendance("ABSENT")}
            disabled={markTeamAttendance.isPending}
            className={`flex-1 py-2.5 text-[11px] font-mono font-bold rounded border transition-all disabled:opacity-40 ${
              currentTeam.attendance === "ABSENT"
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-red-500/5 text-red-400 border-red-500/15 hover:bg-red-500/15"
            }`}
          >
            <XCircle className="h-4 w-4 inline mr-2" />
            MARK ABSENT
          </button>
        </div>

        {/* Attendance notes */}
        <div className="flex items-start gap-2">
          <textarea
            value={notesEditing ? attendanceNotes : currentTeam.attendanceNotes || ""}
            onChange={(e) => {
              setNotesEditing(true);
              setAttendanceNotes(e.target.value);
            }}
            onFocus={() => {
              if (!notesEditing) setAttendanceNotes(currentTeam.attendanceNotes || "");
              setNotesEditing(true);
            }}
            placeholder="Attendance notes (e.g., arrived late, missing ID)..."
            className="flex-1 px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
            rows={2}
          />
          {notesEditing && (
            <div className="flex flex-col gap-1">
              <button
                onClick={handleNotesUpdate}
                className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-all"
                title="Save notes"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setNotesEditing(false);
                  setAttendanceNotes("");
                }}
                className="p-1.5 text-gray-500 hover:bg-white/[0.03] rounded transition-all"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Check-in info */}
        {currentTeam.checkedInAt && (
          <p className="text-[9px] font-mono text-gray-600 mt-2">
            Checked in: {new Date(currentTeam.checkedInAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Members List */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono font-bold text-gray-400 tracking-widest">TEAM MEMBERS</h2>
          <span className="text-[10px] font-mono text-gray-500">
            {presentCount}/{currentTeam.members.length} present
          </span>
        </div>

        <div className="space-y-3">
          {currentTeam.members.map((member) => {
            const isLeader = member.role === "LEADER";
            return (
              <div
                key={member.id}
                className={`rounded border p-3 transition-all ${
                  member.isPresent
                    ? "bg-emerald-500/5 border-emerald-500/15"
                    : "bg-white/[0.01] border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Member info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Attendance checkbox */}
                    <button
                      onClick={() => handleMemberToggle(member.id, !member.isPresent)}
                      disabled={markMemberAttendance.isPending}
                      className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all disabled:opacity-30 ${
                        member.isPresent
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-600 hover:border-emerald-500/50"
                      }`}
                    >
                      {member.isPresent && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-200 font-medium truncate">
                          {member.user.name || member.user.email}
                        </span>
                        {isLeader && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                            <Crown className="h-2.5 w-2.5" />
                            LEADER
                          </span>
                        )}
                        {!isLeader && member.role === "CO_LEADER" && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                            <Shield className="h-2.5 w-2.5" />
                            CO_LEADER
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-gray-500 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />
                          {member.user.email}
                        </span>
                        {member.user.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            {member.user.phone}
                          </span>
                        )}
                        {member.user.college && (
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap className="h-2.5 w-2.5" />
                            {member.user.college}
                          </span>
                        )}
                      </div>
                      {member.checkedInAt && (
                        <p className="text-[8px] font-mono text-emerald-500/60 mt-0.5">
                          Checked in at {new Date(member.checkedInAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions (disabled for leader) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isLeader && (
                      <>
                        <button
                          onClick={() => setEditMember(member.id)}
                          className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-white/[0.03] rounded transition-all"
                          title="Edit member info"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setSwapMember(member.id)}
                          className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-white/[0.03] rounded transition-all"
                          title="Swap member"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {isLeader && (
                      <span className="text-[8px] font-mono text-gray-600 tracking-wider">LOCKED</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Member Modal */}
      {editMember && (
        <EditMemberModal
          memberId={editMember}
          teamMembers={currentTeam.members as any}
          onClose={() => setEditMember(null)}
          onSuccess={() => {
            setEditMember(null);
            refetch();
          }}
        />
      )}

      {/* Swap Member Modal */}
      {swapMember && (
        <SwapMemberModal
          memberId={swapMember}
          teamMembers={currentTeam.members as any}
          onClose={() => setSwapMember(null)}
          onSuccess={() => {
            setSwapMember(null);
            refetch();
          }}
        />
      )}

      {/* QR Code Modal */}
      {showQR && (
        <TeamQRCode
          shortCode={currentTeam.shortCode}
          teamName={currentTeam.name}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}
