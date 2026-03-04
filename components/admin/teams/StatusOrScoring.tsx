/**
 * Status or Scoring Component
 * 
 * Shows different UI based on admin role:
 * - Judges: Criteria-based scoring rubric (only for APPROVED teams)
 * - Others: Status management interface
 */

"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  Award,
  Users,
  TrendingUp,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ScoringRubric } from "./ScoringRubric";

interface StatusOrScoringProps {
  userRole: string;
  teamId: string;
  teamStatus: string;
  teamTrack: "IDEA_SPRINT" | "BUILD_STORM";
  currentScore: number | null; // used by parent for display
  currentComments: string | null; // used by parent for display
  reviewNotes: string | null;
  onStatusUpdate: (status: string, notes?: string) => Promise<void>;
  onScoreUpdate: (score: number, comments: string) => Promise<void>; // used by judge flow
}

const statusActions = [
  {
    status: "APPROVED",
    label: "Approve",
    icon: CheckCircle,
    color: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25",
  },
  {
    status: "REJECTED",
    label: "Reject",
    icon: XCircle,
    color: "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25",
  },
  {
    status: "UNDER_REVIEW",
    label: "Under Review",
    icon: Eye,
    color: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25",
  },
  {
    status: "WAITLISTED",
    label: "Waitlist",
    icon: AlertTriangle,
    color: "bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25",
  },
  {
    status: "PENDING",
    label: "Reset to Pending",
    icon: Clock,
    color: "bg-white/[0.05] text-gray-300 border border-white/[0.08] hover:bg-white/[0.08]",
  },
];

