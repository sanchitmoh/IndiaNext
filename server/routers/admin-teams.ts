// ══════════════════════════════════════════════════════════════
// ⚠️  DEPRECATED — This router is NOT mounted in _app.ts.
//     All team-management procedures live in admin.ts:
//       getTeams, getTeamById, updateTeamStatus, bulkUpdateStatus,
//       deleteTeam, addComment, addTag, removeTag, getTeamActivity,
//       getActivityLogs, exportTeams.
//     This file is kept for reference only. Do NOT import it.
// ══════════════════════════════════════════════════════════════
//
// Admin Teams Management Router (UNUSED)
import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { hasPermission, logAdminAction, type Permission } from '@/lib/auth-admin';
import { sendStatusUpdateEmail } from '@/lib/email';
import type { Prisma } from '@prisma/client/edge';

// ✅ SECURITY FIX (C-1): Helper to check permission via ctx.admin (from adminProcedure)
// instead of re-reading cookies with requirePermission()
function checkPermission(adminRole: string, permission: Permission): void {
  if (!hasPermission(adminRole as any, permission)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Insufficient permissions: ${permission} required`,
    });
  }
}

// ═══════════════════════════════════════════════════════════
// INPUT SCHEMAS
// ═══════════════════════════════════════════════════════════

const TeamFiltersSchema = z.object({
  search: z.string().optional(),
  track: z.array(z.enum(['IDEA_SPRINT', 'BUILD_STORM'])).optional(),
  status: z
    .array(
      z.enum([
        'DRAFT',
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'WAITLISTED',
        'WITHDRAWN',
      ])
    )
    .optional(),
  college: z.array(z.string()).optional(),
  dateRange: z
    .object({
      from: z.date(),
      to: z.date(),
    })
    .optional(),
  teamSize: z.array(z.number()).optional(),
  hasSubmission: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(50),
  sortBy: z.enum(['createdAt', 'name', 'status', 'college', 'size']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ═══════════════════════════════════════════════════════════
// ADMIN TEAMS ROUTER
// ═══════════════════════════════════════════════════════════

export const adminTeamsRouter = router({
  // ═══════════════════════════════════════════════════════════
  // GET TEAMS LIST (with pagination, filters, sorting)
  // ═══════════════════════════════════════════════════════════

  list: adminProcedure
    .input(
      z.object({
        filters: TeamFiltersSchema.optional(),
        pagination: PaginationSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ SECURITY FIX (C-1): Use ctx.admin from adminProcedure
      checkPermission(ctx.admin.role, 'VIEW_ALL_TEAMS');

      const { filters = {}, pagination } = input;
      const {
        page = 1,
        pageSize = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination ?? {};

      // Build where clause
      const where: Prisma.TeamWhereInput = {
        deletedAt: null, // Exclude soft-deleted teams
      };

      // Search filter
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { college: { contains: filters.search, mode: 'insensitive' } },
          {
            members: {
              some: { user: { email: { contains: filters.search, mode: 'insensitive' } } },
            },
          },
          {
            members: {
              some: { user: { name: { contains: filters.search, mode: 'insensitive' } } },
            },
          },
        ];
      }

      // Track filter
      if (filters.track && filters.track.length > 0) {
        where.track = { in: filters.track };
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      // College filter
      if (filters.college && filters.college.length > 0) {
        where.college = { in: filters.college };
      }

      // Date range filter
      if (filters.dateRange) {
        where.createdAt = {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to,
        };
      }

      // Team size filter
      if (filters.teamSize && filters.teamSize.length > 0) {
        where.size = { in: filters.teamSize };
      }

      // Has submission filter
      if (filters.hasSubmission !== undefined) {
        if (filters.hasSubmission) {
          where.submission = { isNot: null };
        } else {
          where.submission = { is: null };
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          some: {
            tag: { in: filters.tags },
          },
        };
      }

      // Build orderBy
      const orderBy: Prisma.TeamOrderByWithRelationInput = {};
      switch (sortBy) {
        case 'name':
          orderBy.name = sortOrder;
          break;
        case 'status':
          orderBy.status = sortOrder;
          break;
        case 'college':
          orderBy.college = sortOrder;
          break;
        case 'size':
          orderBy.size = sortOrder;
          break;
        case 'createdAt':
        default:
          orderBy.createdAt = sortOrder;
      }

      // Execute queries
      const [teams, totalCount] = await Promise.all([
        ctx.prisma.team.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    college: true,
                    degree: true,
                  },
                },
              },
              where: {
                role: 'LEADER',
              },
            },
            tags: true,
            submission: {
              select: {
                id: true,
                submittedAt: true,
              },
            },
            _count: {
              select: {
                members: true,
                comments: true,
              },
            },
          },
        }),
        ctx.prisma.team.count({ where }),
      ]);

      return {
        teams: teams.map((team) => ({
          id: team.id,
          shortCode: team.shortCode,
          name: team.name,
          track: team.track,
          status: team.status,
          college: team.college,
          size: team.size,
          leader: team.members[0]?.user || null,
          memberCount: team._count.members,
          commentCount: team._count.comments,
          hasSubmission: !!team.submission,
          submittedAt: team.submission?.submittedAt || null,
          tags: team.tags.map((t) => t.tag),
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        })),
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET TEAM DETAILS
  // ═══════════════════════════════════════════════════════════

  getById: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'VIEW_ALL_TEAMS');

      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  college: true,
                  degree: true,
                  year: true,
                  branch: true,
                  linkedIn: true,
                  github: true,
                  portfolio: true,
                },
              },
            },
            orderBy: {
              role: 'asc', // LEADER first
            },
          },
          submission: true,
          comments: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          tags: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team not found',
        });
      }

      return team;
    }),

  // ═══════════════════════════════════════════════════════════
  // APPROVE TEAM
  // ═══════════════════════════════════════════════════════════

  approve: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        notes: z.string().optional(),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'APPROVE_TEAMS');
      const adminUser = ctx.admin;

      // Get team with leader info
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: {
          members: {
            where: { role: 'LEADER' },
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team not found',
        });
      }

      // Update team status
      const updatedTeam = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminUser.id,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        },
      });

      // Log action
      await logAdminAction({
        userId: adminUser.id,
        action: 'team.approved',
        entity: 'Team',
        entityId: input.teamId,
        metadata: {
          teamName: team.name,
          notes: input.notes,
        },
      });

      // Send email notification
      if (input.sendEmail && team.members[0]) {
        const leader = team.members[0].user;
        try {
          await sendStatusUpdateEmail(
            leader.email,
            team.name,
            'APPROVED',
            input.notes,
            team.shortCode ?? undefined
          );
        } catch (error) {
          console.error('[Admin] Failed to send approval email:', error);
          // Don't fail the approval if email fails
        }
      }

      return updatedTeam;
    }),

  // ═══════════════════════════════════════════════════════════
  // REJECT TEAM
  // ═══════════════════════════════════════════════════════════

  reject: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'REJECT_TEAMS');
      const adminUser = ctx.admin;

      // Get team with leader info
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: {
          members: {
            where: { role: 'LEADER' },
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team not found',
        });
      }

      // Update team status
      const updatedTeam = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminUser.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        },
      });

      // Log action
      await logAdminAction({
        userId: adminUser.id,
        action: 'team.rejected',
        entity: 'Team',
        entityId: input.teamId,
        metadata: {
          teamName: team.name,
          reason: input.reason,
        },
      });

      // Send email notification
      if (input.sendEmail && team.members[0]) {
        const leader = team.members[0].user;
        try {
          await sendStatusUpdateEmail(
            leader.email,
            team.name,
            'REJECTED',
            input.reason,
            team.shortCode ?? undefined
          );
        } catch (error) {
          console.error('[Admin] Failed to send rejection email:', error);
        }
      }

      return updatedTeam;
    }),

  // ═══════════════════════════════════════════════════════════
  // BULK APPROVE
  // ═══════════════════════════════════════════════════════════

  bulkApprove: adminProcedure
    .input(
      z.object({
        teamIds: z.array(z.string()).min(1).max(100),
        notes: z.string().optional(),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'APPROVE_TEAMS');
      const adminUser = ctx.admin;

      // Get teams with leader info
      const teams = await ctx.prisma.team.findMany({
        where: {
          id: { in: input.teamIds },
        },
        include: {
          members: {
            where: { role: 'LEADER' },
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Update all teams
      await ctx.prisma.team.updateMany({
        where: {
          id: { in: input.teamIds },
        },
        data: {
          status: 'APPROVED',
          reviewedBy: adminUser.id,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        },
      });

      // Log actions
      for (const team of teams) {
        await logAdminAction({
          userId: adminUser.id,
          action: 'team.approved',
          entity: 'Team',
          entityId: team.id,
          metadata: {
            teamName: team.name,
            notes: input.notes,
            bulkAction: true,
          },
        });
      }

      // Send emails
      if (input.sendEmail) {
        const teamsWithLeaders = teams.filter((team) => team.members[0]);
        const emailPromises = teamsWithLeaders.map((team) => {
          const leader = team.members[0].user;
          return sendStatusUpdateEmail(
            leader.email,
            team.name,
            'APPROVED',
            input.notes,
            team.shortCode ?? undefined
          ).catch((error) => {
            console.error(`[Admin] Failed to send approval email to ${leader.email}:`, error);
          });
        });

        await Promise.allSettled(emailPromises);
      }

      return {
        success: true,
        count: teams.length,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BULK REJECT
  // ═══════════════════════════════════════════════════════════

  bulkReject: adminProcedure
    .input(
      z.object({
        teamIds: z.array(z.string()).min(1).max(100),
        reason: z.string().min(10),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'REJECT_TEAMS');
      const adminUser = ctx.admin;

      // Get teams with leader info
      const teams = await ctx.prisma.team.findMany({
        where: {
          id: { in: input.teamIds },
        },
        include: {
          members: {
            where: { role: 'LEADER' },
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Update all teams
      await ctx.prisma.team.updateMany({
        where: {
          id: { in: input.teamIds },
        },
        data: {
          status: 'REJECTED',
          reviewedBy: adminUser.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        },
      });

      // Log actions
      for (const team of teams) {
        await logAdminAction({
          userId: adminUser.id,
          action: 'team.rejected',
          entity: 'Team',
          entityId: team.id,
          metadata: {
            teamName: team.name,
            reason: input.reason,
            bulkAction: true,
          },
        });
      }

      // Send emails
      if (input.sendEmail) {
        const teamsWithLeaders = teams.filter((team) => team.members[0]);
        const emailPromises = teamsWithLeaders.map((team) => {
          const leader = team.members[0].user;
          return sendStatusUpdateEmail(
            leader.email,
            team.name,
            'REJECTED',
            input.reason,
            team.shortCode ?? undefined
          ).catch((error) => {
            console.error(`[Admin] Failed to send rejection email to ${leader.email}:`, error);
          });
        });

        await Promise.allSettled(emailPromises);
      }

      return {
        success: true,
        count: teams.length,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // ADD COMMENT
  // ═══════════════════════════════════════════════════════════

  addComment: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        content: z.string().min(1).max(5000),
        isInternal: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'ADD_COMMENTS');
      const adminUser = ctx.admin;

      const comment = await ctx.prisma.comment.create({
        data: {
          teamId: input.teamId,
          authorId: adminUser.id,
          content: input.content,
          isInternal: input.isInternal,
        },
      });

      // Log action
      await logAdminAction({
        userId: adminUser.id,
        action: 'comment.created',
        entity: 'Comment',
        entityId: comment.id,
        metadata: {
          teamId: input.teamId,
          isInternal: input.isInternal,
        },
      });

      return comment;
    }),

  // ═══════════════════════════════════════════════════════════
  // ADD TAG
  // ═══════════════════════════════════════════════════════════

  addTag: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        tag: z.string().min(1).max(50),
        color: z
          .string()
          .regex(/^#[0-9A-F]{6}$/i)
          .default('#6366f1'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'EDIT_TEAMS');
      const adminUser = ctx.admin;

      const tag = await ctx.prisma.teamTag.create({
        data: {
          teamId: input.teamId,
          tag: input.tag,
          color: input.color,
          addedBy: adminUser.id,
        },
      });

      return tag;
    }),

  // ═══════════════════════════════════════════════════════════
  // REMOVE TAG
  // ═══════════════════════════════════════════════════════════

  removeTag: adminProcedure
    .input(
      z.object({
        tagId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'EDIT_TEAMS');

      await ctx.prisma.teamTag.delete({
        where: { id: input.tagId },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET ACTIVITY TIMELINE
  // ═══════════════════════════════════════════════════════════

  getActivity: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      checkPermission(ctx.admin.role, 'VIEW_ALL_TEAMS');

      const activities = await ctx.prisma.activityLog.findMany({
        where: {
          entityId: input.teamId,
          entity: 'Team',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });

      return activities;
    }),
});
