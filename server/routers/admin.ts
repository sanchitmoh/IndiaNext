// Admin tRPC Router - Complete Implementation
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sendStatusUpdateEmail } from "@/lib/email";
import {
  cacheGetOrSet,
  CacheKeys,
  invalidateDashboardCache,
  invalidateTeamCache,
} from "@/lib/redis-cache";

export const adminRouter = router({
  // ═══════════════════════════════════════════════════════════
  // DASHBOARD STATS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════
  
  getStats: adminProcedure.query(async ({ ctx }) => {
    // ⭐ PERMISSION CHECK: Judges cannot access dashboard stats
    if (ctx.admin.role === 'JUDGE') {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: "Judges do not have permission to view dashboard statistics" 
      });
    }
    
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
          ctx.prisma.team.count({ where: { status: "PENDING", deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: "APPROVED", deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: "REJECTED", deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: "WAITLISTED", deletedAt: null } }),
          ctx.prisma.team.count({ where: { status: "UNDER_REVIEW", deletedAt: null } }),
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

        const avgReviewTime = reviewedTeams.length > 0
          ? reviewedTeams.reduce((acc: number, team: { createdAt: Date; reviewedAt: Date | null }) => {
              const diff = team.reviewedAt!.getTime() - team.createdAt.getTime();
              return acc + diff / (1000 * 60 * 60); // Convert to hours
            }, 0) / reviewedTeams.length
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
  // TEAMS MANAGEMENT
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
        sortBy: z.enum(["createdAt", "name", "status", "college"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().default(1),
        // ✅ SECURITY FIX (H-6): Cap pageSize at 100 to prevent DoS
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // ✅ SECURITY FIX (H-4): JUDGEs can only view teams, not full PII
      // Permission check: all admin roles can view teams
      // (but limit fields for JUDGEs below)
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      // Status filter
      if (input.status && input.status !== "all") {
        where.status = input.status;
      }

      // Track filter
      if (input.track && input.track !== "all") {
        where.track = input.track;
      } 

      // College filter
      if (input.college) {
        where.college = { contains: input.college, mode: "insensitive" };
      }

      // Search filter
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { college: { contains: input.search, mode: "insensitive" } },
          {
            members: {
              some: {
                user: {
                  OR: [
                    { name: { contains: input.search, mode: "insensitive" } },
                    { email: { contains: input.search, mode: "insensitive" } },
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
    }),

  getTeamById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: {
                // ✅ SECURITY FIX (H-4): Select only needed fields, exclude PII like lastLoginIp
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
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
            },
          },
          comments: {
            orderBy: { createdAt: "desc" },
          },
          tags: true,
        },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      return team;
    }),

  updateTeamStatus: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLISTED", "UNDER_REVIEW"]),
        reviewNotes: z.string().optional(),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ⭐ PERMISSION CHECK: Judges cannot update team status
      if (ctx.admin.role === 'JUDGE') {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Judges do not have permission to update team status" 
        });
      }
      
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
      await Promise.all([
        invalidateDashboardCache(),
        invalidateTeamCache(input.teamId),
      ]);

      // Log activity (userId is null because admin IDs are in separate Admin table)
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "team.status_updated",
          entity: "Team",
          entityId: input.teamId,
          metadata: { status: input.status, previousStatus: team.status, adminId, adminName: ctx.admin.name },
        },
      });

      // Send notification to team members
      const notifications = team.members.map((member: { userId: string }) => ({
        userId: member.userId,
        type: "STATUS_UPDATE" as const,
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

  bulkUpdateStatus: adminProcedure
    .input(
      z.object({
        teamIds: z.array(z.string()),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "WAITLISTED", "UNDER_REVIEW"]),
        reviewNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ⭐ PERMISSION CHECK: Judges cannot bulk update team status
      if (ctx.admin.role === 'JUDGE') {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Judges do not have permission to bulk update team status" 
        });
      }
      
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
          action: "team.bulk_status_updated",
          entity: "Team",
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

      for (const t of teams) {
        const leaderEmail = t.members[0]?.user?.email;
        if (leaderEmail) {
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

  deleteTeam: adminProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ⭐ PERMISSION CHECK: Judges cannot delete teams
      if (ctx.admin.role === 'JUDGE') {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Judges do not have permission to delete teams" 
        });
      }
      
      const adminId = ctx.admin.id;
      
      // Soft delete
      await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: { deletedAt: new Date() },
      });

      // ✅ INVALIDATE CACHES after deletion
      await Promise.all([
        invalidateDashboardCache(),
        invalidateTeamCache(input.teamId),
      ]);

      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "team.deleted",
          entity: "Team",
          entityId: input.teamId,
          metadata: { adminId, adminName: ctx.admin.name },
        },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // COMMENTS & TAGS
  // ═══════════════════════════════════════════════════════════

  addComment: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        content: z.string().min(1),
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
          action: "comment.created",
          entity: "Comment",
          entityId: comment.id,
          metadata: { teamId: input.teamId, adminId, adminName: ctx.admin.name },
        },
      });

      return comment;
    }),

  addTag: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        tag: z.string(),
        color: z.string().default("#6366f1"),
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

  removeTag: adminProcedure
    .input(z.object({ tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.teamTag.delete({
        where: { id: input.tagId },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS (WITH CACHING)
  // ═══════════════════════════════════════════════════════════

  getAnalytics: adminProcedure.query(async ({ ctx }) => {
    // ⭐ PERMISSION CHECK: Judges cannot access analytics
    if (ctx.admin.role === 'JUDGE') {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: "Judges do not have permission to view analytics" 
      });
    }
    
    return cacheGetOrSet(
      CacheKeys.analyticsOverview(),
      async () => {
        // Registration trends (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const registrationTrends = await ctx.prisma.$queryRaw<
          Array<{ date: Date; count: bigint }>
        >`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM teams
          WHERE "createdAt" >= ${thirtyDaysAgo} AND "deletedAt" IS NULL
          GROUP BY DATE("createdAt")
          ORDER BY date
        `;

        // Top colleges
        const collegeDistribution = await ctx.prisma.team.groupBy({
          by: ["college"],
          where: { deletedAt: null, college: { not: null } },
          _count: true,
          orderBy: { _count: { college: "desc" } },
          take: 10,
        });

        // Track comparison
        const trackComparison = await ctx.prisma.team.groupBy({
          by: ["track", "status"],
          where: { deletedAt: null },
          _count: true,
        });

        // Team size distribution
        const teamSizeDistribution = await ctx.prisma.team.groupBy({
          by: ["size"],
          where: { deletedAt: null },
          _count: true,
          orderBy: { size: "asc" },
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

  getUsers: adminProcedure
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
      // ✅ SECURITY FIX (H-4): Only ADMIN and SUPER_ADMIN can list users
      if (ctx.admin.role === 'JUDGE' || ctx.admin.role === 'ORGANIZER') {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to list users",
        });
      }
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
          { college: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.role && input.role !== "all") {
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
          orderBy: { createdAt: "desc" },
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

  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["PARTICIPANT", "ORGANIZER", "JUDGE", "ADMIN", "SUPER_ADMIN"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.admin.id;

      // ✅ SECURITY FIX (H-4): Only ADMIN and SUPER_ADMIN can update roles
      if (ctx.admin.role === 'JUDGE' || ctx.admin.role === 'ORGANIZER') {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to update user roles",
        });
      }

      // ✅ SECURITY: Prevent privilege escalation
      // Only SUPER_ADMIN can grant ADMIN or SUPER_ADMIN roles
      const privilegedRoles = ["ADMIN", "SUPER_ADMIN"];
      if (privilegedRoles.includes(input.role) && ctx.admin.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only SUPER_ADMIN can grant admin-level roles",
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
          action: "user.role_updated",
          entity: "User",
          entityId: input.userId,
          metadata: { newRole: input.role, adminId, adminName: ctx.admin.name },
        },
      });

      return user;
    }),

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY LOGS
  // ═══════════════════════════════════════════════════════════

  getActivityLogs: adminProcedure
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
      // ✅ SECURITY FIX (H-4): Only ADMIN and SUPER_ADMIN can view activity logs
      if (ctx.admin.role === 'JUDGE' || ctx.admin.role === 'ORGANIZER') {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to view activity logs",
        });
      }
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
          orderBy: { createdAt: "desc" },
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

  exportTeams: adminProcedure
    .input(
      z.object({
        status: z.string().optional(),
        track: z.string().optional(),
        format: z.enum(["csv", "json"]).default("csv"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ⭐ PERMISSION CHECK: Judges cannot export teams
      if (ctx.admin.role === 'JUDGE') {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Judges do not have permission to export team data" 
        });
      }
      
      const adminId = ctx.admin.id;
      
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (input.status && input.status !== "all") {
        where.status = input.status;
      }

      if (input.track && input.track !== "all") {
        where.track = input.track;
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
          action: "teams.exported",
          entity: "Team",
          entityId: "bulk",
          metadata: { count: teams.length, format: input.format, adminId, adminName: ctx.admin.name },
        },
      });

      return { teams, count: teams.length };
    }),
});
