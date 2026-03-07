// Email Campaigns — Inbox / List View
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Search,
  Mail,
  Send,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";

const statusConfig: Record<CampaignStatus, { label: string; bg: string; text: string; icon: typeof Mail }> = {
  DRAFT: { label: "DRAFT", bg: "bg-gray-500/15", text: "text-gray-400", icon: FileText },
  SCHEDULED: { label: "SCHEDULED", bg: "bg-blue-500/15", text: "text-blue-400", icon: Clock },
  SENDING: { label: "SENDING", bg: "bg-cyan-500/15", text: "text-cyan-400", icon: Loader2 },
  SENT: { label: "SENT", bg: "bg-emerald-500/15", text: "text-emerald-400", icon: Send },
  FAILED: { label: "FAILED", bg: "bg-red-500/15", text: "text-red-400", icon: AlertTriangle },
};

export default function EmailCampaignsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceTimer[0]) clearTimeout(debounceTimer[0]);
    debounceTimer[1](
      setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, 300)
    );
  };

  const { data, isLoading, refetch } = trpc.email.listCampaigns.useQuery({
    page,
    pageSize: 20,
    ...(statusFilter && { status: statusFilter }),
    ...(debouncedSearch && { search: debouncedSearch }),
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">EMAIL_CAMPAIGNS</h1>
          <p className="text-[11px] font-mono text-gray-500 mt-1">
            {data?.total || 0} campaigns
            {statusFilter && (
              <span className="text-orange-400 ml-2">
                • Filtered: {statusFilter}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            REFRESH
          </button>
          <Link
            href="/admin/emails/compose"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-white bg-orange-500 rounded-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            NEW CAMPAIGN
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[11px] font-mono bg-[#0A0A0A] border border-white/[0.06] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30 transition-colors"
          />
        </div>
        {/* Status Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all ${
              statusFilter === ""
                ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                : "bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-gray-300"
            }`}
          >
            ALL
          </button>
          {(Object.keys(statusConfig) as CampaignStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-all ${
                statusFilter === s
                  ? `${statusConfig[s].bg} ${statusConfig[s].text} border-current/20`
                  : "bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/[0.06] rounded w-2/3 mb-2" />
              <div className="h-3 bg-white/[0.06] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : data?.campaigns.length === 0 ? (
        <div className="text-center py-16 border border-white/[0.06] rounded-lg bg-[#0A0A0A]">
          <Mail className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-mono text-gray-500">No campaigns found</p>
          <Link
            href="/admin/emails/compose"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-[11px] font-mono font-bold tracking-wider text-white bg-orange-500 rounded-md hover:bg-orange-600 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            CREATE YOUR FIRST CAMPAIGN
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.campaigns.map((campaign) => {
            const status = campaign.status as CampaignStatus;
            const cfg = statusConfig[status] || statusConfig.DRAFT;
            const StatusIcon = cfg.icon;
            return (
              <Link
                key={campaign.id}
                href={`/admin/emails/${campaign.id}`}
                className="block bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 hover:border-orange-500/20 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider rounded ${cfg.bg} ${cfg.text}`}>
                        <StatusIcon className={`h-3 w-3 ${status === "SENDING" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600 uppercase">
                        {campaign.audienceType?.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="text-sm font-mono font-bold text-white tracking-wider truncate group-hover:text-orange-400 transition-colors">
                      {campaign.name}
                    </h3>
                    <p className="text-[11px] font-mono text-gray-500 truncate mt-0.5">
                      Subject: {campaign.subject}
                    </p>
                  </div>
                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-gray-500 shrink-0">
                    {status !== "DRAFT" && (
                      <>
                        <div className="text-center">
                          <div className="text-white font-bold">{campaign.totalRecipients}</div>
                          <div className="text-gray-600">TOTAL</div>
                        </div>
                        <div className="text-center">
                          <div className="text-emerald-400 font-bold">{campaign.totalSent}</div>
                          <div className="text-gray-600">SENT</div>
                        </div>
                        {(campaign.totalFailed ?? 0) > 0 && (
                          <div className="text-center">
                            <div className="text-red-400 font-bold">{campaign.totalFailed}</div>
                            <div className="text-gray-600">FAILED</div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="text-right">
                      <div className="text-gray-400">
                        {new Date(campaign.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                      <div className="text-gray-600">
                        {campaign.creator?.name || "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] font-mono text-gray-500">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30"
            >
              <ChevronLeft className="h-3 w-3" />
              PREV
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-30"
            >
              NEXT
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