export function StatusOrScoring({
  userRole,
  teamId,
  teamStatus,
  teamTrack,
  currentScore: _currentScore,
  currentComments: _currentComments,
  reviewNotes,
  onStatusUpdate,
  onScoreUpdate: _onScoreUpdate,
}: StatusOrScoringProps) {
  const [statusNote, setStatusNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [existingScores, setExistingScores] = useState<any[]>([]);
  const [multiJudge, setMultiJudge] = useState<any>(null);
  const [isLoadingRubric, setIsLoadingRubric] = useState(false);

  // Load rubric data for judges AND admins (admins see all judge scores)
  useEffect(() => {
    if (teamStatus === "APPROVED") {
      loadRubricData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, teamStatus, teamId]);

  const loadRubricData = async () => {
    setIsLoadingRubric(true);
    try {
      const res = await fetch(`/api/admin/teams/score-rubric?teamId=${teamId}`);
      const data = await res.json();
      
      if (data.success) {
        setCriteria(data.data.criteria);
        setExistingScores(data.data.scores);
        setMultiJudge(data.data.multiJudge || null);
      }
    } catch (error) {
      console.error("Failed to load rubric data:", error);
    } finally {
      setIsLoadingRubric(false);
    }
  };

  // Judges see scoring rubric
  if (userRole === "JUDGE") {
    // Judges can only score APPROVED teams
    if (teamStatus !== "APPROVED") {
      return (
        <div className="bg-[#0A0A0A] rounded-lg border border-yellow-500/20 p-5">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <h3 className="text-sm font-mono font-bold">TEAM NOT APPROVED</h3>
              <p className="text-xs text-gray-400 mt-1">
                You can only score teams with APPROVED status. Current status: {teamStatus}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isLoadingRubric) {
      return (
        <div className="bg-[#0A0A0A] rounded-lg border border-amber-500/20 p-5">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-xs font-mono">Loading rubric...</span>
          </div>
        </div>
      );
    }

    const handleRubricScoreUpdate = async (scores: any[]) => {
      const res = await fetch("/api/admin/teams/score-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, scores }),
      });
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to submit scores");
      }
      
      // Reload rubric data to show updated scores
      await loadRubricData();
    };

    return (
      <ScoringRubric
        teamId={teamId}
        track={teamTrack}
        criteria={criteria}
        existingScores={existingScores}
        multiJudge={multiJudge}
        onScoreUpdate={handleRubricScoreUpdate}
      />
    );
  }

  // LOGISTICS role: read-only status view (no update buttons)
  if (userRole === "LOGISTICS") {
    return (
      <div className="space-y-4">
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
          <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] mb-3">
            TEAM_STATUS
          </h3>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${{
              PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              UNDER_REVIEW: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
              APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
              WAITLISTED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
              WITHDRAWN: "bg-gray-500/10 text-gray-400 border-gray-500/20",
            }[teamStatus] || "bg-white/[0.03] text-gray-400 border-white/[0.06]"}`}>
              {teamStatus.replace("_", " ")}
            </span>
            <span className="text-[10px] font-mono text-gray-600">Read-only</span>
          </div>
          {reviewNotes && (
            <div className="mt-3 text-xs font-mono text-gray-400 bg-white/[0.02] border border-white/[0.04] rounded-md p-3">
              <span className="text-gray-500 font-bold">LAST_NOTE: </span>
              {reviewNotes}
            </div>
          )}
        </div>

        {/* Judge Scores Panel (visible to logistics when scores exist) */}
        {teamStatus === "APPROVED" && (
          <AdminJudgeScoresPanel
            criteria={criteria}
            multiJudge={multiJudge}
            isLoading={isLoadingRubric}
          />
        )}
      </div>
    );
  }

  // Admins/Organizers see status management + judge scores
  return (
    <div className="space-y-4">
      {/* Status Management */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
        <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">
          UPDATE_STATUS
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Review notes (optional)..."
              className="w-full px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onStatusUpdate(action.status, statusNote || undefined);
                    setStatusNote("");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || teamStatus === action.status}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono font-bold tracking-wider rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${action.color}`}
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
        {reviewNotes && (
          <div className="mt-3 text-xs font-mono text-gray-400 bg-white/[0.02] border border-white/[0.04] rounded-md p-3">
            <span className="text-gray-500 font-bold">LAST_NOTE: </span>
            {reviewNotes}
          </div>
        )}
      </div>

      {/* Judge Scores Panel (visible to admins when scores exist) */}
      {teamStatus === "APPROVED" && (
        <AdminJudgeScoresPanel
          criteria={criteria}
          multiJudge={multiJudge}
          isLoading={isLoadingRubric}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Admin Judge Scores Panel — shows all judges' per-criterion scores
// ══════════════════════════════════════════════════════════════

function AdminJudgeScoresPanel({
  criteria,
  multiJudge,
  isLoading,
}: {
  criteria: any[];
  multiJudge: any;
  isLoading: boolean;
}) {
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-amber-500/20 p-5">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full" />
          <span className="text-xs font-mono">Loading judge scores...</span>
        </div>
      </div>
    );
  }

  if (!multiJudge || multiJudge.judgeCount === 0) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-5 w-5 text-gray-600" />
          <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em]">
            JUDGE_SCORES
          </h3>
        </div>
        <p className="text-xs font-mono text-gray-600">No judges have scored this team yet.</p>
      </div>
    );
  }

  const judges = multiJudge.judges || [];
  const criterionAverages = multiJudge.criterionAverages || {};

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-amber-500/20 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em]">
            JUDGE_SCORES
          </h3>
          <span className="text-[10px] font-mono text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded">
            {multiJudge.judgeCount} judge{multiJudge.judgeCount !== 1 ? "s" : ""}
          </span>
        </div>
        {multiJudge.averageScore !== null && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-mono text-gray-600 block">AVERAGE</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold text-amber-400">
                  {multiJudge.averageScore}
                </span>
                <span className="text-[10px] font-mono text-gray-500">/100</span>
              </div>
            </div>
            {multiJudge.stdDev > 0 && (
              <div className="text-right border-l border-white/[0.06] pl-4">
                <span className="text-[9px] font-mono text-gray-600 block">STD DEV</span>
                <span className="text-lg font-mono font-bold text-gray-400">
                  {multiJudge.stdDev}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conflict Warning */}
      {multiJudge.hasConflicts && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-mono font-bold text-red-400">SCORING CONFLICT</p>
            {multiJudge.conflicts.map((c: any, i: number) => (
              <p key={i} className="text-[10px] font-mono text-red-300/70 mt-1">
                {c.judge1} vs {c.judge2}: {c.diff}pt difference
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Score Overview — All Judges Side by Side */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            SCORE_OVERVIEW
          </span>
        </div>
        <div className="space-y-2">
          {judges.map((judge: any) => (
            <div
              key={judge.judgeId}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden hover:border-amber-500/20 transition-all"
            >
              {/* Judge row — clickable to expand */}
              <button
                onClick={() =>
                  setExpandedJudge(
                    expandedJudge === judge.judgeId ? null : judge.judgeId
                  )
                }
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center text-xs font-mono font-bold text-amber-400 shrink-0">
                  {judge.judgeName?.charAt(0)?.toUpperCase() || "J"}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono font-medium text-gray-200 truncate block">
                    {judge.judgeName}
                  </span>
                  <span className="text-[10px] font-mono text-gray-600">
                    {judge.scores?.length || 0} criteria scored
                  </span>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-2 w-36">
                  <div className="flex-1 bg-white/[0.05] rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                      style={{ width: `${Math.min(judge.weightedTotal, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono font-bold text-amber-400 w-10 text-right">
                    {judge.weightedTotal}
                  </span>
                </div>

                {expandedJudge === judge.judgeId ? (
                  <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                )}
              </button>

              {/* Expanded — per-criterion breakdown */}
              {expandedJudge === judge.judgeId && judge.scores && (
                <div className="px-3 pb-3 border-t border-white/[0.04]">
                  <div className="pt-3 space-y-2">
                    {criteria.map((criterion: any) => {
                      const judgeScore = judge.scores?.find(
                        (s: any) => s.criterionId === criterion.criterionId
                      );
                      const avg = criterionAverages[criterion.criterionId];
                      const points = judgeScore?.points || 0;
                      const pct = (points / criterion.maxPoints) * 100;

                      return (
                        <div key={criterion.id} className="bg-white/[0.02] rounded-md p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-gray-300">
                                {criterion.name}
                              </span>
                              <span className="text-[9px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {criterion.weight}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono font-bold text-amber-400">
                                {points}
                                <span className="text-gray-600 font-normal">/{criterion.maxPoints}</span>
                              </span>
                              {avg && avg.count > 1 && (
                                <span className="text-[9px] font-mono text-cyan-400/70 flex items-center gap-0.5">
                                  <TrendingUp className="h-2.5 w-2.5" />
                                  avg {avg.average}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-amber-400/70 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {/* Comment */}
                          {judgeScore?.comments && (
                            <div className="mt-2 flex items-start gap-1.5 text-[10px] font-mono text-gray-500">
                              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-gray-600" />
                              <span className="italic text-gray-400">{judgeScore.comments}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Judge's weighted breakdown */}
                  <div className="mt-3 p-2 bg-amber-500/5 border border-amber-500/10 rounded-md">
                    <div className="text-[9px] font-mono text-gray-500 mb-1">WEIGHTED_BREAKDOWN:</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {criteria.map((criterion: any) => {
                        const judgeScore = judge.scores?.find(
                          (s: any) => s.criterionId === criterion.criterionId
                        );
                        const points = judgeScore?.points || 0;
                        const normalizedScore = (points / criterion.maxPoints) * 100;
                        const weightedScore = (normalizedScore * criterion.weight) / 100;
                        return (
                          <span key={criterion.id} className="text-[10px] font-mono text-gray-500">
                            {criterion.name.split(" ")[0]}:{" "}
                            <span className="text-amber-400">{weightedScore.toFixed(1)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Criterion Averages Comparison Table */}
      {criteria.length > 0 && Object.keys(criterionAverages).length > 0 && (
        <div className="border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              CRITERION_AVERAGES
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-[9px] text-gray-500 font-bold tracking-wider py-2 pr-4">CRITERION</th>
                  <th className="text-center text-[9px] text-gray-500 font-bold tracking-wider py-2 px-2">AVG</th>
                  <th className="text-center text-[9px] text-gray-500 font-bold tracking-wider py-2 px-2">MIN</th>
                  <th className="text-center text-[9px] text-gray-500 font-bold tracking-wider py-2 px-2">MAX</th>
                  {judges.map((j: any) => (
                    <th key={j.judgeId} className="text-center text-[9px] text-gray-500 font-bold tracking-wider py-2 px-2 max-w-[60px] truncate">
                      {j.judgeName?.split(" ")[0] || "Judge"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((criterion: any) => {
                  const avg = criterionAverages[criterion.criterionId];
                  return (
                    <tr key={criterion.id} className="border-b border-white/[0.03]">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{criterion.name}</span>
                          <span className="text-[9px] text-amber-500/60">({criterion.weight}%)</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className="text-cyan-400 font-bold">{avg?.average ?? "-"}</span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className="text-gray-500">{avg?.min ?? "-"}</span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className="text-gray-500">{avg?.max ?? "-"}</span>
                      </td>
                      {judges.map((judge: any) => {
                        const judgeScore = judge.scores?.find(
                          (s: any) => s.criterionId === criterion.criterionId
                        );
                        const points = judgeScore?.points;
                        // Color-code: green if above avg, red if below, neutral otherwise
                        let color = "text-gray-400";
                        if (avg && points !== undefined && avg.count > 1) {
                          if (points > avg.average + 1) color = "text-emerald-400";
                          else if (points < avg.average - 1) color = "text-red-400";
                        }
                        return (
                          <td key={judge.judgeId} className="text-center py-2 px-2">
                            <span className={`font-bold ${color}`}>
                              {points !== undefined ? points : "-"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
