// Admin tRPC Router - Complete Implementation
import { z } from 'zod';
import {
  router,
  rateLimitedAdminProcedure,
  rateLimitMutation,
  canViewTeams,
  canViewTeamsRateLimited,
  canEditTeamsRateLimited,
  canDeleteTeamsRateLimited,
  canExportTeamsRateLimited,
  canViewAnalytics,
  canManageUsers,
  canMarkAttendanceRateLimited,
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
import { getPusherServer } from '@/lib/pusher';
import { rateLimitPusherEvent } from '@/lib/pusher-rate-limit';
import { isDuplicatePusherEvent } from '@/lib/pusher-deduplication';
import { trackPusherEvent, checkPusherQuota } from '@/lib/pusher-monitor';
import { executePusherWithCircuitBreaker } from '@/lib/pusher-circuit-breaker';
import { validateQRCode } from '@/lib/qr-security';

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
          // Attendance statistics
          presentTeams,
          absentTeams,
          partialTeams,
          totalPresentUsers,
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
          // Attendance statistics
          ctx.prisma.team.count({ where: { attendance: 'PRESENT', deletedAt: null } }),
          ctx.prisma.team.count({ where: { attendance: 'ABSENT', deletedAt: null } }),
          ctx.prisma.team.count({ where: { attendance: 'PARTIAL', deletedAt: null } }),
          ctx.prisma.teamMember.count({
            where: {
              isPresent: true,
              leftAt: null,
              team: { deletedAt: null },
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
          // Attendance statistics
          presentTeams,
          absentTeams,
          partialTeams,
          totalPresentUsers,
          attendanceRate: totalUsers > 0 ? (totalPresentUsers / totalUsers) * 100 : 0,
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
        sortBy: z
          .enum([
            'createdAt',
            'name',
            'status',
            'college',
            'ideasprintRanking',
            'buildstormRanking',
            'overallScore',
          ])
          .default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        page: z.number().default(1),
        // ✅ SECURITY FIX (H-6): Cap pageSize at 100 to prevent DoS
        pageSize: z.number().min(1).max(100).default(50),
        rankingMode: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ FIX H-2: Permission check now handled by middleware guard
      // ✅ FIX H-5: Field filtering for JUDGE role
      const isJudge = ctx.admin.role === 'JUDGE';

      try {
        const where: Record<string, unknown> = {
          deletedAt: null,
        };

        // Status filter
        if (input.status && input.status !== 'all') {
          if (input.status.includes(',')) {
            // Handle comma-separated statuses (e.g., "APPROVED,SHORTLISTED")
            const statuses = input.status.split(',');
            where.status = { in: statuses };
          } else {
            where.status = input.status;
          }
        } else if (isJudge) {
          // Judge-specific filtering: only show approved and shortlisted teams if no specific status is requested
          where.status = { in: ['APPROVED', 'SHORTLISTED'] };
        }

        // Ranking mode filter for judges
        if (isJudge && input.rankingMode && input.rankingMode !== 'all') {
          if (input.rankingMode === 'ideasprint') {
            where.track = 'IDEA_SPRINT';
          } else if (input.rankingMode === 'buildstorm') {
            where.track = 'BUILD_STORM';
          }
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
          const searchConditions: any[] = [
            { name: { contains: input.search, mode: 'insensitive' } },
            { college: { contains: input.search, mode: 'insensitive' } },
          ];

          // Only include email search for non-judge users
          if (!isJudge) {
            searchConditions.push({
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
            });
          } else {
            searchConditions.push({
              members: {
                some: {
                  user: {
                    name: { contains: input.search, mode: 'insensitive' },
                  },
                },
              },
            });
          }

          where.OR = searchConditions;
        }

        // Date range filter
        if (input.dateRange?.from || input.dateRange?.to) {
          const createdAt: { gte?: Date; lte?: Date } = {};
          if (input.dateRange.from) createdAt.gte = input.dateRange.from;
          if (input.dateRange.to) createdAt.lte = input.dateRange.to;
          where.createdAt = createdAt;
        }

        // Handle special sorting for ranking fields
        let orderBy: any;
        let needsRankingCalculation = false;

        if (
          input.sortBy === 'ideasprintRanking' ||
          input.sortBy === 'buildstormRanking' ||
          input.sortBy === 'overallScore'
        ) {
          needsRankingCalculation = true;
          // For ranking-based sorting, we'll calculate rankings after fetching
          orderBy = { createdAt: input.sortOrder };
        } else {
          // Validate sortBy field to prevent errors
          const validSortFields = ['createdAt', 'name', 'status', 'college'];
          const sortField = validSortFields.includes(input.sortBy) ? input.sortBy : 'createdAt';
          orderBy = { [sortField]: input.sortOrder };
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
                      email: isJudge ? false : true,
                      phone: isJudge ? false : true,
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
                  criterionScores: {
                    select: {
                      points: true,
                      criterionId: true,
                      judgeId: true,
                    },
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
            orderBy,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          ctx.prisma.team.count({ where }),
        ]);

        // Post-process teams for ranking if needed
        let processedTeams = teams;
        if (needsRankingCalculation) {
          // Calculate scores and rankings for each team
          processedTeams = await Promise.all(
            teams.map(async (team: any) => {
              let calculatedScore = 0;
              let scoreCount = 0;

              if (team.submission?.criterionScores) {
                const scores = team.submission.criterionScores;
                calculatedScore = scores.reduce((sum: number, score: any) => sum + score.points, 0);
                scoreCount = scores.length;

                // Calculate average score if there are scores
                if (scoreCount > 0) {
                  calculatedScore = calculatedScore / scoreCount;
                }
              }

              return {
                ...team,
                calculatedScore,
                scoreCount,
              };
            })
          );

          // Sort by calculated score for ranking
          if (input.sortBy === 'ideasprintRanking' && input.track === 'IDEA_SPRINT') {
            processedTeams.sort((a: any, b: any) => {
              const scoreA = a.calculatedScore || 0;
              const scoreB = b.calculatedScore || 0;
              return input.sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
            });
          } else if (input.sortBy === 'buildstormRanking' && input.track === 'BUILD_STORM') {
            processedTeams.sort((a: any, b: any) => {
              const scoreA = a.calculatedScore || 0;
              const scoreB = b.calculatedScore || 0;
              return input.sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
            });
          } else if (input.sortBy === 'overallScore') {
            processedTeams.sort((a: any, b: any) => {
              const scoreA = a.calculatedScore || 0;
              const scoreB = b.calculatedScore || 0;
              return input.sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
            });
          }

          // Add ranking numbers based on position in sorted array
          processedTeams = processedTeams.map((team: any, index: number) => ({
            ...team,
            currentRank: (input.page - 1) * input.pageSize + index + 1,
          }));
        } else {
          // For non-ranking sorts, still calculate scores but don't sort by them
          processedTeams = teams.map((team: any) => {
            let calculatedScore = 0;
            let scoreCount = 0;

            if (team.submission?.criterionScores) {
              const scores = team.submission.criterionScores;
              calculatedScore = scores.reduce((sum: number, score: any) => sum + score.points, 0);
              scoreCount = scores.length;

              if (scoreCount > 0) {
                calculatedScore = calculatedScore / scoreCount;
              }
            }

            return {
              ...team,
              calculatedScore,
              scoreCount,
            };
          });
        }

        return {
          teams: processedTeams,
          totalCount,
          totalPages: Math.ceil(totalCount / input.pageSize),
          currentPage: input.page,
        };
      } catch (error) {
        console.error('Error in getTeams:', error);
        throw error;
      }
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
              select: {
                id: true,
                name: true,
                email: isJudge ? false : true,
                phone: isJudge ? false : true,
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
        sendEmail: z.boolean().optional().default(false),
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

      // Email sending is now handled manually via sendShortlistConfirmationEmail mutation
      // to prevent unintentional duplicate sends.
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
        // sendEmail: z.boolean().optional().default(false), // Logic removed as requested
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

      // Email sending for bulk updates is disabled as requested.
      // Individual emails should be sent manually from each team's detail page if needed.

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
      const team = await ctx.prisma.team.findFirst({
        where: {
          id: input.teamId,
          deletedAt: null,
          status: { in: ['SHORTLISTED', 'APPROVED'] },
        },
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
        where: {
          id: { in: input.teamIds },
          status: 'SHORTLISTED',
          shortlistedEmailSent: false,
          deletedAt: null,
        },
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
          metadata: {
            totalAttempted: input.teamIds.length,
            filteredTeams: teams.length,
            sent,
            failed,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
          },
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

  getActivityLogs: canViewAnalytics
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
      // ✅ FIX H-2: Permission check now handled by middleware guard (ORGANIZER, JUDGE, ADMIN, SUPER_ADMIN)
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

  getTeamByShortCode: canViewTeamsRateLimited
    .input(z.object({ qrPayload: z.string(), deskId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      // Validate QR code security (nonce, expiry, scan limit)
      const qrValidation = await validateQRCode(input.qrPayload);
      if (!qrValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: qrValidation.reason || 'Invalid QR code',
        });
      }

      const shortCode = qrValidation.shortCode!;

      const team = await ctx.prisma.team.findUnique({
        where: { shortCode, deletedAt: null },
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

      // Event deduplication check
      const dedupKey = `qr:${shortCode}:${input.deskId}:${ctx.admin.id}`;
      const isDuplicate = await isDuplicatePusherEvent(dedupKey, 10);

      if (!isDuplicate) {
        // Check Pusher quota before triggering
        const quotaStatus = await checkPusherQuota();
        if (!quotaStatus.ok) {
          console.error('[Pusher] Quota exceeded, skipping qr:scanned event');
        } else {
          if (quotaStatus.warningLevel !== 'normal') {
            console.warn(`[Pusher] Quota warning: ${quotaStatus.percentUsed.toFixed(1)}% used`);
          }

          // Pusher rate limiting check
          const rateLimitResult = await rateLimitPusherEvent('qr:scanned', ctx.admin.id);

          if (rateLimitResult.allowed) {
            // Emit event for real-time dashboard on desk-specific private channel
            const pusher = getPusherServer();
            if (pusher) {
              console.log(
                `[Pusher] Triggering qr:scanned for desk ${input.deskId} for team ${team.name}`
              );

              const result = await executePusherWithCircuitBreaker(async () => {
                await pusher.trigger(`private-admin-checkin-${input.deskId}`, 'qr:scanned', {
                  team,
                  adminName: ctx.admin.name,
                });
              });

              if (result.success) {
                // Track successful event
                await trackPusherEvent('qr:scanned');
              } else {
                console.error('[Pusher] qr:scanned trigger failed:', result.error);
              }
            } else {
              console.error(
                '[Pusher] ERROR: getPusherServer() returned null. Check environment variables.'
              );
            }
          } else {
            console.warn(`[Pusher] Rate limit exceeded for qr:scanned: ${rateLimitResult.reason}`);
          }
        }
      } else {
        console.log(`[Pusher] Duplicate qr:scanned event skipped: ${dedupKey}`);
      }

      return {
        ...team,
        teamIndex,
      };
    }),

  sendScannerHeartbeat: canViewTeamsRateLimited
    .input(z.object({ deskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Backend Enforcement: If admin has an assigned desk, they MUST use it
      if (ctx.admin.desk && ctx.admin.desk !== input.deskId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `ACCESS_DENIED: Your account is locked to Station ${ctx.admin.desk}`,
        });
      }

      console.log(
        `[Pusher] Scanner Heartbeat for Station ${input.deskId} from Admin ${ctx.admin.name}`
      );

      // Pusher rate limiting check
      const rateLimitResult = await rateLimitPusherEvent('scanner:presence', ctx.admin.id);

      if (rateLimitResult.allowed) {
        const pusher = getPusherServer();
        if (pusher) {
          const result = await executePusherWithCircuitBreaker(async () => {
            await pusher.trigger(`private-admin-checkin-${input.deskId}`, 'scanner:presence', {
              timestamp: new Date().toISOString(),
            });
          });

          if (result.success) {
            // Track successful event
            await trackPusherEvent('scanner:presence');
          } else {
            console.error('[Pusher] scanner:presence trigger failed:', result.error);
          }
        }
      } else {
        console.warn(
          `[Pusher] Rate limit exceeded for scanner:presence: ${rateLimitResult.reason}`
        );
      }

      return { success: true };
    }),

  confirmCheckIn: canMarkAttendanceRateLimited
    .input(
      z.object({
        teamId: z.string(),
        deskId: z.string(),
        breakfastCoupons: z.number(),
        lunchCoupons: z.number(),
        verifications: z.array(
          z.object({
            memberId: z.string(),
            isPresent: z.boolean(),
            exceptionNote: z.string().optional(),
          })
        ),
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
              isPresent: v.isPresent,
              exceptionNote: v.exceptionNote,
              verifiedBy: ctx.admin.id,
            },
            update: {
              isPresent: v.isPresent,
              exceptionNote: v.exceptionNote,
              verifiedBy: ctx.admin.id,
            },
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

      // 2. Event deduplication check for checkin:confirmed
      const dedupKey = `checkin:confirmed:${input.teamId}:${input.deskId}`;
      const isDuplicate = await isDuplicatePusherEvent(dedupKey, 10);

      if (!isDuplicate) {
        // Pusher rate limiting for checkin:confirmed
        const rateLimitConfirmed = await rateLimitPusherEvent('checkin:confirmed', ctx.admin.id);

        if (rateLimitConfirmed.allowed) {
          const pusher = getPusherServer();
          if (pusher) {
            // Emit confirmed event on desk-specific private channel
            const result = await executePusherWithCircuitBreaker(async () => {
              await pusher.trigger(`private-admin-checkin-${input.deskId}`, 'checkin:confirmed', {
                teamId: input.teamId,
                teamName: team.name,
                adminName: ctx.admin.name,
              });
            });

            if (result.success) {
              await trackPusherEvent('checkin:confirmed');
            } else {
              console.error('[Pusher] checkin:confirmed trigger failed:', result.error);
            }
          }
        } else {
          console.warn(
            `[Pusher] Rate limit exceeded for checkin:confirmed: ${rateLimitConfirmed.reason}`
          );
        }

        // Pusher rate limiting for stats:updated
        const rateLimitStats = await rateLimitPusherEvent('stats:updated', ctx.admin.id);

        if (rateLimitStats.allowed) {
          const pusher = getPusherServer();
          if (pusher) {
            // Emit global stats update on private channel
            const result = await executePusherWithCircuitBreaker(async () => {
              await pusher.trigger('private-admin-updates', 'stats:updated', {});
            });

            if (result.success) {
              await trackPusherEvent('stats:updated');
            } else {
              console.error('[Pusher] stats:updated trigger failed:', result.error);
            }
          }
        } else {
          console.warn(`[Pusher] Rate limit exceeded for stats:updated: ${rateLimitStats.reason}`);
        }
      } else {
        console.log(`[Pusher] Duplicate checkin:confirmed event skipped: ${dedupKey}`);
      }

      return { success: true };
    }),

  flagCheckInIssue: canMarkAttendanceRateLimited
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

      // Event deduplication check for checkin:flagged
      const dedupKey = `checkin:flagged:${input.teamId}:${input.deskId}`;
      const isDuplicate = await isDuplicatePusherEvent(dedupKey, 10);

      if (!isDuplicate) {
        // Pusher rate limiting for checkin:flagged
        const rateLimitFlagged = await rateLimitPusherEvent('checkin:flagged', ctx.admin.id);

        if (rateLimitFlagged.allowed) {
          const pusher = getPusherServer();
          if (pusher) {
            // Emit flagged event on desk-specific private channel
            const result = await executePusherWithCircuitBreaker(async () => {
              await pusher.trigger(`private-admin-checkin-${input.deskId}`, 'checkin:flagged', {
                teamId: input.teamId,
                reason: input.reason,
                adminName: ctx.admin.name,
              });
            });

            if (result.success) {
              await trackPusherEvent('checkin:flagged');
            } else {
              console.error('[Pusher] checkin:flagged trigger failed:', result.error);
            }
          }
        } else {
          console.warn(
            `[Pusher] Rate limit exceeded for checkin:flagged: ${rateLimitFlagged.reason}`
          );
        }

        // Pusher rate limiting for stats:updated
        const rateLimitStats = await rateLimitPusherEvent('stats:updated', ctx.admin.id);

        if (rateLimitStats.allowed) {
          const pusher = getPusherServer();
          if (pusher) {
            // Emit global stats update on private channel
            const result = await executePusherWithCircuitBreaker(async () => {
              await pusher.trigger('private-admin-updates', 'stats:updated', {});
            });

            if (result.success) {
              await trackPusherEvent('stats:updated');
            } else {
              console.error('[Pusher] stats:updated trigger failed:', result.error);
            }
          }
        } else {
          console.warn(`[Pusher] Rate limit exceeded for stats:updated: ${rateLimitStats.reason}`);
        }
      } else {
        console.log(`[Pusher] Duplicate checkin:flagged event skipped: ${dedupKey}`);
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
      flaggedCount: flagged,
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

  // Lean projection for venue mapping — only the fields the venue component needs
  getShortlistedTeamsForVenue: canViewTeams.query(async ({ ctx }) => {
    return ctx.prisma.team.findMany({
      where: { status: 'SHORTLISTED', deletedAt: null },
      select: {
        id: true,
        name: true,
        shortCode: true,
        track: true,
        college: true,
        venueId: true,
        tableId: true,
        tableNumber: true,
        attendance: true,
      },
      orderBy: { reviewedAt: 'asc' },
    });
  }),

  createVenue: canEditTeamsRateLimited
    .input(
      z.object({
        name: z.string().min(1),
        floor: z.string().optional(),
        block: z.string().optional(),
        capacity: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.venue.create({
        data: {
          name: input.name,
          floor: input.floor,
          block: input.block,
          capacity: input.capacity,
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
          message: `Cannot delete venue: ${teamCount} team(s) are still assigned to it. Unassign them first.`,
        });
      }

      // Check if any tables in this venue are occupied by teams
      const occupiedTableCount = await ctx.prisma.table.count({
        where: { venueId: input.id, team: { isNot: null } },
      });
      if (occupiedTableCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete venue: ${occupiedTableCount} table(s) are occupied by teams. Unassign them first.`,
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

  // Fetch ALL tables across ALL venues in one query — eliminates the N+1 per-card problem
  getAllVenueTables: canViewTeams.query(async ({ ctx }) => {
    return ctx.prisma.table.findMany({
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

  updateTeamLogistics: canMarkAttendanceRateLimited
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

  // ═══════════════════════════════════════════════════════════
  // CRITERIA MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  getCriteria: canViewAnalytics
    .input(
      z.object({
        track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.track) {
        where.track = input.track;
      }

      const criteria = await ctx.prisma.scoringCriterion.findMany({
        where,
        orderBy: [{ track: 'asc' }, { order: 'asc' }],
      });

      return {
        criteria,
        totalCount: criteria.length,
      };
    }),

  createCriterion: canEditTeamsRateLimited
    .input(
      z.object({
        track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']),
        criterionId: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        weight: z.number().min(1).max(100),
        maxPoints: z.number().min(1).max(100),
        order: z.number().min(1),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if criterion ID already exists for this track
      const existing = await ctx.prisma.scoringCriterion.findUnique({
        where: {
          track_criterionId: {
            track: input.track,
            criterionId: input.criterionId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Criterion ID already exists for this track',
        });
      }

      // Check if total weight would exceed 100%
      const existingCriteria = await ctx.prisma.scoringCriterion.findMany({
        where: {
          track: input.track,
          isActive: true,
        },
      });

      const totalWeight = existingCriteria.reduce((sum, c) => sum + c.weight, 0);
      if (input.isActive && totalWeight + input.weight > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Total weight would exceed 100%. Current: ${totalWeight}%, Adding: ${input.weight}%`,
        });
      }

      const criterion = await ctx.prisma.scoringCriterion.create({
        data: input,
      });

      return criterion;
    }),

  updateCriterion: canEditTeamsRateLimited
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        weight: z.number().min(1).max(100),
        maxPoints: z.number().min(1).max(100),
        order: z.number().min(1),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Get the current criterion
      const current = await ctx.prisma.scoringCriterion.findUnique({
        where: { id },
      });

      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Criterion not found',
        });
      }

      // Check if total weight would exceed 100%
      const existingCriteria = await ctx.prisma.scoringCriterion.findMany({
        where: {
          track: current.track,
          isActive: true,
          id: { not: id },
        },
      });

      const totalWeight = existingCriteria.reduce((sum, c) => sum + c.weight, 0);
      if (input.isActive && totalWeight + input.weight > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Total weight would exceed 100%. Current: ${totalWeight}%, Adding: ${input.weight}%`,
        });
      }

      const criterion = await ctx.prisma.scoringCriterion.update({
        where: { id },
        data: updateData,
      });

      return criterion;
    }),

  deleteCriterion: canEditTeamsRateLimited
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if criterion has any scores
      const scoresCount = await ctx.prisma.criterionScore.count({
        where: {
          criterion: {
            criterionId: {
              in: await ctx.prisma.scoringCriterion
                .findUnique({ where: { id: input.id } })
                .then((c) => (c ? [c.criterionId] : [])),
            },
          },
        },
      });

      if (scoresCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete criterion that has existing scores. Deactivate it instead.',
        });
      }

      await ctx.prisma.scoringCriterion.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  toggleCriterion: canEditTeamsRateLimited
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const criterion = await ctx.prisma.scoringCriterion.findUnique({
        where: { id: input.id },
      });

      if (!criterion) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Criterion not found',
        });
      }

      // If activating, check weight limits
      if (input.isActive) {
        const existingCriteria = await ctx.prisma.scoringCriterion.findMany({
          where: {
            track: criterion.track,
            isActive: true,
            id: { not: input.id },
          },
        });

        const totalWeight = existingCriteria.reduce((sum, c) => sum + c.weight, 0);
        if (totalWeight + criterion.weight > 100) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot activate. Total weight would be ${totalWeight + criterion.weight}%`,
          });
        }
      }

      const updated = await ctx.prisma.scoringCriterion.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });

      return updated;
    }),

  reorderCriteria: canEditTeamsRateLimited
    .input(
      z.object({
        track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']),
        criteriaIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update order for each criterion
      const updates = input.criteriaIds.map((id, index) =>
        ctx.prisma.scoringCriterion.update({
          where: { id },
          data: { order: index + 1 },
        })
      );

      await Promise.all(updates);

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // RANKED LEADERBOARD — per track, with tie cascade
  // ═══════════════════════════════════════════════════════════

  getLeaderboard: canViewTeams
    .input(
      z.object({
        track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']),
        page: z.number().default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch all scored teams for this track (not paginated — needed to compute global ranks)
      const teams = await ctx.prisma.team.findMany({
        where: {
          track: input.track,
          status: { in: ['APPROVED', 'SHORTLISTED'] },
          deletedAt: null,
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, college: true, avatar: true } },
            },
          },
          submission: {
            select: {
              id: true,
              submittedAt: true,
              ideaTitle: true,
              judgeScore: true,
              criterionScores: {
                select: {
                  points: true,
                  criterionId: true,
                  judgeId: true,
                  confidence: true,
                  criterion: { select: { weight: true, maxPoints: true, criterionId: true } },
                },
              },
            },
          },
        },
      });

      // Fetch highest-weight criterion for this track (used in tie cascade step 1)
      const topCriterion = await ctx.prisma.scoringCriterion.findFirst({
        where: { track: input.track, isActive: true },
        orderBy: { weight: 'desc' },
      });

      type ScoredTeam = (typeof teams)[0] & {
        calculatedScore: number;
        judgeCount: number;
        topCriterionAvg: number;
        finalRank: number;
        tieResolutionMethod: string | null;
      };

      // ── Per-team score calculation ──────────────────────────────────
      const scored: ScoredTeam[] = teams.map((team) => {
        const allCS = team.submission?.criterionScores ?? [];

        // Group by judge → confidence-weighted total per judge
        const judgeMap = new Map<string, { total: number; confidence: number }>();
        for (const cs of allCS) {
          let e = judgeMap.get(cs.judgeId);
          if (!e) {
            e = { total: 0, confidence: cs.confidence ?? 50 };
            judgeMap.set(cs.judgeId, e);
          }
          const norm = (cs.points / cs.criterion.maxPoints) * 100;
          e.total += (norm * cs.criterion.weight) / 100;
        }

        const judges = Array.from(judgeMap.values());
        const judgeCount = judges.length;
        const totalConf = judges.reduce((s, j) => s + j.confidence, 0) || 1;
        const calculatedScore =
          judgeCount === 0
            ? 0
            : Math.round(
                (judges.reduce((s, j) => s + j.total * j.confidence, 0) / totalConf) * 10
              ) / 10;

        // Top-criterion average (for tie cascade step 1)
        const topCS = topCriterion
          ? allCS.filter((cs) => cs.criterion.criterionId === topCriterion.criterionId)
          : [];
        const topCriterionAvg =
          topCS.length > 0 ? topCS.reduce((s, cs) => s + cs.points, 0) / topCS.length : 0;

        return {
          ...team,
          calculatedScore: team.submission?.judgeScore ?? calculatedScore,
          judgeCount,
          topCriterionAvg,
          finalRank: 0,
          tieResolutionMethod: null,
        };
      });

      // ── Tie cascade sort ────────────────────────────────────────────
      const TIE_TOLERANCE = 0.5; // scores within ±0.5 are considered tied

      scored.sort((a, b) => {
        const diff = b.calculatedScore - a.calculatedScore;
        if (Math.abs(diff) > TIE_TOLERANCE) return diff; // clear winner

        // Tied — cascade:
        // 1. Higher score on highest-weighted criterion
        const topDiff = b.topCriterionAvg - a.topCriterionAvg;
        if (Math.abs(topDiff) > 0.01) {
          a.tieResolutionMethod = b.tieResolutionMethod = 'top_criterion';
          return topDiff;
        }
        // 2. More judges = more consensus
        const jDiff = b.judgeCount - a.judgeCount;
        if (jDiff !== 0) {
          a.tieResolutionMethod = b.tieResolutionMethod = 'judge_count';
          return jDiff;
        }
        // 3. Earlier submission
        const aSubmitted = a.submission?.submittedAt
          ? new Date(a.submission.submittedAt).getTime()
          : Infinity;
        const bSubmitted = b.submission?.submittedAt
          ? new Date(b.submission.submittedAt).getTime()
          : Infinity;
        if (aSubmitted !== bSubmitted) {
          a.tieResolutionMethod = b.tieResolutionMethod = 'submission_time';
          return aSubmitted - bSubmitted;
        }
        // 4. Alphabetical (last resort)
        a.tieResolutionMethod = b.tieResolutionMethod = 'alphabetical';
        return a.name.localeCompare(b.name);
      });

      // Apply manual rank overrides within ties
      scored.sort((a, b) => {
        const aDiff = Math.abs(a.calculatedScore - b.calculatedScore);
        if (aDiff > TIE_TOLERANCE) return 0; // already sorted correctly by cascade
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        return 0;
      });

      // Assign final ranks
      scored.forEach((t, i) => {
        t.finalRank = i + 1;
      });

      const total = scored.length;
      const start = (input.page - 1) * input.pageSize;
      const pageItems = scored.slice(start, start + input.pageSize);

      return {
        teams: pageItems,
        totalCount: total,
        totalPages: Math.ceil(total / input.pageSize),
        currentPage: input.page,
        track: input.track,
      };
    }),

  // ── Manual rank override ────────────────────────────────────────────
  setManualRank: canEditTeamsRateLimited
    .input(
      z.object({
        teamId: z.string(),
        rank: z.number().int().min(1).nullable(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: { rank: input.rank },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: 'team.manual_rank_set',
          entity: 'Team',
          entityId: input.teamId,
          metadata: {
            rank: input.rank,
            reason: input.reason ?? null,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
          },
        },
      });

      return { success: true, teamId: team.id, rank: team.rank };
    }),

  // ── Tie analytics ────────────────────────────────────────────────────
  getTieAnalytics: canViewAnalytics.query(async ({ ctx }) => {
    const TIE_TOLERANCE = 0.5;

    async function analyzeTies(track: 'IDEA_SPRINT' | 'BUILD_STORM') {
      const teams = await ctx.prisma.team.findMany({
        where: { track, status: { in: ['APPROVED', 'SHORTLISTED'] }, deletedAt: null },
        include: {
          submission: { select: { judgeScore: true, submittedAt: true } },
        },
      });

      // Group teams with same score (within tolerance)
      const scored = teams
        .filter((t) => t.submission?.judgeScore != null)
        .map((t) => ({
          id: t.id,
          name: t.name,
          score: t.submission!.judgeScore!,
          manualRank: t.rank,
        }));

      const groups: {
        score: number;
        teams: typeof scored;
        resolved: boolean;
        resolutionType: 'manual' | 'auto' | null;
      }[] = [];
      const visited = new Set<string>();

      for (const team of scored) {
        if (visited.has(team.id)) continue;
        const group = scored.filter((t) => Math.abs(t.score - team.score) <= TIE_TOLERANCE);
        if (group.length >= 2) {
          group.forEach((t) => visited.add(t.id));
          const hasManual = group.some((t) => t.manualRank !== null);
          groups.push({
            score: team.score,
            teams: group,
            resolved: true, // auto cascade always resolves
            resolutionType: hasManual ? 'manual' : 'auto',
          });
        }
      }

      const totalTies = groups.reduce((s, g) => s + g.teams.length, 0);
      const manualResolved = groups
        .filter((g) => g.resolutionType === 'manual')
        .reduce((s, g) => s + g.teams.length, 0);
      const autoResolved = totalTies - manualResolved;

      return {
        totalTies,
        tieGroups: groups,
        manualResolved,
        autoResolved,
        totalTeams: teams.length,
        scoredTeams: scored.length,
      };
    }

    const [ideasprint, buildstorm] = await Promise.all([
      analyzeTies('IDEA_SPRINT'),
      analyzeTies('BUILD_STORM'),
    ]);

    return { ideasprint, buildstorm };
  }),

  // ── Score audit log ──────────────────────────────────────────────────
  getScoreAuditLog: canViewAnalytics
    .input(
      z.object({
        submissionId: z.string(),
        page: z.number().default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const [logs, total] = await Promise.all([
        ctx.prisma.scoreAuditLog.findMany({
          where: { submissionId: input.submissionId },
          include: {
            criterion: { select: { name: true, criterionId: true, weight: true, maxPoints: true } },
          },
          orderBy: { changedAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.scoreAuditLog.count({ where: { submissionId: input.submissionId } }),
      ]);

      return {
        logs: logs.map((l) => ({
          id: l.id,
          judgeId: l.judgeId,
          judgeName: l.judgeName,
          criterionName: l.criterion.name,
          criterionWeight: l.criterion.weight,
          oldPoints: l.oldPoints,
          newPoints: l.newPoints,
          delta: l.oldPoints !== null ? Math.round((l.newPoints - l.oldPoints) * 10) / 10 : null,
          oldComments: l.oldComments,
          newComments: l.newComments,
          confidence: l.confidence,
          ipAddress: l.ipAddress,
          changedAt: l.changedAt,
        })),
        totalCount: total,
        totalPages: Math.ceil(total / input.pageSize),
        currentPage: input.page,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // ELIMINATION ROUNDS — Judge Portal
  // ═══════════════════════════════════════════════════════════

  /** Set a team's elimination status for a given round (JUDGE or ADMIN) */
  setTeamRoundStatus: canViewTeams
    .input(
      z.object({
        teamId: z.string(),
        round: z.enum(['1', '2']),
        status: z.enum(['QUALIFIED', 'ELIMINATED', 'PENDING']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const data =
        input.round === '1'
          ? {
              round1Status: input.status as any,
              round1ActionBy: ctx.admin.id,
              round1ActionAt: now,
            }
          : {
              round2Status: input.status as any,
              round2ActionBy: ctx.admin.id,
              round2ActionAt: now,
            };

      const team = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data,
        select: { id: true, name: true, round1Status: true, round2Status: true },
      });

      return team;
    }),

  /** Get all teams for a round, with their round status and score */
  getRoundTeams: canViewTeams
    .input(
      z.object({
        round: z.enum(['1', '2']),
        track: z.enum(['IDEA_SPRINT', 'BUILD_STORM', 'all']).default('all'),
        status: z.enum(['PENDING', 'QUALIFIED', 'ELIMINATED', 'all']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        deletedAt: null,
        status: { in: ['APPROVED', 'SHORTLISTED'] },
      };

      if (input.track !== 'all') where.track = input.track;

      // Round 2 only shows teams that QUALIFIED round 1
      if (input.round === '2') {
        where.round1Status = 'QUALIFIED';
      }

      if (input.status !== 'all') {
        if (input.round === '1') where.round1Status = input.status;
        else where.round2Status = input.status;
      }

      const teams = await ctx.prisma.team.findMany({
        where,
        select: {
          id: true,
          name: true,
          shortCode: true,
          track: true,
          college: true,
          score: true,
          round1Status: true,
          round2Status: true,
          round1ActionAt: true,
          round2ActionAt: true,
          round1ActionBy: true,
          round2ActionBy: true,
          attendance: true,
          checkedIn: true,
          members: {
            select: { id: true, role: true, isPresent: true, leftAt: true },
          },
        },
        orderBy: [{ score: 'desc' }, { name: 'asc' }],
      });

      // Resolve admin IDs → names for judge attribution in the UI
      const actionByIds = [
        ...new Set(
          [...teams.map((t) => t.round1ActionBy), ...teams.map((t) => t.round2ActionBy)].filter(
            Boolean
          ) as string[]
        ),
      ];

      const adminMap: Record<string, string> = {};
      if (actionByIds.length > 0) {
        const users = await ctx.prisma.user.findMany({
          where: { id: { in: actionByIds } },
          select: { id: true, name: true, email: true },
        });
        for (const u of users) adminMap[u.id] = u.name || u.email || u.id;
      }

      return teams.map((t) => ({
        ...t,
        round1ActionName: t.round1ActionBy
          ? (adminMap[t.round1ActionBy] ?? t.round1ActionBy)
          : null,
        round2ActionName: t.round2ActionBy
          ? (adminMap[t.round2ActionBy] ?? t.round2ActionBy)
          : null,
      }));
    }),

  /** Per-round analytics: total, qualified, eliminated, pending — per track */
  getRoundAnalytics: canViewTeams.query(async ({ ctx }) => {
    const eligible = await ctx.prisma.team.findMany({
      where: {
        deletedAt: null,
        status: { in: ['APPROVED', 'SHORTLISTED'] },
      },
      select: { track: true, round1Status: true, round2Status: true },
    });

    const buildStats = (arr: typeof eligible, roundKey: 'round1Status' | 'round2Status') => {
      const count = (track: string | null, status: string) =>
        arr.filter((t) => (track ? t.track === track : true) && t[roundKey] === status).length;

      return {
        all: {
          total: arr.length,
          qualified: count(null, 'QUALIFIED'),
          eliminated: count(null, 'ELIMINATED'),
          pending: count(null, 'PENDING'),
        },
        ideaSprint: {
          total: arr.filter((t) => t.track === 'IDEA_SPRINT').length,
          qualified: count('IDEA_SPRINT', 'QUALIFIED'),
          eliminated: count('IDEA_SPRINT', 'ELIMINATED'),
          pending: count('IDEA_SPRINT', 'PENDING'),
        },
        buildStorm: {
          total: arr.filter((t) => t.track === 'BUILD_STORM').length,
          qualified: count('BUILD_STORM', 'QUALIFIED'),
          eliminated: count('BUILD_STORM', 'ELIMINATED'),
          pending: count('BUILD_STORM', 'PENDING'),
        },
      };
    };

    // Round 2 eligible = only those who passed round 1
    const r2Eligible = eligible.filter((t) => t.round1Status === 'QUALIFIED');

    return {
      round1: buildStats(eligible, 'round1Status'),
      round2: buildStats(r2Eligible, 'round2Status'),
    };
  }),

  /** Admin: advance all Round-1 QUALIFIED teams (i.e. open Round 2) */
  advanceToRound2: canEditTeamsRateLimited.mutation(async ({ ctx }) => {
    if (ctx.admin.role !== 'SUPER_ADMIN' && ctx.admin.role !== 'ADMIN') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can advance rounds' });
    }

    const qualified = await ctx.prisma.team.count({
      where: { round1Status: 'QUALIFIED', deletedAt: null },
    });

    if (qualified === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No teams have been qualified in Round 1 yet',
      });
    }

    return { qualifiedCount: qualified };
  }),
});
