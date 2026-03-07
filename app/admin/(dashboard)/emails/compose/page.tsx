// Email Campaign — Compose / Edit
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Save,
  Users,
  Eye,
  Loader2,
  AlertTriangle,
  Braces,
  EyeOff,
  SendHorizonal,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

type AudienceType = "ALL" | "LEADERS_ONLY" | "CUSTOM";

const TEAM_STATUSES = [
  "REGISTERED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "WAITLISTED",
];

const TRACKS = [
  { value: "IDEA_SPRINT", label: "IdeaSprint" },
  { value: "BUILD_STORM", label: "BuildStorm" },
];

const TEMPLATE_VARIABLES = [
  { key: "name", label: "Name", description: "Recipient's name" },
  { key: "email", label: "Email", description: "Recipient's email" },
  { key: "team", label: "Team", description: "Team name" },
  { key: "track", label: "Track", description: "Track (IdeaSprint / BuildStorm)" },
  { key: "college", label: "College", description: "College name" },
  { key: "role", label: "Role", description: "Member role (LEADER / MEMBER)" },
  { key: "shortCode", label: "Short Code", description: "Team short code" },
] as const;

// Sample data for live preview
const SAMPLE_RECIPIENT = {
  name: "Aarav Sharma",
  email: "aarav@example.com",
  team: "Team Phoenix",
  track: "BuildStorm",
  college: "IIT Delhi",
  role: "LEADER",
  shortCode: "PHX-42",
};

