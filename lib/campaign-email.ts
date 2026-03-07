// ═══════════════════════════════════════════════════════════
// Campaign Email Dispatch Engine
// ═══════════════════════════════════════════════════════════
// Handles resolving recipients from filters, template variable
// substitution, and batched dispatch via Resend.
// ═══════════════════════════════════════════════════════════

import { Resend } from "resend";
import { prisma } from "./prisma";
import type { AudienceType, MemberRole, Prisma } from "@prisma/client/edge";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface CampaignFilters {
  audienceType: AudienceType;
  statuses?: string[];
  track?: string;
  college?: string;
}

export interface ResolvedRecipient {
  userId: string;
  email: string;
  name: string;
  teamName: string;
  memberRole: MemberRole;
  college: string;
  track: string;
  shortCode: string;
}

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CAMPAIGN_CONFIG = {
  batchSize: 50,        // emails per batch (Resend-safe)
  batchDelayMs: 1500,   // delay between batches
  maxRetries: 2,        // retries per email
  retryDelayMs: 500,    // delay between retries
  maxRecipients: 500,   // cap per campaign
} as const;

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ═══════════════════════════════════════════════════════════
// RECIPIENT RESOLUTION
// ═══════════════════════════════════════════════════════════

/**
 * Resolve recipients from campaign filters. Runs at send time
 * to snapshot the current state of teams/members.
 */
export async function resolveRecipients(
  filters: CampaignFilters
): Promise<ResolvedRecipient[]> {
  const teamWhere: Prisma.TeamWhereInput = {
    deletedAt: null,
    ...(filters.statuses && filters.statuses.length > 0
      ? { status: { in: filters.statuses as Prisma.EnumRegistrationStatusFilter["in"] } }
      : { status: "APPROVED" }),
    ...(filters.track && { track: filters.track as Prisma.EnumTrackFilter["equals"] }),
    ...(filters.college && {
      college: { contains: filters.college, mode: "insensitive" as const },
    }),
  };

  const memberWhere: Prisma.TeamMemberWhereInput = {
    team: teamWhere,
    leftAt: null,
    user: { deletedAt: null },
    ...(filters.audienceType === "LEADERS_ONLY" && { role: "LEADER" as MemberRole }),
  };

  const members = await prisma.teamMember.findMany({
    where: memberWhere,
    select: {
      userId: true,
      role: true,
      user: { select: { email: true, name: true, college: true } },
      team: { select: { name: true, track: true, shortCode: true } },
    },
  });

  // Deduplicate by email (a user could theoretically appear in multiple contexts)
  const seen = new Set<string>();
  const recipients: ResolvedRecipient[] = [];

  for (const m of members) {
    if (seen.has(m.user.email)) continue;
    seen.add(m.user.email);

    recipients.push({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      teamName: m.team.name,
      memberRole: m.role,
      college: m.user.college || "",
      track: m.team.track,
      shortCode: m.team.shortCode || "",
    });
  }

  return recipients;
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE VARIABLE SUBSTITUTION
// ═══════════════════════════════════════════════════════════

/**
 * Replace {{variable}} placeholders with recipient-specific values.
 * Only known variables are replaced — unknown ones are left as-is.
 */
export function renderCampaignEmail(
  bodyHtml: string,
  subjectTemplate: string,
  recipient: {
    name?: string;
    email: string;
    teamName?: string;
    memberRole?: string;
    college?: string;
    track?: string;
    shortCode?: string;
  }
): { html: string; subject: string } {
  const variables: Record<string, string> = {
    name: recipient.name || "Participant",
    email: recipient.email,
    team: recipient.teamName || "",
    track: recipient.track || "",
    shortCode: recipient.shortCode || "",
    role: recipient.memberRole || "",
    college: recipient.college || "",
  };

  let html = bodyHtml;
  let subject = subjectTemplate;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    html = html.replace(pattern, escapeHtml(value));
    subject = subject.replace(pattern, value);
  }

  return { html, subject };
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ═══════════════════════════════════════════════════════════
// CAMPAIGN DISPATCH
// ═══════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dispatch a campaign: resolve recipients, create CampaignRecipient rows,
 * then send in batches with retry. Updates stats on the campaign as it goes.
 *
 * This function is designed to be called from the tRPC mutation while the
 * request is still open (not a background job). For large recipient lists
 * consider moving to a queue system.
 */
export async function dispatchCampaign(campaignId: string): Promise<{
  totalSent: number;
  totalFailed: number;
}> {
  // 1. Lock campaign → SENDING (atomic: only DRAFT can transition)
  const campaign = await prisma.emailCampaign.update({
    where: { id: campaignId, status: "DRAFT" },
    data: { status: "SENDING", sentAt: new Date() },
  });

  if (!campaign) {
    throw new Error("Campaign not found or not in DRAFT status");
  }

  // 2. Resolve & snapshot recipients
  const filters: CampaignFilters = {
    audienceType: campaign.audienceType,
    ...(campaign.filters as Record<string, unknown> || {}),
  };
  const resolved = await resolveRecipients(filters);

  if (resolved.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENT", completedAt: new Date(), totalRecipients: 0 },
    });
    return { totalSent: 0, totalFailed: 0 };
  }

  // Cap recipients
  const capped = resolved.slice(0, CAMPAIGN_CONFIG.maxRecipients);

  // Insert recipient rows (skipDuplicates for idempotency)
  await prisma.campaignRecipient.createMany({
    data: capped.map((r) => ({
      campaignId,
      userId: r.userId,
      email: r.email,
      name: r.name,
      teamName: r.teamName,
      memberRole: r.memberRole,
    })),
    skipDuplicates: true,
  });

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { totalRecipients: capped.length },
  });

  // 3. Send in batches
  const pending = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
  });

  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < pending.length; i += CAMPAIGN_CONFIG.batchSize) {
    const batch = pending.slice(i, i + CAMPAIGN_CONFIG.batchSize);

    await Promise.allSettled(
      batch.map(async (recipient) => {
        const rendered = renderCampaignEmail(campaign.body, campaign.subject, {
          name: recipient.name || undefined,
          email: recipient.email,
          teamName: recipient.teamName || undefined,
          memberRole: recipient.memberRole || undefined,
        });

        let lastError: string | null = null;
        for (let attempt = 0; attempt <= CAMPAIGN_CONFIG.maxRetries; attempt++) {
          try {
            const result = await getResend().emails.send({
              from: EMAIL_FROM,
              to: recipient.email,
              subject: rendered.subject,
              html: rendered.html,
            });

            if (result.error) {
              throw new Error(result.error.message || "Resend error");
            }

            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: "SENT",
                messageId: result.data?.id,
                sentAt: new Date(),
                attempts: attempt + 1,
              },
            });
            totalSent++;
            return;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < CAMPAIGN_CONFIG.maxRetries) {
              await sleep(CAMPAIGN_CONFIG.retryDelayMs * (attempt + 1));
            }
          }
        }

        // All retries exhausted
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            error: lastError,
            attempts: CAMPAIGN_CONFIG.maxRetries + 1,
          },
        });
        totalFailed++;
      })
    );

    // Update running stats after each batch
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { totalSent, totalFailed },
    });

    // Delay between batches (skip after last batch)
    if (i + CAMPAIGN_CONFIG.batchSize < pending.length) {
      await sleep(CAMPAIGN_CONFIG.batchDelayMs);
    }
  }

  // 4. Mark complete
  const finalStatus = totalFailed > 0 && totalSent === 0 ? "FAILED" : "SENT";
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus as "SENT" | "FAILED",
      completedAt: new Date(),
      totalSent,
      totalFailed,
    },
  });

  return { totalSent, totalFailed };
}

