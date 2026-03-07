// Email Campaign tRPC Router
//
// Provides CRUD + send + retry for bulk email campaigns.
// Permission: bulkActions (SUPER_ADMIN, ADMIN, ORGANIZER).
// JUDGEs and LOGISTICS are blocked from all operations.
//
import { z } from "zod";
import { router, adminProcedure, rateLimitedAdminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { getPermissions } from "@/lib/rbac";
import {
  resolveRecipients,
  dispatchCampaign,
  retryCampaignFailed,
  renderCampaignEmail,
  type CampaignFilters,
} from "@/lib/campaign-email";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function requireBulkActions(role: string) {
  const perms = getPermissions(role as Parameters<typeof getPermissions>[0]);
  if (!perms.bulkActions) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage email campaigns",
    });
  }
}

// Shared Zod schemas
const filtersSchema = z.object({
  statuses: z.array(z.string()).optional(),
  track: z.string().optional(),
  college: z.string().optional(),
  teamIds: z.array(z.string()).optional(),
}).optional();

const audienceTypeSchema = z.enum(["ALL", "LEADERS_ONLY", "CUSTOM"]);

// ═══════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════

export const emailRouter = router({
  // ─────────────────────────────────────────────────────────
  // LIST CAMPAIGNS (inbox view)
  // ─────────────────────────────────────────────────────────
  listCampaigns: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"]).optional(),
        search: z.string().max(200).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const where = {
        ...(input.status && { status: input.status }),
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { subject: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [campaigns, total] = await Promise.all([
        ctx.prisma.emailCampaign.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            name: true,
            subject: true,
            status: true,
            audienceType: true,
            totalRecipients: true,
            totalSent: true,
            totalDelivered: true,
            totalOpened: true,
            totalFailed: true,
            createdAt: true,
            sentAt: true,
            completedAt: true,
            creator: { select: { name: true } },
          },
        }),
        ctx.prisma.emailCampaign.count({ where }),
      ]);

      return {
        campaigns,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // ─────────────────────────────────────────────────────────
  // GET SINGLE CAMPAIGN (detail view)
  // ─────────────────────────────────────────────────────────
  getCampaign: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
        include: {
          creator: { select: { name: true, email: true } },
          recipients: {
            orderBy: { sentAt: "desc" },
            take: 100,
            select: {
              id: true,
              email: true,
              name: true,
              teamName: true,
              memberRole: true,
              status: true,
              sentAt: true,
              deliveredAt: true,
              openedAt: true,
              error: true,
              attempts: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return campaign;
    }),

  // ─────────────────────────────────────────────────────────
  // GET CAMPAIGN RECIPIENTS (paginated)
  // ─────────────────────────────────────────────────────────
  getCampaignRecipients: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
        status: z.enum(["PENDING", "SENT", "DELIVERED", "OPENED", "BOUNCED", "FAILED"]).optional(),
        search: z.string().max(200).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const where = {
        campaignId: input.campaignId,
        ...(input.status && { status: input.status }),
        ...(input.search && {
          OR: [
            { email: { contains: input.search, mode: "insensitive" as const } },
            { name: { contains: input.search, mode: "insensitive" as const } },
            { teamName: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [recipients, total] = await Promise.all([
        ctx.prisma.campaignRecipient.findMany({
          where,
          orderBy: { sentAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.campaignRecipient.count({ where }),
      ]);

      return {
        recipients,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // ─────────────────────────────────────────────────────────
  // CREATE CAMPAIGN (new draft)
  // ─────────────────────────────────────────────────────────
  createCampaign: rateLimitedAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(50000),
        previewText: z.string().max(200).optional(),
        audienceType: audienceTypeSchema.default("ALL"),
        filters: filtersSchema,
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const campaign = await ctx.prisma.emailCampaign.create({
        data: {
          name: input.name,
          subject: input.subject,
          body: input.body,
          previewText: input.previewText,
          audienceType: input.audienceType,
          filters: input.filters ?? undefined,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          createdBy: ctx.admin.id,
        },
      });

      return campaign;
    }),

  // ─────────────────────────────────────────────────────────
  // UPDATE CAMPAIGN (draft only)
  // ─────────────────────────────────────────────────────────
  updateCampaign: rateLimitedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        subject: z.string().min(1).max(500).optional(),
        body: z.string().min(1).max(50000).optional(),
        previewText: z.string().max(200).optional(),
        audienceType: audienceTypeSchema.optional(),
        filters: filtersSchema,
        scheduledAt: z.string().datetime().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft campaigns can be edited",
        });
      }

      const { id, ...data } = input;
      const campaign = await ctx.prisma.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.body !== undefined && { body: data.body }),
          ...(data.previewText !== undefined && { previewText: data.previewText }),
          ...(data.audienceType !== undefined && { audienceType: data.audienceType }),
          ...(data.filters !== undefined && { filters: data.filters ?? undefined }),
          ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        },
      });

      return campaign;
    }),

  // ─────────────────────────────────────────────────────────
  // DELETE CAMPAIGN (draft or failed only)
  // ─────────────────────────────────────────────────────────
  deleteCampaign: rateLimitedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (existing.status !== "DRAFT" && existing.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft or failed campaigns can be deleted",
        });
      }

      // Cascade delete removes CampaignRecipient rows too
      await ctx.prisma.emailCampaign.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─────────────────────────────────────────────────────────
  // PREVIEW RECIPIENTS (dry run — no emails sent)
  // ─────────────────────────────────────────────────────────
  previewRecipients: adminProcedure
    .input(
      z.object({
        audienceType: audienceTypeSchema.default("ALL"),
        filters: filtersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const campaignFilters: CampaignFilters = {
        audienceType: input.audienceType,
        ...(input.filters || {}),
      };

      const recipients = await resolveRecipients(campaignFilters);

      return {
        total: recipients.length,
        capped: recipients.length > 500,
        sample: recipients.slice(0, 20).map((r) => ({
          email: r.email,
          name: r.name,
          teamName: r.teamName,
          memberRole: r.memberRole,
          track: r.track,
          college: r.college,
          shortCode: r.shortCode,
        })),
      };
    }),

  // ─────────────────────────────────────────────────────────
  // SEND CAMPAIGN (dispatch to all resolved recipients)
  // ─────────────────────────────────────────────────────────
  sendCampaign: rateLimitedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      // Verify campaign exists and is DRAFT
      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Campaign is already ${existing.status.toLowerCase()}`,
        });
      }

      // Log activity
      await ctx.prisma.activityLog.create({
        data: {
          action: "CAMPAIGN_SENT",
          entity: "EmailCampaign",
          entityId: input.id,
          metadata: { campaignName: existing.name, adminName: ctx.admin.name },
          ipAddress: ctx.req.headers.get("x-forwarded-for") || "unknown",
          userAgent: ctx.req.headers.get("user-agent") || "unknown",
        },
      });

      // Dispatch (this sends emails synchronously in batches)
      const result = await dispatchCampaign(input.id);

      return {
        success: true,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // DUPLICATE CAMPAIGN (clone as new draft)
  // ─────────────────────────────────────────────────────────
  duplicateCampaign: rateLimitedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const source = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const duplicate = await ctx.prisma.emailCampaign.create({
        data: {
          name: `${source.name} (copy)`,
          subject: source.subject,
          body: source.body,
          previewText: source.previewText,
          audienceType: source.audienceType,
          filters: source.filters ?? undefined,
          createdBy: ctx.admin.id,
        },
      });

      return duplicate;
    }),

  // ─────────────────────────────────────────────────────────
  // RETRY FAILED RECIPIENTS
  // ─────────────────────────────────────────────────────────
  retryFailed: rateLimitedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (existing.status !== "SENT" && existing.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only retry sent or failed campaigns",
        });
      }

      const result = await retryCampaignFailed(input.id);

      return {
        success: true,
        totalRetried: result.totalRetried,
        totalFailed: result.totalFailed,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // GET CAMPAIGN STATS (aggregate delivery metrics)
  // ─────────────────────────────────────────────────────────
  getCampaignStats: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          totalRecipients: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalFailed: true,
          sentAt: true,
          completedAt: true,
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      // Also get live breakdown from recipients
      const breakdown = await ctx.prisma.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaignId: input.id },
        _count: true,
      });

      const statusCounts: Record<string, number> = {};
      for (const b of breakdown) {
        statusCounts[b.status] = b._count;
      }

      return {
        ...campaign,
        breakdown: statusCounts,
      };
    }),

  // ─────────────────────────────────────────────────────────
  // SEND TEST EMAIL (renders with sample data, sends to one address)
  // ─────────────────────────────────────────────────────────
  sendTestEmail: rateLimitedAdminProcedure
    .input(
      z.object({
        toEmail: z.string().email().max(200),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(50000),
        previewText: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      // Render template with sample recipient data
      const sampleRecipient = {
        name: "Aarav Sharma",
        email: input.toEmail,
        teamName: "Team Phoenix",
        memberRole: "LEADER",
        college: "IIT Delhi",
        track: "BuildStorm",
        shortCode: "PHX-42",
      };

      const rendered = renderCampaignEmail(input.body, input.subject, sampleRecipient);

      // Send via Resend directly (single email, no batching needed)
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

      const result = await resend.emails.send({
        from,
        to: input.toEmail,
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
      });

      if (result.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error.message || "Failed to send test email",
        });
      }

      return { success: true };
    }),

  // ─────────────────────────────────────────────────────────
  // SEND BATCH TEST EMAILS (uses Resend batch API for 2+ recipients)
  // ─────────────────────────────────────────────────────────
  sendBatchTestEmail: rateLimitedAdminProcedure
    .input(
      z.object({
        recipients: z.array(z.object({
          email: z.string().email(),
          name: z.string().optional(),
        })).min(1).max(100),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(50000),
        previewText: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireBulkActions(ctx.admin.role);

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

      // Use single send for 1 recipient, batch for 2+
      if (input.recipients.length === 1) {
        const recipient = input.recipients[0];
        const sampleRecipient = {
          name: recipient.name || "Participant",
          email: recipient.email,
          teamName: "Sample Team",
          memberRole: "LEADER",
          college: "Sample College",
          track: "BuildStorm",
          shortCode: "SAMPLE",
        };

        const rendered = renderCampaignEmail(input.body, input.subject, sampleRecipient);

        const result = await resend.emails.send({
          from,
          to: recipient.email,
          subject: rendered.subject,
          html: rendered.html,
        });

        if (result.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error.message || "Failed to send email",
          });
        }

        return { success: true, sent: 1 };
      }

      // Use batch API for 2+ recipients
      const batchEmails = input.recipients.map((recipient) => {
        const sampleRecipient = {
          name: recipient.name || "Participant",
          email: recipient.email,
          teamName: "Sample Team",
          memberRole: "LEADER",
          college: "Sample College",
          track: "BuildStorm",
          shortCode: "SAMPLE",
        };

        const rendered = renderCampaignEmail(input.body, input.subject, sampleRecipient);

        return {
          from,
          to: recipient.email,
          subject: rendered.subject,
          html: rendered.html,
        };
      });

      const result = await resend.batch.send(batchEmails);

      if (result.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error.message || "Failed to send batch emails",
        });
      }

      return { success: true, sent: input.recipients.length };
    }),
});
