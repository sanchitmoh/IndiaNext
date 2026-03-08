/**
 * Scoring Rubric Component
 *
 * Criteria-based scoring interface with:
 * - Individual criterion scoring (0-10 points)
 * - Real-time weighted score calculation
 * - Visual progress bars
 * - Comments per criterion
 * - Multi-judge support: shows your score vs average
 * - Score variance and conflict warnings
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Award,
  MessageSquare,
  Info,
  CheckCircle,
  Users,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScoringCriterion {
  id: string;
  criterionId: string;
  name: string;
  description: string;
  weight: number;
  maxPoints: number;
  order: number;
}

interface CriterionScoreData {
  criterionId: string;
  points: number;
  comments: string;
}

interface JudgeSummary {
  judgeId: string;
  judgeName: string;
  weightedTotal: number;
  isYou?: boolean;
  scores?: CriterionScoreData[];
}

interface CriterionAverage {
  average: number;
  min: number;
  max: number;
  count: number;
}

interface Conflict {
  judge1: string;
  judge2: string;
  diff: number;
}

interface MultiJudgeData {
  judgeCount: number;
  averageScore: number | null;
  stdDev: number;
  hasConflicts: boolean;
  conflicts: Conflict[];
  criterionAverages: Record<string, CriterionAverage>;
  judges: JudgeSummary[];
}

interface ScoringRubricProps {
  teamId: string;
  track: 'IDEA_SPRINT' | 'BUILD_STORM'; // kept for future track-specific UI
  criteria: ScoringCriterion[];
  existingScores?: CriterionScoreData[];
  multiJudge?: MultiJudgeData;
  onScoreUpdate: (scores: CriterionScoreData[]) => Promise<void>;
}

export function ScoringRubric({
  teamId,
  track: _track,
  criteria,
  existingScores = [],
  multiJudge,
  onScoreUpdate,
}: ScoringRubricProps) {
  const [scores, setScores] = useState<Map<string, CriterionScoreData>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

  // Initialize scores from existing data
  useEffect(() => {
    const scoreMap = new Map<string, CriterionScoreData>();
    existingScores.forEach((score) => {
      scoreMap.set(score.criterionId, score);
    });
    setScores(scoreMap);
  }, [existingScores]);

  // Calculate weighted total score
  const calculateTotalScore = () => {
    let totalWeightedScore = 0;
    criteria.forEach((criterion) => {
      const score = scores.get(criterion.criterionId);
      if (score) {
        const normalizedScore = (score.points / criterion.maxPoints) * 100;
        const weightedScore = (normalizedScore * criterion.weight) / 100;
        totalWeightedScore += weightedScore;
      }
    });
    return Math.round(totalWeightedScore * 10) / 10; // Round to 1 decimal
  };

  const updateScore = (criterionId: string, points: number, comments: string) => {
    const newScores = new Map(scores);
    newScores.set(criterionId, { criterionId, points, comments });
    setScores(newScores);
  };

  const handleSubmit = async () => {
    // Validate all criteria are scored
    const missingCriteria = criteria.filter(
      (c) => !scores.has(c.criterionId) || scores.get(c.criterionId)!.points === 0
    );

    if (missingCriteria.length > 0) {
      toast.error(`Please score all criteria: ${missingCriteria.map((c) => c.name).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onScoreUpdate(Array.from(scores.values()));
      toast.success('Scores submitted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalScore = calculateTotalScore();
  const allScored = criteria.every((c) => scores.has(c.criterionId));

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-amber-500/20 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em]">
            SCORING_RUBRIC
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {/* Your Score */}
          <div className="text-right">
            <span className="text-[9px] font-mono text-gray-600 block">YOUR SCORE</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-mono font-bold text-amber-400">{totalScore}</span>
              <span className="text-[10px] font-mono text-gray-500">/100</span>
            </div>
          </div>
          {/* Average Score (multi-judge) */}
          {multiJudge && multiJudge.judgeCount > 1 && multiJudge.averageScore !== null && (
            <div className="text-right border-l border-white/[0.06] pl-4">
              <span className="text-[9px] font-mono text-gray-600 block">
                AVG ({multiJudge.judgeCount} JUDGES)
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-mono font-bold text-cyan-400">
                  {multiJudge.averageScore}
                </span>
                <span className="text-[10px] font-mono text-gray-500">/100</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conflict Warning */}
      {multiJudge?.hasConflicts && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-mono font-bold text-red-400">SCORING CONFLICT DETECTED</p>
            {multiJudge.conflicts.map((c, i) => (
              <p key={i} className="text-[10px] font-mono text-red-300/70 mt-1">
                {c.judge1} vs {c.judge2}: {c.diff}pt difference
              </p>
            ))}
            <p className="text-[10px] font-mono text-gray-500 mt-1">
              Scores differ by &gt;15 points. Consider discussion to resolve.
            </p>
          </div>
        </div>
      )}

      {/* Multi-Judge Summary Panel */}
      {multiJudge && multiJudge.judgeCount > 1 && (
        <div className="mb-4 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              JUDGE_SCORES ({multiJudge.judgeCount})
            </span>
            {multiJudge.stdDev > 0 && (
              <span className="text-[9px] font-mono text-gray-600 ml-auto">
                σ = {multiJudge.stdDev}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {multiJudge.judges.map((judge) => {
              const isYou = judge.isYou || judge.judgeId === teamId; // teamId used as fallback
              return (
                <div key={judge.judgeId} className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono flex-1 ${isYou ? 'text-amber-400 font-bold' : 'text-gray-400'}`}
                  >
                    {judge.judgeName}
                    {isYou ? ' (You)' : ''}
                  </span>
                  <div className="w-24 bg-white/[0.05] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isYou ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ width: `${judge.weightedTotal}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono w-8 text-right ${isYou ? 'text-amber-400' : 'text-cyan-400'}`}
                  >
                    {judge.weightedTotal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-white/[0.05] rounded-full h-3">
            <div
              className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalScore}%` }}
            />
          </div>
        </div>
        <p className="text-[10px] font-mono text-gray-600">
          {allScored
            ? 'All criteria scored'
            : `${criteria.length - Array.from(scores.keys()).length} criteria remaining`}
        </p>
      </div>

      {/* Criteria List */}
      <div className="space-y-3 mb-5">
        {criteria.map((criterion) => {
          const score = scores.get(criterion.criterionId);
          const isExpanded = expandedCriterion === criterion.criterionId;
          const currentPoints = score?.points || 0;
          const percentage = (currentPoints / criterion.maxPoints) * 100;
          const criterionAvg = multiJudge?.criterionAverages?.[criterion.criterionId];

          return (
            <div
              key={criterion.id}
              className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 hover:border-amber-500/30 transition-all"
            >
              {/* Criterion Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-mono font-bold text-gray-200">{criterion.name}</h4>
                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                      {criterion.weight}%
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedCriterion(isExpanded ? null : criterion.criterionId)}
                    className="flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-gray-400"
                  >
                    <Info className="h-3 w-3" />
                    {isExpanded ? 'Hide' : 'Show'} description
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-amber-400">{currentPoints}</div>
                  <div className="text-[10px] font-mono text-gray-500">/ {criterion.maxPoints}</div>
                  {/* Criterion average from other judges */}
                  {criterionAvg && criterionAvg.count > 1 && (
                    <div className="text-[9px] font-mono text-cyan-400/70 mt-0.5 flex items-center gap-0.5 justify-end">
                      <TrendingUp className="h-2.5 w-2.5" />
                      avg {criterionAvg.average}
                    </div>
                  )}
                </div>
              </div>

              {/* Description (Expandable) */}
              {isExpanded && (
                <div className="mb-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded text-xs font-mono text-gray-400">
                  {criterion.description}
                </div>
              )}

              {/* Score Slider */}
              <div className="mb-3">
                <input
                  type="range"
                  min="0"
                  max={criterion.maxPoints}
                  step="0.5"
                  value={currentPoints}
                  onChange={(e) =>
                    updateScore(
                      criterion.criterionId,
                      Number(e.target.value),
                      score?.comments || ''
                    )
                  }
                  className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, rgb(251, 191, 36) 0%, rgb(251, 191, 36) ${percentage}%, rgba(255,255,255,0.05) ${percentage}%, rgba(255,255,255,0.05) 100%)`,
                  }}
                  title={`Score for ${criterion.name}: 0 to ${criterion.maxPoints} points`}
                  aria-label={`${criterion.name} score slider`}
                />
                <div className="flex justify-between mt-1">
                  {Array.from({ length: criterion.maxPoints + 1 }, (_, i) => (
                    <span key={i} className="text-[9px] font-mono text-gray-600">
                      {i}
                    </span>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-[10px] font-mono text-gray-500 mb-1 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Comments (Optional)
                </label>
                <textarea
                  value={score?.comments || ''}
                  onChange={(e) =>
                    updateScore(criterion.criterionId, currentPoints, e.target.value)
                  }
                  rows={2}
                  className="w-full px-2 py-1.5 text-[11px] font-mono bg-white/[0.02] border border-white/[0.04] rounded text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30 resize-none"
                  placeholder={`Feedback for ${criterion.name.toLowerCase()}...`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !allScored}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-black text-sm font-mono font-bold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {allScored ? (
          <>
            <CheckCircle className="h-4 w-4" />
            {isSubmitting ? 'SUBMITTING...' : 'SUBMIT ALL SCORES'}
          </>
        ) : (
          <>
            <Award className="h-4 w-4" />
            SCORE ALL CRITERIA TO SUBMIT
          </>
        )}
      </button>

      {/* Scoring Summary */}
      {allScored && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="text-[10px] font-mono text-gray-400 mb-2">BREAKDOWN:</div>
          <div className="space-y-1">
            {criteria.map((criterion) => {
              const score = scores.get(criterion.criterionId)!;
              const normalizedScore = (score.points / criterion.maxPoints) * 100;
              const weightedScore = (normalizedScore * criterion.weight) / 100;
              return (
                <div key={criterion.id} className="flex justify-between text-[10px] font-mono">
                  <span className="text-gray-500">{criterion.name}:</span>
                  <span className="text-amber-400">
                    {score.points}/{criterion.maxPoints} × {criterion.weight}% ={' '}
                    {weightedScore.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