/**
 * Retry only FAILED/BOUNCED recipients for a given campaign.
 */
export async function retryCampaignFailed(campaignId: string): Promise<{
  totalRetried: number;
  totalFailed: number;
}> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const failed = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      status: { in: ["FAILED", "BOUNCED"] },
    },
  });

  if (failed.length === 0) {
    return { totalRetried: 0, totalFailed: 0 };
  }

  let totalRetried = 0;
  let totalFailed = 0;

  for (const recipient of failed) {
    const rendered = renderCampaignEmail(campaign.body, campaign.subject, {
      name: recipient.name || undefined,
      email: recipient.email,
      teamName: recipient.teamName || undefined,
      memberRole: recipient.memberRole || undefined,
    });

    try {
      const result = await getResend().emails.send({
        from: EMAIL_FROM,
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
      });

      if (result.error) {
        throw new Error(result.error.message || "Resend error");
      }

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          messageId: result.data?.id,
          sentAt: new Date(),
          error: null,
          attempts: { increment: 1 },
        },
      });
      totalRetried++;
    } catch (err) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          error: err instanceof Error ? err.message : String(err),
          attempts: { increment: 1 },
        },
      });
      totalFailed++;
    }
  }

  // Update campaign stats
  const stats = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: true,
  });

  const statMap: Record<string, number> = {};
  for (const s of stats) {
    statMap[s.status] = s._count;
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      totalSent: (statMap["SENT"] || 0) + (statMap["DELIVERED"] || 0) + (statMap["OPENED"] || 0),
      totalDelivered: (statMap["DELIVERED"] || 0) + (statMap["OPENED"] || 0),
      totalOpened: statMap["OPENED"] || 0,
      totalFailed: (statMap["FAILED"] || 0) + (statMap["BOUNCED"] || 0),
    },
  });

  return { totalRetried, totalFailed };
}
