// Email Campaign — Detail View
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Copy,
  RotateCcw,
  Trash2,
  Pencil,
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
type RecipientStatus = "PENDING" | "SENT" | "DELIVERED" | "OPENED" | "BOUNCED" | "FAILED";

const campaignStatusConfig: Record<CampaignStatus, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "DRAFT", bg: "bg-gray-500/15", text: "text-gray-400" },
  SCHEDULED: { label: "SCHEDULED", bg: "bg-blue-500/15", text: "text-blue-400" },
  SENDING: { label: "SENDING", bg: "bg-cyan-500/15", text: "text-cyan-400" },
  SENT: { label: "SENT", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  FAILED: { label: "FAILED", bg: "bg-red-500/15", text: "text-red-400" },
};

const recipientStatusConfig: Record<RecipientStatus, { label: string; bg: string; text: string; icon: typeof Mail }> = {
  PENDING: { label: "PENDING", bg: "bg-gray-500/15", text: "text-gray-400", icon: Clock },
  SENT: { label: "SENT", bg: "bg-cyan-500/15", text: "text-cyan-400", icon: Send },
  DELIVERED: { label: "DELIVERED", bg: "bg-emerald-500/15", text: "text-emerald-400", icon: CheckCircle2 },
  OPENED: { label: "OPENED", bg: "bg-blue-500/15", text: "text-blue-400", icon: Eye },
  BOUNCED: { label: "BOUNCED", bg: "bg-amber-500/15", text: "text-amber-400", icon: AlertTriangle },
  FAILED: { label: "FAILED", bg: "bg-red-500/15", text: "text-red-400", icon: XCircle },
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Recipients table state
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus | "">("");
  const [recipientSearch, setRecipientSearch] = useState("");

  // Queries
  const { data: campaign, isLoading, refetch } = trpc.email.getCampaign.useQuery({ id });
  const { data: stats } = trpc.email.getCampaignStats.useQuery({ id });
  const { data: recipientsData, isLoading: recipientsLoading } = trpc.email.getCampaignRecipients.useQuery({
    campaignId: id,
    page: recipientPage,
    pageSize: 50,
    ...(recipientStatus && { status: recipientStatus }),
    ...(recipientSearch && { search: recipientSearch }),
  });

  // Mutations
  const deleteMutation = trpc.email.deleteCampaign.useMutation();
  const duplicateMutation = trpc.email.duplicateCampaign.useMutation();
  const retryMutation = trpc.email.retryFailed.useMutation();
  const sendMutation = trpc.email.sendCampaign.useMutation();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const status = (campaign?.status || "DRAFT") as CampaignStatus;
  const statusCfg = campaignStatusConfig[status];

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Campaign deleted");
      router.push("/admin/emails");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleDuplicate = async () => {
    try {
      const dup = await duplicateMutation.mutateAsync({ id });
      toast.success("Campaign duplicated");
      router.push(`/admin/emails/compose?edit=${dup.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    }
  };

  const handleRetry = async () => {
    try {
      const result = await retryMutation.mutateAsync({ id });
      toast.success(`Retried — ${result.totalRetried} sent, ${result.totalFailed} failed`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    }
  };

  const handleSend = async () => {
    try {
      const result = await sendMutation.mutateAsync({ id });
      toast.success(`Sent to ${result.totalSent} recipients`);
      setConfirmSend(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
      setConfirmSend(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/[0.06] rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-white/[0.06] rounded w-12 mb-2" />
              <div className="h-3 bg-white/[0.06] rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-mono text-gray-500">Campaign not found</p>
        <Link
          href="/admin/emails"
          className="inline-flex items-center gap-2 mt-4 text-[11px] font-mono text-orange-400 hover:text-orange-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to campaigns
        </Link>
      </div>
    );
  }

  const hasFailedRecipients = (stats?.breakdown?.FAILED ?? 0) > 0 || (stats?.breakdown?.BOUNCED ?? 0) > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/admin/emails")}
            className="p-1.5 mt-0.5 text-gray-400 hover:text-orange-400 hover:bg-white/[0.03] rounded-md transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
              <span className="text-[9px] font-mono text-gray-600 uppercase">
                {campaign.audienceType?.replace("_", " ")}
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">{campaign.name}</h1>
            <p className="text-[11px] font-mono text-gray-500 mt-0.5">
              Subject: {campaign.subject}
            </p>
            <p className="text-[9px] font-mono text-gray-600 mt-0.5">
              Created by {campaign.creator?.name || "Unknown"} · {new Date(campaign.createdAt).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap ml-9 sm:ml-0">
          {status === "DRAFT" && (
            <>
              <Link
                href={`/admin/emails/compose?edit=${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all"
              >
                <Pencil className="h-3 w-3" />
                EDIT
              </Link>
              {!confirmSend ? (
                <button
                  onClick={() => setConfirmSend(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-white bg-orange-500 rounded-md hover:bg-orange-600 transition-all"
                >
                  <Send className="h-3 w-3" />
                  SEND
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-white bg-red-500 rounded-md hover:bg-red-600 transition-all disabled:opacity-40"
                  >
                    {sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    CONFIRM
                  </button>
                  <button
                    onClick={() => setConfirmSend(false)}
                    className="text-[10px] font-mono text-gray-500 hover:text-gray-300"
                  >
                    CANCEL
                  </button>
                </div>
              )}
            </>
          )}

          {hasFailedRecipients && (status === "SENT" || status === "FAILED") && (
            <button
              onClick={handleRetry}
              disabled={retryMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-all disabled:opacity-40"
            >
              {retryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              RETRY FAILED
            </button>
          )}

          <button
            onClick={handleDuplicate}
            disabled={duplicateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
          >
            <Copy className="h-3 w-3" />
            DUPLICATE
          </button>

          {(status === "DRAFT" || status === "FAILED") && (
            <>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                  DELETE
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-white bg-red-500 rounded-md hover:bg-red-600 transition-all disabled:opacity-40"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    CONFIRM DELETE
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] font-mono text-gray-500 hover:text-gray-300"
                  >
                    CANCEL
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {status !== "DRAFT" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "TOTAL", value: stats.totalRecipients, icon: Users, color: "text-white" },
            { label: "SENT", value: stats.totalSent, icon: Send, color: "text-cyan-400" },
            { label: "DELIVERED", value: stats.totalDelivered, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "OPENED", value: stats.totalOpened, icon: Eye, color: "text-blue-400" },
            { label: "FAILED", value: stats.totalFailed, icon: XCircle, color: "text-red-400" },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <StatIcon className={`h-3.5 w-3.5 ${stat.color}`} />
                  <span className="text-[9px] font-mono font-bold text-gray-500 tracking-wider">{stat.label}</span>
                </div>
                <span className={`text-xl font-mono font-black ${stat.color}`}>{stat.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Email Body Preview */}
      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">EMAIL_BODY</span>
        </div>
        <div className="bg-[#050505] border border-white/[0.04] rounded-md p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
          {campaign.body}
        </div>
        {campaign.previewText && (
          <p className="text-[9px] font-mono text-gray-600 mt-2">
            Preview text: {campaign.previewText}
          </p>
        )}
      </div>

      {/* Recipients Table */}
      {status !== "DRAFT" && (
        <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">
                  RECIPIENTS ({recipientsData?.total || 0})
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={recipientSearch}
                    onChange={(e) => {
                      setRecipientSearch(e.target.value);
                      setRecipientPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 text-[10px] font-mono bg-[#050505] border border-white/[0.06] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors w-40"
                  />
                </div>
                {/* Status filter */}
                <select
                  value={recipientStatus}
                  onChange={(e) => {
                    setRecipientStatus(e.target.value as RecipientStatus | "");
                    setRecipientPage(1);
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-mono bg-[#050505] border border-white/[0.06] rounded-md text-gray-300 focus:outline-none focus:border-orange-500/30 transition-colors"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(recipientStatusConfig) as RecipientStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["RECIPIENT", "TEAM", "ROLE", "STATUS", "SENT AT", "ERROR"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[9px] font-mono font-bold text-gray-500 tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipientsLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-white/[0.06] rounded w-20 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : recipientsData?.recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[11px] font-mono text-gray-600">
                      No recipients found
                    </td>
                  </tr>
                ) : (
                  recipientsData?.recipients.map((r) => {
                    const rStatus = (r.status || "PENDING") as RecipientStatus;
                    const rCfg = recipientStatusConfig[rStatus];
                    return (
                      <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-[11px] font-mono text-white">{r.name || "—"}</div>
                          <div className="text-[10px] font-mono text-gray-500">{r.email}</div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-gray-400">{r.teamName || "—"}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-gray-500 uppercase">{r.memberRole || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded ${rCfg.bg} ${rCfg.text}`}>
                            {rCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-gray-500">
                          {r.sentAt ? new Date(r.sentAt).toLocaleString("en-IN", { 
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                          }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-red-400 max-w-[200px] truncate">
                          {r.error || ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/[0.04]">
            {recipientsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-3 bg-white/[0.06] rounded w-32 mb-2" />
                  <div className="h-3 bg-white/[0.06] rounded w-48" />
                </div>
              ))
            ) : (
              recipientsData?.recipients.map((r) => {
                const rStatus = (r.status || "PENDING") as RecipientStatus;
                const rCfg = recipientStatusConfig[rStatus];
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-bold text-white">{r.name || r.email}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider rounded ${rCfg.bg} ${rCfg.text}`}>
                        {rCfg.label}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-500">{r.email}</div>
                    <div className="text-[10px] font-mono text-gray-600 mt-0.5">{r.teamName || "—"} · {r.memberRole || "—"}</div>
                    {r.error && <div className="text-[9px] font-mono text-red-400 mt-1 truncate">{r.error}</div>}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {recipientsData && recipientsData.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
              <span className="text-[10px] font-mono text-gray-500">
                Page {recipientsData.page} of {recipientsData.totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setRecipientPage((p) => Math.max(1, p - 1))}
                  disabled={recipientPage <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30"
                >
                  <ChevronLeft className="h-3 w-3" />
                  PREV
                </button>
                <button
                  onClick={() => setRecipientPage((p) => Math.min(recipientsData.totalPages, p + 1))}
                  disabled={recipientPage >= recipientsData.totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30"
                >
                  NEXT
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
