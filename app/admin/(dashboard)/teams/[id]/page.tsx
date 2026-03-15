// Team Detail Page — View team info, members, submission, comments, tags
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { useAdminRole } from '@/components/admin/AdminRoleContext';
import { StatusOrScoring } from '@/components/admin/teams/StatusOrScoring';
import {
  ArrowLeft,
  Users,
  Calendar,
  Mail,
  Phone,
  Github,
  Linkedin,
  Globe,
  FileText,
  MessageSquare,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  Send,
  Plus,
  X,
  Loader2,
  GraduationCap,
  Trash2,
  ExternalLink,
  Crown,
  Shield,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Style maps ──────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  UNDER_REVIEW: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  WAITLISTED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  WITHDRAWN: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const trackStyles: Record<string, string> = {
  IDEA_SPRINT: 'bg-cyan-500/10 text-cyan-400',
  BUILD_STORM: 'bg-orange-500/10 text-orange-400',
};

const trackLabels: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

const _statusActions = [
  {
    status: 'APPROVED',
    label: 'Approve',
    icon: CheckCircle,
    color:
      'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25',
  },
  {
    status: 'REJECTED',
    label: 'Reject',
    icon: XCircle,
    color: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25',
  },
  {
    status: 'UNDER_REVIEW',
    label: 'Under Review',
    icon: Eye,
    color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25',
  },
  {
    status: 'WAITLISTED',
    label: 'Waitlist',
    icon: AlertTriangle,
    color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25',
  },
  {
    status: 'PENDING',
    label: 'Reset to Pending',
    icon: Clock,
    color: 'bg-white/[0.05] text-gray-300 border border-white/[0.08] hover:bg-white/[0.08]',
  },
];

const tabs = [
  { key: 'members' as const, label: 'Members', icon: Users },
  { key: 'submission' as const, label: 'Submission', icon: FileText },
  { key: 'comments' as const, label: 'Comments', icon: MessageSquare },
];

// ── Main Component ──────────────────────────────────────────

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useAdminRole();
  const [activeTab, setActiveTab] = useState<'members' | 'submission' | 'comments'>('members');
  const [_statusNote, setStatusNote] = useState('');
  const [commentText, setCommentText] = useState('');
  const [newTag, setNewTag] = useState('');
  // ✅ SECURITY FIX: Use React Context instead of DOM attribute

  const { data: team, isLoading, refetch } = trpc.admin.getTeamById.useQuery({ id });
  const updateStatus = trpc.admin.updateTeamStatus.useMutation();
  const addComment = trpc.admin.addComment.useMutation();
  const addTagMut = trpc.admin.addTag.useMutation();
  const removeTagMut = trpc.admin.removeTag.useMutation();
  const deleteTeam = trpc.admin.deleteTeam.useMutation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-xs font-mono text-gray-600 tracking-widest">TEAM NOT FOUND</p>
        <button
          onClick={() => router.push('/admin/teams')}
          className="mt-4 text-xs font-mono text-orange-400 hover:text-orange-300 tracking-wider"
        >
          &larr; BACK TO TEAMS
        </button>
      </div>
    );
  }

  const handleStatusChange = async (status: string, notes?: string, sendEmail: boolean = false) => {
    try {
      await updateStatus.mutateAsync({
        teamId: id,
        status: status as
          | 'PENDING'
          | 'APPROVED'
          | 'REJECTED'
          | 'WAITLISTED'
          | 'UNDER_REVIEW'
          | 'SHORTLISTED',
        reviewNotes: notes || undefined,
        sendEmail,
      });
      toast.success(
        `Status updated to ${status.replace('_', ' ')}${sendEmail ? ' & email sent' : ''}`
      );
      setStatusNote('');
      refetch();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleScoreUpdate = async (score: number, comments: string) => {
    const res = await fetch('/api/admin/teams/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: id, score, comments }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to submit score');
    }

    refetch();
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({
        teamId: id,
        content: commentText,
        isInternal: true,
      });
      toast.success('Comment added');
      setCommentText('');
      refetch();
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    try {
      await addTagMut.mutateAsync({ teamId: id, tag: newTag.trim() });
      toast.success('Tag added');
      setNewTag('');
      refetch();
    } catch {
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagMut.mutateAsync({ tagId });
      refetch();
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    try {
      await deleteTeam.mutateAsync({ teamId: id });
      toast.success('Team deleted');
      router.push('/admin/teams');
    } catch {
      toast.error('Failed to delete team');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 md:gap-4">
          <button
            onClick={() => router.push('/admin/teams')}
            className="p-2 hover:bg-white/[0.03] rounded-md transition-all shrink-0"
            aria-label="Back to teams"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider truncate">
                {team.name}
              </h1>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-widest shrink-0">
                {team.shortCode}
              </span>
            </div>
            {/* Leader info */}
            {(() => {
              const leader = team.members.find((m: { role: string }) => m.role === 'LEADER');
              return leader ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <Crown className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-mono text-gray-400">
                    Led by{' '}
                    <span className="text-orange-400 font-medium">
                      {leader.user.name || leader.user.email}
                    </span>
                  </span>
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  trackStyles[team.track] || 'bg-white/[0.03] text-gray-400'
                }`}
              >
                {trackLabels[team.track] || team.track}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  statusStyles[team.status] || 'bg-white/[0.03] text-gray-400'
                }`}
              >
                {team.status.replace('_', ' ')}
              </span>
              <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(team.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {team.members.length} member
                {team.members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {role !== 'LOGISTICS' && role !== 'ORGANIZER' && (
            <>
              <button
                onClick={() => router.push(`/admin/teams/${id}/audit`)}
                className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <History className="h-3.5 w-3.5" />
                VIEW AUDIT TRAIL
              </button>
              {/* Score Audit History — only for scored teams */}
              {(team.status === 'APPROVED' || team.status === 'SHORTLISTED') && (
                <button
                  onClick={() => router.push(`/admin/teams/${id}/scoring-audit`)}
                  className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 rounded-md transition-all flex items-center gap-1.5 shrink-0"
                >
                  <History className="h-3.5 w-3.5" />
                  SCORE AUDIT
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteTeam.isPending}
                className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                DELETE
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tags ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {team.tags.map((tag: { id: string; tag: string; color: string }) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border"
            style={{
              borderColor: `${tag.color}40`,
              color: tag.color,
              backgroundColor: `${tag.color}10`,
            }}
          >
            <Tag className="h-2.5 w-2.5" />
            {tag.tag}
            {role !== 'LOGISTICS' && role !== 'ORGANIZER' && (
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 hover:opacity-60"
                aria-label={`Remove tag ${tag.tag}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        {role !== 'LOGISTICS' && role !== 'ORGANIZER' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTag();
            }}
            className="inline-flex items-center gap-1"
          >
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="w-24 text-[10px] font-mono px-2 py-1 bg-transparent border border-dashed border-white/[0.1] rounded focus:outline-none focus:border-orange-500/50 text-gray-400 placeholder:text-gray-600"
            />
            {newTag && (
              <button
                type="submit"
                className="p-0.5 text-orange-400 hover:text-orange-300"
                aria-label="Add tag"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* ── Status Management or Scoring ──────────────────────────── */}
      <StatusOrScoring
        userRole={role}
        teamId={id}
        teamStatus={team.status}
        teamTrack={team.track}
        currentScore={team.submission?.judgeScore || null}
        currentComments={team.submission?.judgeComments || null}
        reviewNotes={team.reviewNotes}
        shortlistedEmailSent={team.shortlistedEmailSent}
        approvedEmailSent={team.approvedEmailSent}
        round2Status={team.round2Status}
        onStatusUpdate={handleStatusChange}
        onScoreUpdate={handleScoreUpdate}
      />

      {/* ── Additional Info ────────────────────────────── */}
      {(team.college || team.hearAbout || team.additionalNotes) && (
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
          <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] mb-3">
            ADDITIONAL_INFO
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            {team.college && (
              <div>
                <span className="text-gray-500">College:</span>{' '}
                <span className="text-gray-300">{team.college}</span>
              </div>
            )}
            {team.hearAbout && (
              <div>
                <span className="text-gray-500">Heard about us:</span>{' '}
                <span className="text-gray-300">{team.hearAbout}</span>
              </div>
            )}
            {team.additionalNotes && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Notes:</span>{' '}
                <span className="text-gray-300">{team.additionalNotes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className="border-b border-white/[0.06]">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-[10px] font-mono font-bold tracking-[0.2em] uppercase border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-600 hover:text-gray-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.key === 'comments' && team.comments.length > 0 && (
                  <span className="ml-1 text-[9px] bg-white/[0.04] text-gray-400 px-1.5 py-0.5 rounded">
                    {team.comments.length}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Content ────────────────────────────────── */}
      {activeTab === 'members' && <MembersTab members={team.members} />}
      {activeTab === 'submission' && (
        <SubmissionTab submission={team.submission} track={team.track} />
      )}
      {activeTab === 'comments' && (
        <CommentsTab
          comments={team.comments}
          commentText={commentText}
          onCommentChange={setCommentText}
          onSubmit={handleAddComment}
          isSubmitting={addComment.isPending}
          readOnly={role === 'LOGISTICS' || role === 'ORGANIZER'}
        />
      )}
    </div>
  );
}

// ── Members Tab ─────────────────────────────────────────────

interface MemberUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
  degree: string | null;
  year: string | null;
  branch: string | null;
  avatar: string | null;
  linkedIn: string | null;
  github: string | null;
  portfolio: string | null;
}

function MembersTab({
  members,
}: {
  members: Array<{
    id: string;
    role: string;
    user: MemberUser;
  }>;
}) {
  const roleStyles: Record<string, string> = {
    LEADER: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
    CO_LEADER: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
    MEMBER: 'bg-white/[0.04] text-gray-400 border border-white/[0.06]',
  };

  const roleIcons: Record<string, typeof Crown> = {
    LEADER: Crown,
    CO_LEADER: Shield,
    MEMBER: Users,
  };

  // Sort: LEADER first, then CO_LEADER, then MEMBER
  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { LEADER: 0, CO_LEADER: 1, MEMBER: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  if (sortedMembers.length === 0) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-8 text-center">
        <Users className="h-10 w-10 text-gray-700 mx-auto mb-3" />
        <p className="text-xs font-mono text-gray-600 tracking-widest">NO MEMBERS FOUND</p>
        <p className="text-[10px] font-mono text-gray-700 mt-1">
          This team has no registered members yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.3em] uppercase">
          TEAM_ROSTER
        </span>
        <span className="text-[9px] font-mono text-gray-600">({sortedMembers.length})</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedMembers.map((member) => {
          const isLeader = member.role === 'LEADER';
          const displayName = member.user.name || member.user.email;
          const RoleIcon = roleIcons[member.role] || Users;

          return (
            <div
              key={member.id}
              className={`bg-[#0A0A0A] rounded-lg border p-5 transition-all ${
                isLeader
                  ? 'border-orange-500/20 shadow-[0_0_15px_rgba(255,102,0,0.05)]'
                  : 'border-white/[0.06]'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className={`w-11 h-11 rounded-md flex items-center justify-center text-sm font-mono font-bold shrink-0 ${
                    isLeader
                      ? 'bg-gradient-to-br from-orange-500/25 to-orange-600/15 border border-orange-500/30 text-orange-400'
                      : 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] text-gray-400'
                  }`}
                >
                  {member.user.name?.charAt(0)?.toUpperCase() ||
                    member.user.email.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + Role Badge */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {displayName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        roleStyles[member.role] || 'bg-white/[0.04] text-gray-400'
                      }`}
                    >
                      <RoleIcon className="h-2.5 w-2.5" />
                      {member.role.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="h-3 w-3 text-gray-600 shrink-0" />
                      <span className="truncate">{member.user.email}</span>
                    </div>
                    {member.user.phone && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Phone className="h-3 w-3 text-gray-600 shrink-0" />
                        {member.user.phone}
                      </div>
                    )}
                    {member.user.college && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <GraduationCap className="h-3 w-3 text-gray-600 shrink-0" />
                        <span className="truncate">
                          {member.user.college}
                          {member.user.degree ? ` — ${member.user.degree}` : ''}
                          {member.user.year ? ` (${member.user.year})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  {(member.user.github || member.user.linkedIn || member.user.portfolio) && (
                    <div className="flex gap-2 mt-2.5 pt-2 border-t border-white/[0.04]">
                      {member.user.github && (
                        <a
                          href={member.user.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-white/[0.03] rounded-md transition-all"
                          title="GitHub"
                          aria-label="GitHub profile"
                        >
                          <Github className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {member.user.linkedIn && (
                        <a
                          href={member.user.linkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/5 rounded-md transition-all"
                          title="LinkedIn"
                          aria-label="LinkedIn profile"
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {member.user.portfolio && (
                        <a
                          href={member.user.portfolio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-600 hover:text-orange-400 hover:bg-orange-500/5 rounded-md transition-all"
                          title="Portfolio"
                          aria-label="Portfolio website"
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Submission Tab ───────────────────────────────────────────

interface SubmissionData {
  id: string;
  ideaTitle: string | null;
  problemStatement: string | null;
  proposedSolution: string | null;
  targetUsers: string | null;
  expectedImpact: string | null;
  techStack: string | null;
  docLink: string | null;
  marketSize: string | null;
  competitors: string | null;
  problemDesc: string | null;
  githubLink: string | null;
  demoLink: string | null;
  techStackUsed: string | null;
  challenges: string | null;
  futureScope: string | null;
  submittedAt: Date | string | null;
  assignedProblemStatement: {
    id: string;
    title: string;
    description: string | null;
    objective: string;
    order: number;
  } | null;
  files: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    category: string;
  }>;
}

function SubmissionTab({
  submission,
  track,
}: {
  submission: SubmissionData | null;
  track: string;
}) {
  if (!submission) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-8 text-center">
        <FileText className="h-10 w-10 text-gray-700 mx-auto mb-3" />
        <p className="text-xs font-mono text-gray-600 tracking-widest">NO SUBMISSION YET</p>
      </div>
    );
  }

  // Build display fields based on track
  const fields: Array<{ label: string; value: string | null }> =
    track === 'IDEA_SPRINT'
      ? [
          { label: 'Idea Title', value: submission.ideaTitle },
          { label: 'Problem Statement', value: submission.problemStatement },
          { label: 'Proposed Solution', value: submission.proposedSolution },
          { label: 'Target Users', value: submission.targetUsers },
          { label: 'Expected Impact', value: submission.expectedImpact },
          { label: 'Tech Stack', value: submission.techStack },
          { label: 'Market Size', value: submission.marketSize },
          { label: 'Competitors', value: submission.competitors },
        ]
      : [
          {
            label: 'Selected Problem Statement',
            value: submission.assignedProblemStatement?.title || null,
          },
          {
            label: 'Problem Statement Description - How you plan to solve the given problem',
            value: submission.problemDesc,
          },
          { label: 'Tech Stack Used', value: submission.techStackUsed },
          { label: 'Challenges Faced', value: submission.challenges },
          { label: 'Future Scope', value: submission.futureScope },
        ];

  return (
    <div className="space-y-4">
      {/* Assigned Problem Statement for BuildStorm */}
      {track === 'BUILD_STORM' && submission.assignedProblemStatement && (
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-lg border border-orange-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-orange-400" />
            <h3 className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-[0.3em]">
              ASSIGNED_PROBLEM_STATEMENT
            </h3>
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
              #{submission.assignedProblemStatement.order}
            </span>
          </div>
          <h4 className="text-sm font-mono font-bold text-white mb-2">
            {submission.assignedProblemStatement.title}
          </h4>
          <div className="mb-3">
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              OBJECTIVE:
            </span>
            <p className="text-xs font-mono text-gray-300 mt-1">
              {submission.assignedProblemStatement.objective}
            </p>
          </div>
          {submission.assignedProblemStatement.description && (
            <div>
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                DESCRIPTION:
              </span>
              <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed mt-1">
                {submission.assignedProblemStatement.description}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
        {submission.submittedAt && (
          <div className="text-[11px] font-mono text-gray-500 mb-4 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        )}

        <div className="space-y-4">
          {fields.map(
            (field, idx) =>
              field.value && (
                <div key={idx}>
                  <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">
                    {field.label}
                  </h4>
                  <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {field.value}
                  </p>
                </div>
              )
          )}
        </div>

        {/* Links for IdeaSprint */}
        {track === 'IDEA_SPRINT' && submission.docLink && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.06]">
            <a
              href={submission.docLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-md hover:bg-cyan-500/15 transition-all"
            >
              <FileText className="h-3.5 w-3.5" />
              SUPPORTING DOCUMENTS
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}

        {/* Links for BuildStorm */}
        {track === 'BUILD_STORM' && (submission.githubLink || submission.demoLink) && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.06]">
            {submission.githubLink && (
              <a
                href={submission.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-300 bg-white/[0.04] border border-white/[0.08] rounded-md hover:text-white hover:border-white/[0.15] transition-all"
              >
                <Github className="h-3.5 w-3.5" />
                GITHUB
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {submission.demoLink && (
              <a
                href={submission.demoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-md hover:bg-orange-500/15 transition-all"
              >
                <Globe className="h-3.5 w-3.5" />
                DEMO
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Files */}
      {submission.files.length > 0 && (
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
          <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] mb-3">
            UPLOADED_FILES ({submission.files.length})
          </h4>
          <div className="space-y-2">
            {submission.files.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-md border border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08] transition-all"
              >
                <FileText className="h-4 w-4 text-gray-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-300 truncate">{file.fileName}</div>
                  <div className="text-[10px] font-mono text-gray-600">
                    {file.category.replace('_', ' ')} &middot; {(file.fileSize / 1024).toFixed(0)}{' '}
                    KB
                  </div>
                </div>
                <ExternalLink className="h-3 w-3 text-gray-600 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comments Tab ────────────────────────────────────────────

interface CommentData {
  id: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  createdAt: Date | string;
}

function CommentsTab({
  comments,
  commentText,
  onCommentChange,
  onSubmit,
  isSubmitting,
  readOnly = false,
}: {
  comments: CommentData[];
  commentText: string;
  onCommentChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Add Comment — hidden for read-only roles */}
      {!readOnly && (
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5">
          <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] mb-3">
            ADD_INTERNAL_NOTE
          </h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={commentText}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Write a note about this team..."
              rows={3}
              className="flex-1 px-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/30 resize-none"
            />
            <button
              onClick={onSubmit}
              disabled={isSubmitting || !commentText.trim()}
              className="self-end px-4 py-2 bg-orange-500/15 text-orange-400 border border-orange-500/20 text-[10px] font-mono font-bold tracking-wider rounded-md hover:bg-orange-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              SEND
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-8 text-center">
          <MessageSquare className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-xs font-mono text-gray-600 tracking-widest">NO COMMENTS YET</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 bg-white/[0.04] rounded flex items-center justify-center text-gray-600">
                  <MessageSquare className="h-2.5 w-2.5" />
                </div>
                <span className="text-[10px] font-mono text-gray-500">
                  {new Date(comment.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                {comment.isInternal && (
                  <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded tracking-wider">
                    INTERNAL
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
