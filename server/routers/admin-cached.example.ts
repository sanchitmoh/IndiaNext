/**
 * Example: Admin Router with Caching
 *
 * This shows how to add caching to the existing admin router.
 * Copy the relevant parts to your actual admin.ts file.
 */

import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { sendStatusUpdateEmail } from '@/lib/email';
import {
  cacheGetOrSet,
  CacheKeys,
  invalidateDashboardCache,
  invalidateTeamCache,
} from '@/lib/redis-cache';

export const adminRouterCached = router({
  // ═══════════════════════════════════════════════════════════
  // DASHBOARD STATS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getStats: adminProcedure.query(async ({ ctx }) => {
    // Cache dashboard stats for 5 minutes
    return cacheGetOrSet(
      CacheKeys.dashboardStats(),
      async () => {
        const [
          totalTeams,
          pendingTeams,
          approvedTeams,
          rejectedTeams,
          waitlistedTeams,
          underReviewTeams,
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
          ctx.prisma.user.count({ where: { deletedAt: null } }),
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

        // Calculate average review time
        const reviewedTeams = await ctx.prisma.team.findMany({
          where: {
            reviewedAt: { not: null },
            deletedAt: null,
          },
          select: {
            createdAt: true,
            reviewedAt: true,
          },
          take: 100,
        });

        const avgReviewTime =
          reviewedTeams.length > 0
            ? reviewedTeams.reduce(
                (acc: number, team: { createdAt: Date; reviewedAt: Date | null }) => {
                  const diff = team.reviewedAt!.getTime() - team.createdAt.getTime();
                  return acc + diff / (1000 * 60 * 60); // Convert to hours
                },
                0
              ) / reviewedTeams.length
            : 0;

        return {
          totalTeams,
          pendingTeams,
          approvedTeams,
          rejectedTeams,
          waitlistedTeams,
          underReviewTeams,
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
  // TEAMS MANAGEMENT (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getTeams: adminProcedure
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
        pageSize: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // Create cache key from filters
      const filterKey = JSON.stringify({
        status: input.status,
        track: input.track,
        college: input.college,
        search: input.search,
        dateRange: input.dateRange,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
        page: input.page,
        pageSize: input.pageSize,
      });

      return cacheGetOrSet(
        CacheKeys.teamsList(filterKey),
        async () => {
          const where: Record<string, unknown> = {
            deletedAt: null,
          };

          // Status filter
          if (input.status && input.status !== 'all') {
            where.status = input.status;
          }

          // Track filter
          if (input.track && input.track !== 'all') {
            where.track = input.track;
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
                        email: true,
                        phone: true,
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
                    _count: {
                      select: { files: true },
                    },
                  },
                },
                tags: true,
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
        },
        { ttl: 120 } // Cache for 2 minutes (shorter for frequently changing data)
      );
    }),

  getTeamById: adminProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return cacheGetOrSet(
      CacheKeys.teamDetail(input.id),
      async () => {
        const team = await ctx.prisma.team.findUnique({
          where: { id: input.id },
          include: {
            members: {
              include: {
                user: true,
              },
            },
            submission: {
              include: {
                files: true,
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
      },
      { ttl: 300 } // Cache for 5 minutes
    );
  }),

  updateTeamStatus: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'UNDER_REVIEW']),
        reviewNotes: z.string().optional(),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Log activity
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
      const leader = team.members.find(
        (m: { role: string; user: { email: string; name: string | null } }) => m.role === 'LEADER'
      );
      if (leader?.user?.email) {
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

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getAnalytics: adminProcedure.query(async ({ ctx }) => {
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
});