function renderPreview(template: string): string {
  let result = template;
  for (const [key, value] of Object.entries(SAMPLE_RECIPIENT)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export default function ComposeEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [track, setTrack] = useState("");
  const [college, setCollege] = useState("");
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Load existing campaign for editing
  const { data: existing } = trpc.email.getCampaign.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSubject(existing.subject);
      setBody(existing.body);
      setPreviewText(existing.previewText || "");
      setAudienceType(existing.audienceType as AudienceType);
      const filters = existing.filters as { statuses?: string[]; track?: string; college?: string } | null;
      if (filters) {
        setSelectedStatuses(filters.statuses || []);
        setTrack(filters.track || "");
        setCollege(filters.college || "");
      }
    }
  }, [existing]);

  // Derive filters for preview
  const filters = audienceType === "CUSTOM"
    ? {
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses }),
        ...(track && { track }),
        ...(college && { college }),
      }
    : undefined;

  // Preview recipients
  const {
    data: preview,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = trpc.email.previewRecipients.useQuery(
    { audienceType, filters },
    { enabled: showRecipientPreview }
  );

  // Mutations
  const createMutation = trpc.email.createCampaign.useMutation();
  const updateMutation = trpc.email.updateCampaign.useMutation();
  const sendMutation = trpc.email.sendCampaign.useMutation();
  const testEmailMutation = trpc.email.sendTestEmail.useMutation();

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSending = sendMutation.isPending;

  const isValid = name.trim() && subject.trim() && body.trim();

  // Insert template variable at cursor position in body textarea
  const insertVariable = useCallback((varKey: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const tag = `{{${varKey}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const newBody = before + tag + after;
    setBody(newBody);
    // Restore cursor after the inserted variable
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [body]);

  // Count template variables used in body
  const usedVarCount = TEMPLATE_VARIABLES.filter(v =>
    body.includes(`{{${v.key}}}`)
  ).length;

  const handleSaveDraft = async () => {
    if (!isValid) {
      toast.error("Fill in name, subject, and body");
      return;
    }

    try {
      if (editId) {
        await updateMutation.mutateAsync({
          id: editId,
          name,
          subject,
          body,
          previewText: previewText || undefined,
          audienceType,
          filters,
        });
        toast.success("Campaign updated");
      } else {
        const created = await createMutation.mutateAsync({
          name,
          subject,
          body,
          previewText: previewText || undefined,
          audienceType,
          filters,
        });
        toast.success("Draft saved");
        router.push(`/admin/emails/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save campaign");
    }
  };

  const handleSend = async () => {
    if (!isValid) {
      toast.error("Fill in name, subject, and body");
      return;
    }

    try {
      let campaignId = editId;

      // Save first if new or modified
      if (!campaignId) {
        const created = await createMutation.mutateAsync({
          name,
          subject,
          body,
          previewText: previewText || undefined,
          audienceType,
          filters,
        });
        campaignId = created.id;
      } else {
        await updateMutation.mutateAsync({
          id: campaignId,
          name,
          subject,
          body,
          previewText: previewText || undefined,
          audienceType,
          filters,
        });
      }

      const result = await sendMutation.mutateAsync({ id: campaignId });
      toast.success(`Campaign sent to ${result.totalSent} recipients`);
      router.push(`/admin/emails/${campaignId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send campaign");
    } finally {
      setConfirmSend(false);
    }
  };

  const handleSendTest = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Fill in subject and body first");
      return;
    }
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setSendingTest(true);
    try {
      await testEmailMutation.mutateAsync({
        toEmail: testEmail.trim(),
        subject,
        body,
        previewText: previewText || undefined,
      });
      toast.success(`Test email sent to ${testEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test");
    } finally {
      setSendingTest(false);
    }
  };

  const toggleStatus = (s: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/emails")}
          className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-white/[0.03] rounded-md transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">
            {editId ? "EDIT_CAMPAIGN" : "NEW_CAMPAIGN"}
          </h1>
          <p className="text-[11px] font-mono text-gray-500 mt-0.5">
            {editId ? "Update draft campaign" : "Compose a new email campaign"}
          </p>
        </div>
        {/* Email Preview Toggle */}
        <button
          onClick={() => setShowEmailPreview(!showEmailPreview)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all ${
            showEmailPreview
              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20"
              : "bg-white/[0.03] text-gray-400 border-white/[0.06] hover:text-cyan-400 hover:border-cyan-500/20"
          }`}
        >
          {showEmailPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showEmailPreview ? "HIDE PREVIEW" : "PREVIEW"}
        </button>
      </div>

      {/* Two-column layout: form + preview */}
      <div className={`grid gap-4 ${showEmailPreview ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Left column: Form */}
        <div className="space-y-4">
          {/* Campaign Name */}
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
            <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider mb-2">
              CAMPAIGN_NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Day 1 Welcome Email"
              className="w-full px-3 py-2 text-sm font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
              maxLength={200}
            />
          </div>

          {/* Subject + Preview Text */}
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider mb-2">
                EMAIL_SUBJECT
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Welcome to IndiaNext! 🚀"
                className="w-full px-3 py-2 text-sm font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider mb-2">
                PREVIEW_TEXT <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Shows in email inbox preview"
                className="w-full px-3 py-2 text-sm font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
                maxLength={200}
              />
            </div>
          </div>

          {/* Body with Variable Toolbar */}
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">
                EMAIL_BODY
              </label>
              <span className="text-[9px] font-mono text-gray-600">
                <Braces className="h-3 w-3 inline mr-1" />
                {usedVarCount} / {TEMPLATE_VARIABLES.length} variables used
              </span>
            </div>

            {/* Template Variable Toolbar */}
            <div className="flex gap-1.5 flex-wrap mb-2 p-2 bg-[#050505] border border-white/[0.04] rounded-md">
              <span className="text-[8px] font-mono text-gray-600 self-center mr-1 tracking-wider">INSERT:</span>
              {TEMPLATE_VARIABLES.map((v) => {
                const isUsed = body.includes(`{{${v.key}}}`);
                return (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.description}
                    className={`px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded border transition-all ${
                      isUsed
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                        : "bg-white/[0.02] text-gray-500 border-white/[0.06] hover:text-orange-400 hover:border-orange-500/20"
                    }`}
                  >
                    {`{{${v.key}}}`}
                  </button>
                );
              })}
            </div>

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi {{name}},\n\nWelcome to IndiaNext! Your team {{team}} has been registered for the {{track}} track.\n\nBest regards,\nThe IndiaNext Team"}
              rows={14}
              className="w-full px-3 py-2 text-sm font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors resize-y"
              maxLength={50000}
            />
            <p className="text-[9px] font-mono text-gray-600 mt-1">
              {body.length.toLocaleString()} / 50,000 characters
            </p>
          </div>

          {/* Send Test Email */}
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
            <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider mb-2">
              SEND_TEST <span className="text-gray-600">(with sample data)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-3 py-1.5 text-[11px] font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !subject.trim() || !body.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-cyan-400 hover:border-cyan-500/20 transition-all disabled:opacity-40"
              >
                {sendingTest ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <SendHorizonal className="h-3 w-3" />
                )}
                SEND TEST
              </button>
            </div>
            <p className="text-[8px] font-mono text-gray-600 mt-1.5">
              Variables replaced with sample data: {SAMPLE_RECIPIENT.name}, {SAMPLE_RECIPIENT.team}, {SAMPLE_RECIPIENT.track}
            </p>
          </div>

          {/* Audience */}
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider">
              AUDIENCE
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "LEADERS_ONLY", "CUSTOM"] as AudienceType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setAudienceType(t)}
                  className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all ${
                    audienceType === t
                      ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                      : "bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-gray-300"
                  }`}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-mono text-gray-600">
              {audienceType === "ALL" && "Sends to all team members (leaders + members)"}
              {audienceType === "LEADERS_ONLY" && "Sends only to team leaders"}
              {audienceType === "CUSTOM" && "Filter by team status, track, or college"}
            </p>

            {/* Custom Filters */}
            {audienceType === "CUSTOM" && (
              <div className="space-y-3 pt-2 border-t border-white/[0.04]">
                {/* Status multi-select */}
                <div>
                  <label className="block text-[9px] font-mono font-bold text-gray-500 tracking-wider mb-1.5">
                    TEAM_STATUS
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {TEAM_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleStatus(s)}
                        className={`px-2 py-1 text-[9px] font-mono font-bold tracking-wider rounded border transition-all ${
                          selectedStatuses.includes(s)
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20"
                            : "bg-white/[0.02] text-gray-600 border-white/[0.06] hover:text-gray-400"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Track */}
                <div>
                  <label className="block text-[9px] font-mono font-bold text-gray-500 tracking-wider mb-1.5">
                    TRACK
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setTrack("")}
                      className={`px-2 py-1 text-[9px] font-mono font-bold tracking-wider rounded border transition-all ${
                        !track
                          ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                          : "bg-white/[0.02] text-gray-600 border-white/[0.06] hover:text-gray-400"
                      }`}
                    >
                      ALL
                    </button>
                    {TRACKS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTrack(t.value)}
                        className={`px-2 py-1 text-[9px] font-mono font-bold tracking-wider rounded border transition-all ${
                          track === t.value
                            ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                            : "bg-white/[0.02] text-gray-600 border-white/[0.06] hover:text-gray-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* College */}
                <div>
                  <label className="block text-[9px] font-mono font-bold text-gray-500 tracking-wider mb-1.5">
                    COLLEGE <span className="text-gray-700">(contains match)</span>
                  </label>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. IIT"
                    className="w-full max-w-xs px-3 py-1.5 text-[11px] font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Preview Recipients */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setShowRecipientPreview(true);
                  refetchPreview();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-cyan-400 hover:border-cyan-500/20 transition-all"
              >
                {previewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                PREVIEW RECIPIENTS
              </button>

              {showRecipientPreview && preview && (
                <div className="mt-3 p-3 bg-[#050505] border border-white/[0.06] rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-[11px] font-mono font-bold text-white">
                      {preview.total} recipients
                    </span>
                    {preview.capped && (
                      <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Capped at 500
                      </span>
                    )}
                  </div>
                  {preview.sample.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {preview.sample.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                          <span className="text-gray-300">{r.name || "—"}</span>
                          <span className="text-gray-600">·</span>
                          <span>{r.email}</span>
                          <span className="text-gray-600">·</span>
                          <span className="text-gray-600">{r.teamName}</span>
                        </div>
                      ))}
                      {preview.total > 20 && (
                        <p className="text-[9px] font-mono text-gray-600 pt-1">
                          + {preview.total - 20} more...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Live Email Preview */}
        {showEmailPreview && (
          <div className="space-y-4">
            <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg overflow-hidden sticky top-4">
              {/* Preview Header */}
              <div className="p-3 border-b border-white/[0.06] bg-[#080808]">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider">LIVE_PREVIEW</span>
                </div>
                <p className="text-[8px] font-mono text-gray-600">
                  Rendered with sample data — variables highlighted in preview
                </p>
              </div>

              {/* Email Envelope */}
              <div className="p-4 space-y-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-600 w-12 shrink-0">FROM:</span>
                  <span className="text-[11px] font-mono text-gray-400">IndiaNext &lt;noreply@indianext.in&gt;</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-600 w-12 shrink-0">TO:</span>
                  <span className="text-[11px] font-mono text-orange-400">{SAMPLE_RECIPIENT.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-600 w-12 shrink-0">SUBJ:</span>
                  <span className="text-[11px] font-mono text-white font-bold">
                    {subject ? renderPreview(subject) : <span className="text-gray-600 italic">No subject</span>}
                  </span>
                </div>
                {previewText && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-600 w-12 shrink-0">PREV:</span>
                    <span className="text-[11px] font-mono text-gray-500 italic">{renderPreview(previewText)}</span>
                  </div>
                )}
              </div>

              {/* Email Body Preview */}
              <div className="p-4">
                <div className="bg-white rounded-md p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                  {body ? (
                    <pre className="text-sm font-sans text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                      {renderPreview(body)}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Start typing to see preview...</p>
                  )}
                </div>
              </div>

              {/* Sample Data Legend */}
              <div className="px-4 pb-3">
                <div className="p-2 bg-[#050505] border border-white/[0.04] rounded-md">
                  <span className="text-[8px] font-mono text-gray-600 tracking-wider">SAMPLE DATA:</span>
                  <div className="flex gap-3 flex-wrap mt-1">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <span key={v.key} className="text-[8px] font-mono">
                        <span className="text-gray-600">{v.key}=</span>
                        <span className="text-orange-400">{SAMPLE_RECIPIENT[v.key as keyof typeof SAMPLE_RECIPIENT]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.06]">
        <button
          onClick={handleSaveDraft}
          disabled={isSaving || isSending || !isValid}
          className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold tracking-wider text-gray-300 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-40"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          SAVE DRAFT
        </button>

        {!confirmSend ? (
          <button
            onClick={() => setConfirmSend(true)}
            disabled={isSaving || isSending || !isValid}
            className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold tracking-wider text-white bg-orange-500 rounded-md hover:bg-orange-600 transition-all disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            SEND NOW
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-amber-400">Are you sure?</span>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold tracking-wider text-white bg-red-500 rounded-md hover:bg-red-600 transition-all disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              CONFIRM SEND
            </button>
            <button
              onClick={() => setConfirmSend(false)}
              className="px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Schedule toggle */}
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all ${
            showSchedule
              ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
              : "bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-gray-300"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          SCHEDULE
        </button>
      </div>

      {/* Schedule Panel */}
      {showSchedule && (
        <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
          <label className="block text-[10px] font-mono font-bold text-gray-400 tracking-wider mb-2">
            SCHEDULE_FOR <span className="text-gray-600">(IST)</span>
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="px-3 py-1.5 text-[11px] font-mono bg-[#050505] border border-white/[0.06] rounded-md text-white focus:outline-none focus:border-orange-500/30 transition-colors"
            />
            {scheduledAt && (
              <span className="text-[9px] font-mono text-gray-500">
                {new Date(scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
          <p className="text-[8px] font-mono text-gray-600 mt-1.5">
            Scheduling saves the campaign as a draft with a scheduled time. Manual send is still required.
          </p>
        </div>
      )}
    </div>
  );
}
