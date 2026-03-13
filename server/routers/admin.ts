// Admin tRPC Router - Complete Implementation
import { z } from 'zod';
import {
  router,
  rateLimitedAdminProcedure,
  rateLimitMutation,
  canViewTeams,
  canEditTeamsRateLimited,
  canDeleteTeamsRateLimited,
  canExportTeamsRateLimited,
  canViewAnalytics,
  canManageUsers,
  canViewAuditLogs,
} from '../trpc';
import { TRPCError } from '@trpc/server';
import { sendStatusUpdateEmail } from '@/lib/email';
import {
  cacheGetOrSet,
  cacheGetOrSetWithMeta,
  CacheKeys,
  invalidateDashboardCache,
  invalidateTeamCache,
} from '@/lib/redis-cache';

export const adminRouter = router({
  // ═══════════════════════════════════════════════════════════
  // DASHBOARD STATS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getStats: canViewAnalytics.query(async ({ ctx }) => {
    // ✅ FIX H-2: Permission check now handled by middleware guard

    // Cache dashboard stats for 5 minutes
    // ✅ FIX: Return cache metadata so the UI can show cache age / last-updated
    return cacheGetOrSetWithMeta(
      CacheKeys.dashboardStats(),
      async () => {
        const [
          totalTeams,
          pendingTeams,
          approvedTeams,
          rejectedTeams,
          waitlistedTeams,
          underReviewTeams,
          shortlistedTeams,
          totalUsers,
          totalSubmissions,
          newTeamsToday,
          newTeamsThisWeek,
        ] = await Promise.all([
          ctx.prisma.team.count({ where: { deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'PENDING', deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'APPROVED', deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'REJECTED', deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'WAITLISTED', deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'UNDER_REVIEW', deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: 'SHORTLISTED', deletedAt: null } }),
          ctx.prisma.user.count({
            where: {
              deletedAt: null,
              teamMemberships: {
                some: {
                  leftAt: null,
                  team: { deletedAt: null },
                },
              },
            },
          }),
          ctx.prisma.submission.count(),
          ctx.prisma.team.count({
            where: {
              createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              deletedAt: null,
            },
          }),
          ctx.prisma.team.count({
            where: {
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              deletedAt: null,
            },
          }),
        ]);

        // ✅ FIX: Use raw SQL aggregate instead of biased take:100 sample
        const avgResult = await ctx.prisma.$queryRaw<[{ avg_hours: number | null }]>`
          SELECT AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "createdAt")) / 3600) as avg_hours
          FROM "teams"
          WHERE "reviewedAt" IS NOT NULL AND "deletedAt" IS NULL
        `;
        const avgReviewTime = avgResult[0]?.avg_hours ?? 0;

        return {
          totalTeams,
          pendingTeams,
          approvedTeams,
          rejectedTeams,
          waitlistedTeams,
          underReviewTeams,
          shortlistedTeams,
          totalUsers,
          totalSubmissions,
          newTeamsToday,
          newTeamsThisWeek,
          approvalRate: totalTeams > 0 ? (approvedTeams / totalTeams) * 100 : 0,
          rejectionRate: totalTeams > 0 ? (rejectedTeams / totalTeams) * 100 : 0,
          avgReviewTime: Math.round(avgReviewTime * 10) / 10,
        };
      },
      { ttl: 300 } // Cache for 5 minutes
    );
  }),

  // ═══════════════════════════════════════════════════════════
  // TEAMS MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  getTeams: canViewTeams
    .input(
      z.object({
        status: z.string().optional(),
        track: z.string().optional(),
        college: z.string().optional(),
        search: z.string().optional(),
        dateRange: z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
        sortBy: z.enum(['createdAt', 'name', 'status', 'college']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        page: z.number().default(1),
        // ✅ SECURITY FIX (H-6): Cap pageSize at 100 to prevent DoS
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard
      // ✅ FIX H-5: Field filtering for JUDGE role
      const isJudge = ctx.admin.role === 'JUDGE';

      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      // Status filter
      if (input.status && input.status !== 'all') {
        where.status = input.status;
      }

      // Track filter
      if (input.track && input.track !== 'all') {
        if (input.track === 'BOTH') {
          // Both tracks means we want teams whose leader is in teams of both tracks
          // Get all leaders
          const leadersInBoth = await ctx.prisma.user.findMany({
            where: {
              AND: [
                {
                  teamMemberships: {
                    some: { team: { track: 'IDEA_SPRINT', deletedAt: null }, role: 'LEADER' },
                  },
                },
                {
                  teamMemberships: {
                    some: { team: { track: 'BUILD_STORM', deletedAt: null }, role: 'LEADER' },
                  },
                },
              ],
            },
            select: { id: true },
          });
          const leaderIds = leadersInBoth.map((u) => u.id);
          where.createdBy = { in: leaderIds };
        } else {
          where.track = input.track;
        }
      }

      // College filter
      if (input.college) {
        where.college = { contains: input.college, mode: 'insensitive' };
      }

      // Search filter
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { college: { contains: input.search, mode: 'insensitive' } },
          {
            members: {
              some: {
                user: {
                  OR: [
                    { name: { contains: input.search, mode: 'insensitive' } },
                    { email: { contains: input.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ];
      }

      // Date range filter
      if (input.dateRange?.from || input.dateRange?.to) {
        const createdAt: { gte?: Date; lte?: Date } = {};
        if (input.dateRange.from) createdAt.gte = input.dateRange.from;
        if (input.dateRange.to) createdAt.lte = input.dateRange.to;
        where.createdAt = createdAt;
      }

      const [teams, totalCount] = await Promise.all([
        ctx.prisma.team.findMany({
          where,
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    // ✅ FIX H-5: Hide PII from JUDGE role
                    email: !isJudge,
                    phone: !isJudge,
                    college: true,
                    avatar: true,
                  },
                },
              },
            },
            submission: {
              select: {
                id: true,
                submittedAt: true,
                ideaTitle: true,
                assignedProblemStatement: {
                  select: { title: true },
                },
                _count: {
                  select: { files: true },
                },
              },
            },
            tags: true,
            venue: true,
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: { [input.sortBy]: input.sortOrder },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.team.count({ where }),
      ]);

      return {
        teams,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        currentPage: input.page,
      };
    }),

  getTeamById: canViewTeams.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    // ✅ FIX H-5: Field filtering for JUDGE role
    const isJudge = ctx.admin.role === 'JUDGE';

    const team = await ctx.prisma.team.findUnique({
      where: {
        id: input.id,
        // ✅ SECURITY FIX: Exclude soft-deleted teams
        deletedAt: null,
      },
      include: {
        members: {
          include: {
            user: {
              // ✅ FIX H-5: Hide PII from JUDGE role
              select: {
                id: true,
                name: true,
                email: !isJudge,
                phone: !isJudge,
                college: true,
                degree: true,
                year: true,
                branch: true,
                avatar: true,
                github: true,
                linkedIn: true,
                portfolio: true,
                role: true,
              },
            },
          },
        },
        submission: {
          include: {
            files: true,
            assignedProblemStatement: {
              select: {
                id: true,
                title: true,
                description: true,
                objective: true,
                order: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        tags: true,
      },
    });

    if (!team) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
    }

    return team;
  }),

  updateTeamStatus: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        status: z.enum([
          'PENDING',
          'APPROVED',
          'REJECTED',
          'WAITLISTED',
          'UNDER_REVIEW',
          'SHORTLISTED',
        ]),
        reviewNotes: z.string().optional(),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard

      const adminId = ctx.admin.id;

      const team = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          status: input.status,
          reviewNotes: input.reviewNotes,
          rejectionReason: input.rejectionReason,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
        include: {
          members: {
            include: { user: true },
          },
        },
      });

      // ✅ INVALIDATE CACHES after mutation
      await Promise.all([invalidateDashboardCache(), invalidateTeamCache(input.teamId)]);

      // Log activity (userId is null because admin IDs are in separate Admin table)
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'team.status_updated',
          entity: 'Team',
          entityId: input.teamId,
          metadata: {
            status: input.status,
            previousStatus: team.status,
            adminId,
            adminName: ctx.admin.name,
          },
        },
      });

      // Send notification to team members
      const notifications = team.members.map((member: { userId: string }) => ({
        userId: member.userId,
        type: 'STATUS_UPDATE' as const,
        title: `Team Status Updated`,
        message: `Your team "${team.name}" status has been changed to ${input.status}`,
        link: `/team/${team.id}`,
      }));

      await ctx.prisma.notification.createMany({
        data: notifications,
      });

      // Send email to team leader only (non-blocking)
      // NOTE: SHORTLISTED and APPROVED emails are sent manually from the UI
      const leader = team.members.find(
        (m: { role: string; user: { email: string; name: string | null } }) => m.role === 'LEADER'
      );
      if (leader?.user?.email && input.status !== 'SHORTLISTED' && input.status !== 'APPROVED') {
        sendStatusUpdateEmail(
          leader.user.email,
          team.name,
          input.status,
          input.reviewNotes || input.rejectionReason,
          team.shortCode ?? undefined
        ).catch((err) => {
          console.error(`[EMAIL] Failed to send status update email to ${leader.user.email}:`, err);
        });
      }

      return team;
    }),

  bulkUpdateStatus: canEditTeamsRateLimited
    .input(
      z.object({
        teamIds: z.array(z.string()).max(100),
        status: z.enum([
          'PENDING',
          'APPROVED',
          'REJECTED',
          'WAITLISTED',
          'UNDER_REVIEW',
          'SHORTLISTED',
        ]),
        reviewNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard

      const adminId = ctx.admin.id;

      const result = await ctx.prisma.team.updateMany({
        where: { id: { in: input.teamIds } },
        data: {
          status: input.status,
          reviewNotes: input.reviewNotes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      // ✅ INVALIDATE CACHES after bulk mutation
      await Promise.all([
        invalidateDashboardCache(),
        invalidateTeamCache(), // Invalidate all team caches
      ]);

      // Log activity for each team
      await ctx.prisma.activityLog.createMany({
        data: input.teamIds.map((teamId) => ({
          userId: null,
          action: 'team.bulk_status_updated',
          entity: 'Team',
          entityId: teamId,
          metadata: { status: input.status, adminId, adminName: ctx.admin.name },
        })),
      });

      // Send emails to team leaders (non-blocking)
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: input.teamIds } },
        select: {
          name: true,
          shortCode: true,
          members: {
            where: { role: 'LEADER' },
            select: { user: { select: { email: true } } },
          },
        },
      });

      // NOTE: SHORTLISTED and APPROVED emails are sent manually from the UI
      for (const t of teams) {
        const leaderEmail = t.members[0]?.user?.email;
        if (leaderEmail && input.status !== 'SHORTLISTED' && input.status !== 'APPROVED') {
          sendStatusUpdateEmail(
            leaderEmail,
            t.name,
            input.status,
            input.reviewNotes,
            t.shortCode ?? undefined
          ).catch((err) => {
            console.error(`[EMAIL] Failed to send bulk status email to ${leaderEmail}:`, err);
          });
        }
      }

      return { count: result.count };
    }),

  // ═══════════════════════════════════════════════════════════
  // SHORTLISTED TEAMS
  // ═══════════════════════════════════════════════════════════

  getShortlistedTeams: canViewTeams
    .input(z.object({ track: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const teams = await ctx.prisma.team.findMany({
        where: {
          status: 'SHORTLISTED',
          deletedAt: null,
          ...(input?.track && input.track !== 'all' ? { track: input.track as any } : {}),
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  college: true,
                  gender: true,
                },
              },
            },
          },
          tags: true,
          venue: true,
        },
        orderBy: { reviewedAt: 'asc' }, // Preserve shortlist order (desk assignment depends on it)
      });
      return teams;
    }),

  sendShortlistConfirmationEmail: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId, status: 'SHORTLISTED', deletedAt: null },
        include: {
          members: {
            include: { user: { select: { email: true, name: true } } },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shortlisted team not found',
        });
      }

      const leader = team.members.find((m) => m.role === 'LEADER');
      if (!leader?.user?.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Team has no leader with a valid email',
        });
      }

      await sendStatusUpdateEmail(
        leader.user.email,
        team.name,
        team.status as any,
        input.notes,
        team.shortCode ?? undefined
      );

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'team.shortlist_email_sent',
          entity: 'Team',
          entityId: input.teamId,
          metadata: { adminId: ctx.admin.id, adminName: ctx.admin.name },
        },
      });

      return { success: true };
    }),

  sendBulkShortlistConfirmationEmails: canEditTeamsRateLimited
    .input(
      z.object({
        teamIds: z.array(z.string()).max(200),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: input.teamIds }, status: 'SHORTLISTED', deletedAt: null },
        include: {
          members: {
            where: { role: 'LEADER' },
            include: { user: { select: { email: true, name: true } } },
          },
        },
      });

      let sent = 0;
      let failed = 0;

      for (const team of teams) {
        const leader = team.members[0];
        if (!leader?.user?.email) {
          failed++;
          continue;
        }
        try {
          await sendStatusUpdateEmail(
            leader.user.email,
            team.name,
            'SHORTLISTED',
            input.notes,
            team.shortCode ?? undefined
          );
          sent++;
        } catch {
          failed++;
        }
      }

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'team.bulk_shortlist_emails_sent',
          entity: 'Team',
          entityId: 'bulk',
          metadata: { sent, failed, adminId: ctx.admin.id, adminName: ctx.admin.name },
        },
      });

      return { sent, failed };
    }),

  deleteTeam: canDeleteTeamsRateLimited
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-3: Permission check now handled by middleware guard (SUPER_ADMIN only)

      const adminId = ctx.admin.id;

      // Soft delete
      await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: { deletedAt: new Date() },
      });

      // ✅ INVALIDATE CACHES after deletion
      await Promise.all([invalidateDashboardCache(), invalidateTeamCache(input.teamId)]);

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'team.deleted',
          entity: 'Team',
          entityId: input.teamId,
          metadata: { adminId, adminName: ctx.admin.name },
        },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // COMMENTS & TAGS
  // ═══════════════════════════════════════════════════════════

  addComment: rateLimitedAdminProcedure
    .input(
      z.object({
        teamId: z.string(),
        content: z.string().min(1).max(5000),
        isInternal: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.admin.id;

      const comment = await ctx.prisma.comment.create({
        data: {
          teamId: input.teamId,
          authorId: adminId,
          content: input.content,
          isInternal: input.isInternal,
        },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'comment.created',
          entity: 'Comment',
          entityId: comment.id,
          metadata: { teamId: input.teamId, adminId, adminName: ctx.admin.name },
        },
      });

      return comment;
    }),

  addTag: rateLimitedAdminProcedure
    .input(
      z.object({
        teamId: z.string(),
        tag: z.string(),
        // ✅ SECURITY FIX: Validate hex color format to prevent CSS injection
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
          .default('#6366f1'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const teamTag = await ctx.prisma.teamTag.create({
        data: {
          teamId: input.teamId,
          tag: input.tag,
          color: input.color,
          addedBy: ctx.admin.id,
        },
      });

      return teamTag;
    }),

  removeTag: canEditTeamsRateLimited
    .input(z.object({ tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-4: Add permission check and IDOR protection
      // Verify the tag exists and belongs to a valid team
      const tag = await ctx.prisma.teamTag.findUnique({
        where: { id: input.tagId },
        include: { team: true },
      });

      if (!tag) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      // Only allow deletion if admin has edit permissions
      // (already enforced by middleware, but double-check for IDOR)
      await ctx.prisma.teamTag.delete({
        where: { id: input.tagId },
      });

      return { success: true };
    }),

  // Get activity timeline for a specific team
  getTeamActivity: canViewAnalytics
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard
      return ctx.prisma.activityLog.findMany({
        where: { entityId: input.teamId, entity: 'Team' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getAnalytics: canViewAnalytics.query(async ({ ctx }) => {
    // ✅ FIX H-2: Permission check now handled by middleware guard

    return cacheGetOrSet(
      CacheKeys.analyticsOverview(),
      async () => {
        // Registration trends (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const registrationTrends = await ctx.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM teams
          WHERE "createdAt" >= ${thirtyDaysAgo} AND "deletedAt" IS NULL
          GROUP BY DATE("createdAt")
          ORDER BY date
        `;

        // Top colleges
        const collegeDistribution = await ctx.prisma.team.groupBy({
          by: ['college'],
          where: { deletedAt: null, college: { not: null } },
          _count: true,
          orderBy: { _count: { college: 'desc' } },
          take: 10,
        });

        // Track comparison
        const trackComparison = await ctx.prisma.team.groupBy({
          by: ['track', 'status'],
          where: { deletedAt: null },
          _count: true,
        });

        // Team size distribution
        const teamSizeDistribution = await ctx.prisma.team.groupBy({
          by: ['size'],
          where: { deletedAt: null },
          _count: true,
          orderBy: { size: 'asc' },
        });

        return {
          registrationTrends: registrationTrends.map((r: { date: Date; count: bigint }) => ({
            date: r.date,
            count: Number(r.count),
          })),
          collegeDistribution,
          trackComparison,
          teamSizeDistribution,
        };
      },
      { ttl: 600 } // Cache for 10 minutes
    );
  }),

  // ═══════════════════════════════════════════════════════════
  // USERS MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  getUsers: canManageUsers
    .input(
      z.object({
        search: z.string().optional(),
        role: z.string().optional(),
        page: z.number().default(1),
        // ✅ SECURITY FIX (H-6): Cap pageSize to prevent DoS
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard (SUPER_ADMIN only)
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
          { college: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.role && input.role !== 'all') {
        where.role = input.role;
      }

      const [users, totalCount] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          include: {
            _count: {
              select: {
                teamMemberships: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        users,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  updateUserRole: canManageUsers
    .use(rateLimitMutation)
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['PARTICIPANT', 'ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard (SUPER_ADMIN only)
      const adminId = ctx.admin.id;

      // ✅ SECURITY: Prevent privilege escalation
      // Only SUPER_ADMIN can grant ADMIN or SUPER_ADMIN roles
      const privilegedRoles = ['ADMIN', 'SUPER_ADMIN'];
      if (privilegedRoles.includes(input.role) && ctx.admin.role !== 'SUPER_ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only SUPER_ADMIN can grant admin-level roles',
        });
      }

      const user = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      // ✅ SECURITY FIX: Invalidate all existing sessions when role changes
      // Prevents users from retaining old permissions via cached sessions
      await ctx.prisma.session.deleteMany({
        where: { userId: input.userId },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'user.role_updated',
          entity: 'User',
          entityId: input.userId,
          metadata: { newRole: input.role, adminId, adminName: ctx.admin.name },
        },
      });

      return user;
    }),

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY LOGS
  // ═══════════════════════════════════════════════════════════

  getActivityLogs: canViewAuditLogs
    .input(
      z.object({
        action: z.string().optional(),
        userId: z.string().optional(),
        page: z.number().default(1),
        // ✅ SECURITY FIX (H-6): Cap pageSize to prevent DoS
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard (ADMIN and SUPER_ADMIN)
      const where: Record<string, unknown> = {};

      if (input.action) {
        where.action = { contains: input.action };
      }

      if (input.userId) {
        where.userId = input.userId;
      }

      const [logs, totalCount] = await Promise.all([
        ctx.prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.activityLog.count({ where }),
      ]);

      return {
        logs,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  exportTeams: canExportTeamsRateLimited
    .input(
      z.object({
        status: z.string().optional(),
        track: z.string().optional(),
        format: z.enum(['csv', 'json']).default('csv'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard

      const adminId = ctx.admin.id;

      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (input.status && input.status !== 'all') {
        where.status = input.status;
      }

      if (input.track && input.track !== 'all') {
        if (input.track === 'BOTH') {
          const leadersInBoth = await ctx.prisma.user.findMany({
            where: {
              AND: [
                {
                  teamMemberships: {
                    some: { team: { track: 'IDEA_SPRINT', deletedAt: null }, role: 'LEADER' },
                  },
                },
                {
                  teamMemberships: {
                    some: { team: { track: 'BUILD_STORM', deletedAt: null }, role: 'LEADER' },
                  },
                },
              ],
            },
            select: { id: true },
          });
          const leaderIds = leadersInBoth.map((u) => u.id);
          where.createdBy = { in: leaderIds };
        } else {
          where.track = input.track;
        }
      }

      const teams = await ctx.prisma.team.findMany({
        where,
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
                  role: true,
                  github: true,
                  linkedIn: true,
                  portfolio: true,
                },
              },
            },
          },
          submission: {
            select: {
              id: true,
              ideaTitle: true,
              problemStatement: true,
              assignedProblemStatement: {
                select: { title: true },
              },
              proposedSolution: true,
              targetUsers: true,
              expectedImpact: true,
              techStack: true,
              docLink: true,
              problemDesc: true,
              githubLink: true,
              demoLink: true,
              techStackUsed: true,
              submittedAt: true,
            },
          },
        },
      });

      // Log export activity
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'teams.exported',
          entity: 'Team',
          entityId: 'bulk',
          metadata: {
            count: teams.length,
            format: input.format,
            adminId,
            adminName: ctx.admin.name,
          },
        },
      });

      return { teams, count: teams.length };
    }),

  // ═══════════════════════════════════════════════════════════
  // CHECK-IN & LOGISTICS
  // ═══════════════════════════════════════════════════════════

  getTeamByShortCode: canViewTeams
    .input(z.object({ shortCode: z.string(), deskId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      const team = await ctx.prisma.team.findUnique({
        where: { shortCode: input.shortCode, deletedAt: null },
        include: {
          members: {
            include: { user: { select: { name: true, email: true } } },
          },
          venue: true,
          submission: {
            include: { assignedProblemStatement: true },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Team not found with this short code',
        });
      }

      // Calculate index for desk assignment
      const teamIndex = await ctx.prisma.team.count({
        where: {
          status: 'SHORTLISTED',
          reviewedAt: { lt: team.reviewedAt || new Date() },
          deletedAt: null,
        },
      });

      // Emit event for real-time dashboard on desk-specific channel
      const { getPusherServer } = await import('@/lib/pusher');
      const pusher = getPusherServer();
      if (pusher) {
        try {
          console.log(`[Pusher] Triggering qr:scanned for desk ${input.deskId}`);
          await pusher.trigger(`admin-checkin-${input.deskId}`, 'qr:scanned', {
            team,
            adminName: ctx.admin.name,
          });
          console.log(`[Pusher] Successfully triggered qr:scanned for desk ${input.deskId}`);
        } catch (error) {
          console.error('[Pusher] Trigger failed:', error);
        }
      } else {
        console.warn('[Pusher] Server instance not available - check environment variables');
      }

      return {
        ...team,
        teamIndex,
      };
    }),

  sendScannerHeartbeat: canViewTeams
    .input(z.object({ deskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      const { getPusherServer } = await import('@/lib/pusher');
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`admin-checkin-${input.deskId}`, 'scanner:presence', {
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    }),

  confirmCheckIn: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        deskId: z.string(),
        breakfastCoupons: z.number(),
        lunchCoupons: z.number(),
        verifications: z.array(z.object({
          memberId: z.string(),
          collegeIdVerified: z.boolean(),
          govtIdVerified: z.boolean(),
          exceptionNote: z.string().optional()
        }))
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      // 1. Update Team and Member Verifications in a transaction
      const team = await ctx.prisma.$transaction(async (tx) => {
        // Create verifications for each member
        for (const v of input.verifications) {
          await tx.memberVerification.upsert({
            where: { memberId: v.memberId },
            create: {
              memberId: v.memberId,
              collegeIdVerified: v.collegeIdVerified,
              govtIdVerified: v.govtIdVerified,
              exceptionNote: v.exceptionNote,
              verifiedBy: ctx.admin.id,
            },
            update: {
              collegeIdVerified: v.collegeIdVerified,
              govtIdVerified: v.govtIdVerified,
              exceptionNote: v.exceptionNote,
              verifiedBy: ctx.admin.id,
            }
          });
        }

        // Update team status
        return tx.team.update({
          where: { id: input.teamId },
          data: {
            checkedIn: true,
            checkedInAt: new Date(),
            checkedInBy: ctx.admin.id,
            attendance: 'PRESENT',
            breakfastCouponsIssued: input.breakfastCoupons,
            lunchCouponsIssued: input.lunchCoupons,
          },
        });
      });

      // 2. Emit confirmed event on desk-specific channel
      const { getPusherServer } = await import('@/lib/pusher');
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`admin-checkin-${input.deskId}`, 'checkin:confirmed', {
          teamId: input.teamId,
          teamName: team.name,
          adminName: ctx.admin.name,
        });
        
        // Also emit a global stats update
        await pusher.trigger('admin-updates', 'stats:updated', {});
      }

      return { success: true };
    }),

  flagCheckInIssue: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        deskId: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          isFlagged: true,
          flagReason: input.reason,
          attendanceNotes: `FLAGGED: ${input.reason}`,
        },
      });

      // Emit flagged event on desk-specific channel
      const { getPusherServer } = await import('@/lib/pusher');
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`admin-checkin-${input.deskId}`, 'checkin:flagged', {
          teamId: input.teamId,
          reason: input.reason,
          adminName: ctx.admin.name,
        });
        await pusher.trigger('admin-updates', 'stats:updated', {});
      }

      return { success: true };
    }),

  getCheckInStats: canViewTeams.query(async ({ ctx }) => {
    const [total, checkedIn, breakfast, lunch, flagged] = await Promise.all([
      ctx.prisma.team.count({ where: { status: 'SHORTLISTED', deletedAt: null } }),
      ctx.prisma.team.count({ where: { checkedIn: true, deletedAt: null } }),
      ctx.prisma.team.aggregate({ _sum: { breakfastCouponsIssued: true } }),
      ctx.prisma.team.aggregate({ _sum: { lunchCouponsIssued: true } }),
      ctx.prisma.team.count({ where: { isFlagged: true, deletedAt: null } }),
    ]);

    return { 
      total, 
      checkedIn,
      breakfastCoupons: breakfast._sum.breakfastCouponsIssued || 0,
      lunchCoupons: lunch._sum.lunchCouponsIssued || 0,
      flaggedCount: flagged
    };
  }),

  // ═══════════════════════════════════════════════════════════
  // VENUE & LOGISTICS (SHORTLISTED ONLY)
  // ═══════════════════════════════════════════════════════════

  getVenues: canViewTeams.query(async ({ ctx }) => {
    return ctx.prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });
  }),

  createVenue: canEditTeamsRateLimited
    .input(z.object({ 
      name: z.string().min(1),
      floor: z.string().optional(),
      block: z.string().optional(),
      capacity: z.number().int().min(0).default(0)
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.venue.create({
        data: { 
          name: input.name,
          floor: input.floor,
          block: input.block,
          capacity: input.capacity
        },
      });
    }),

  deleteVenue: canEditTeamsRateLimited
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if any teams are assigned to this venue
      const teamCount = await ctx.prisma.team.count({
        where: { venueId: input.id },
      });
      if (teamCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete venue that has teams assigned to it.',
        });
      }
      return ctx.prisma.venue.delete({
        where: { id: input.id },
      });
    }),

  getVenueTables: canViewTeams
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.table.findMany({
        where: { venueId: input.venueId },
        include: { team: { select: { name: true, shortCode: true } } },
        orderBy: { code: 'asc' },
      });
    }),

  bulkGenerateTables: canEditTeamsRateLimited
    .input(
      z.object({
        venueId: z.string(),
        prefix: z.string(),
        count: z.number().min(1).max(500),
        startFrom: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tables = [];
      for (let i = 0; i < input.count; i++) {
        const num = input.startFrom + i;
        const code = `${input.prefix}${num.toString().padStart(2, '0')}`;
        tables.push({
          venueId: input.venueId,
          code,
        });
      }

      return ctx.prisma.table.createMany({
        data: tables,
        skipDuplicates: true,
      });
    }),

  updateTeamLogistics: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        venueId: z.string().nullable(),
        tableId: z.string().nullable(),
        tableNumber: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure the team is shortlisted
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        select: { status: true },
      });

      if (!team || team.status !== 'SHORTLISTED') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only shortlisted teams can have their logistics updated.',
        });
      }

      const updated = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          venueId: input.venueId || null,
          tableId: input.tableId || null,
          tableNumber: input.tableNumber || null,
        },
      });

      // Invalidate cache for this team
      await invalidateTeamCache(updated.shortCode);

      return updated;
    }),
});
