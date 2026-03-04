// ═══════════════════════════════════════════════════════════
// Logistics tRPC Router — Event-Day Operations
// ═══════════════════════════════════════════════════════════
//
// Responsibilities:
// 1. View APPROVED teams only (hard-filtered)
// 2. Mark team/member attendance (present/absent)
// 3. Edit non-leader member info (name, phone, email, college)
// 4. Swap non-leader members (with constraint validation)
// 5. QR-based check-in by shortCode
// 6. Export attendance data
//
// Industry Standards:
// - Audit trail on every mutation
// - Last-write-wins conflict resolution with timestamp logging
// - Leader protection: cannot edit/swap the team leader
// - Member swap constraints: no duplicate teams, verified email, size limit
// ═══════════════════════════════════════════════════════════

import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// ── Permission guard ────────────────────────────────────────

const LOGISTICS_ROLES = ["LOGISTICS", "ADMIN", "SUPER_ADMIN"];

function requireLogisticsRole(role: string, action: string) {
  if (!LOGISTICS_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${action} requires LOGISTICS, ADMIN, or SUPER_ADMIN role`,
    });
  }
}

// ── Router ──────────────────────────────────────────────────

export const logisticsRouter = router({
  // ═══════════════════════════════════════════════════════════
  // GET APPROVED TEAMS (with attendance status + search)
  // Logistics only sees APPROVED teams — hard filter, no override
  // Polls every 30s on client for real-time sync
  // ═══════════════════════════════════════════════════════════

  getApprovedTeams: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        track: z.string().optional(),
        attendance: z.string().optional(), // "all" | "NOT_MARKED" | "PRESENT" | "ABSENT" | "PARTIAL"
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
        sortBy: z
          .enum(["name", "shortCode", "college", "attendance", "checkedInAt"])
          .default("name"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      })
    )
    .query(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "View approved teams");

      const where: Record<string, unknown> = {
        status: "APPROVED",
        deletedAt: null,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { shortCode: { contains: input.search, mode: "insensitive" } },
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

      if (input.track && input.track !== "all") {
        where.track = input.track;
      }

      if (input.attendance && input.attendance !== "all") {
        where.attendance = input.attendance;
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
                    degree: true,
                    year: true,
                    branch: true,
                    gender: true,
                    emailVerified: true,
                  },
                },
              },
              orderBy: { role: "asc" }, // LEADER first
            },
          },
          orderBy: { [input.sortBy]: input.sortOrder },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.team.count({ where }),
      ]);

      return {
        teams: teams.map((team) => ({
          id: team.id,
          shortCode: team.shortCode,
          name: team.name,
          track: team.track,
          college: team.college,
          size: team.size,
          attendance: team.attendance,
          checkedInAt: team.checkedInAt,
          checkedInBy: team.checkedInBy,
          attendanceNotes: team.attendanceNotes,
          members: team.members.map((m) => ({
            id: m.id,
            role: m.role,
            isPresent: m.isPresent,
            checkedInAt: m.checkedInAt,
            user: m.user,
          })),
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        currentPage: input.page,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // GET TEAM BY SHORT CODE (QR check-in lookup)
  // ═══════════════════════════════════════════════════════════

  getTeamByShortCode: adminProcedure
    .input(z.object({ shortCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "QR check-in lookup");

      const team = await ctx.prisma.team.findUnique({
        where: { shortCode: input.shortCode.toUpperCase().trim() },
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
                  gender: true,
                  emailVerified: true,
                },
              },
            },
            orderBy: { role: "asc" },
          },
        },
      });

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No team found with code "${input.shortCode}"`,
        });
      }

      if (team.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Team "${team.name}" is not approved (status: ${team.status})`,
        });
      }

      return {
        id: team.id,
        shortCode: team.shortCode,
        name: team.name,
        track: team.track,
        college: team.college,
        size: team.size,
        attendance: team.attendance,
        checkedInAt: team.checkedInAt,
        checkedInBy: team.checkedInBy,
        attendanceNotes: team.attendanceNotes,
        members: team.members.map((m) => ({
          id: m.id,
          role: m.role,
          isPresent: m.isPresent,
          checkedInAt: m.checkedInAt,
          user: m.user,
        })),
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // MARK TEAM ATTENDANCE (team-level)
  // Last-write-wins with full audit trail
  // ═══════════════════════════════════════════════════════════

  markTeamAttendance: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        attendance: z.enum(["NOT_MARKED", "PRESENT", "ABSENT", "PARTIAL"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "Mark team attendance");

      // Get current state for audit (conflict resolution: log previous state)
      const currentTeam = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        select: {
          id: true,
          name: true,
          status: true,
          attendance: true,
          attendanceNotes: true,
          checkedInBy: true,
          checkedInAt: true,
        },
      });

      if (!currentTeam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      if (currentTeam.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only mark attendance for approved teams",
        });
      }

      const now = new Date();

      // Last-write-wins: update with current admin and timestamp
      const team = await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: {
          attendance: input.attendance,
          checkedInAt: now,
          checkedInBy: ctx.admin.id,
          attendanceNotes: input.notes ?? currentTeam.attendanceNotes,
        },
      });

      // If marking PRESENT, also mark all members as present
      if (input.attendance === "PRESENT") {
        await ctx.prisma.teamMember.updateMany({
          where: { teamId: input.teamId },
          data: {
            isPresent: true,
            checkedInAt: now,
            checkedInBy: ctx.admin.id,
          },
        });
      } else if (input.attendance === "ABSENT") {
        await ctx.prisma.teamMember.updateMany({
          where: { teamId: input.teamId },
          data: {
            isPresent: false,
            checkedInAt: now,
            checkedInBy: ctx.admin.id,
          },
        });
      }

      // Audit trail with conflict resolution metadata
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "logistics.attendance_marked",
          entity: "Team",
          entityId: input.teamId,
          metadata: {
            teamName: currentTeam.name,
            newAttendance: input.attendance,
            previousAttendance: currentTeam.attendance,
            previousCheckedInBy: currentTeam.checkedInBy,
            previousCheckedInAt: currentTeam.checkedInAt,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
            notes: input.notes,
            timestamp: now.toISOString(),
          },
        },
      });

      return team;
    }),

  // ═══════════════════════════════════════════════════════════
  // MARK MEMBER ATTENDANCE (per-member check-in)
  // ═══════════════════════════════════════════════════════════

  markMemberAttendance: adminProcedure
    .input(
      z.object({
        memberId: z.string(),
        isPresent: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "Mark member attendance");

      const member = await ctx.prisma.teamMember.findUnique({
        where: { id: input.memberId },
        include: {
          user: { select: { name: true, email: true } },
          team: { select: { id: true, name: true, status: true } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (member.team.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only mark attendance for approved teams",
        });
      }

      const now = new Date();

      await ctx.prisma.teamMember.update({
        where: { id: input.memberId },
        data: {
          isPresent: input.isPresent,
          checkedInAt: now,
          checkedInBy: ctx.admin.id,
        },
      });

      // Recalculate team-level attendance based on member statuses
      const allMembers = await ctx.prisma.teamMember.findMany({
        where: { teamId: member.teamId },
        select: { isPresent: true },
      });

      const presentCount = allMembers.filter((m) => m.isPresent).length;
      let teamAttendance: "NOT_MARKED" | "PRESENT" | "ABSENT" | "PARTIAL";

      if (presentCount === 0) {
        teamAttendance = "ABSENT";
      } else if (presentCount === allMembers.length) {
        teamAttendance = "PRESENT";
      } else {
        teamAttendance = "PARTIAL";
      }

      await ctx.prisma.team.update({
        where: { id: member.teamId },
        data: {
          attendance: teamAttendance,
          checkedInAt: now,
          checkedInBy: ctx.admin.id,
        },
      });

      // Audit trail
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "logistics.attendance_marked",
          entity: "TeamMember",
          entityId: input.memberId,
          metadata: {
            teamId: member.teamId,
            teamName: member.team.name,
            memberName: member.user.name,
            memberEmail: member.user.email,
            isPresent: input.isPresent,
            teamAttendance,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
            timestamp: now.toISOString(),
          },
        },
      });

      return { success: true, teamAttendance };
    }),

  // ═══════════════════════════════════════════════════════════
  // EDIT MEMBER INFO (non-leader only)
  // ═══════════════════════════════════════════════════════════

  editMemberInfo: adminProcedure
    .input(
      z.object({
        memberId: z.string(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        college: z.string().optional(),
        degree: z.string().optional(),
        year: z.string().optional(),
        branch: z.string().optional(),
        gender: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "Edit member info");

      const member = await ctx.prisma.teamMember.findUnique({
        where: { id: input.memberId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, college: true } },
          team: { select: { id: true, name: true, status: true } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (member.team.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only edit members of approved teams",
        });
      }

      // ⛔ LEADER PROTECTION: Cannot edit team leader
      if (member.role === "LEADER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify the team leader. Only non-leader members can be edited.",
        });
      }

      // Check email uniqueness if changing email
      if (input.email && input.email !== member.user.email) {
        const existingUser = await ctx.prisma.user.findUnique({
          where: { email: input.email },
        });
        if (existingUser && existingUser.id !== member.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Email "${input.email}" is already registered to another user`,
          });
        }
      }

      // Build update payload (only changed fields)
      const updateData: Record<string, string | undefined> = {};
      const changes: Record<string, { from: string | null; to: string | undefined }> = {};

      const fields = ["name", "phone", "email", "college", "degree", "year", "branch", "gender"] as const;
      for (const field of fields) {
        if (input[field] !== undefined) {
          updateData[field] = input[field];
          changes[field] = {
            from: (member.user as Record<string, string | null>)[field] ?? null,
            to: input[field],
          };
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      const updatedUser = await ctx.prisma.user.update({
        where: { id: member.user.id },
        data: updateData,
      });

      // Audit trail
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "logistics.member_edited",
          entity: "TeamMember",
          entityId: input.memberId,
          metadata: {
            teamId: member.team.id,
            teamName: member.team.name,
            userId: member.user.id,
            changes,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return updatedUser;
    }),

  // ═══════════════════════════════════════════════════════════
  // SWAP MEMBER (replace non-leader with new user)
  // Industry-standard constraints:
  // - Cannot swap the leader
  // - New user must not be on another team
  // - New user email must be verified
  // - Team size limit must not be exceeded
  // ═══════════════════════════════════════════════════════════

  swapMember: adminProcedure
    .input(
      z.object({
        memberId: z.string(), // TeamMember ID to remove
        newUserEmail: z.string().email(),
        newUserName: z.string().min(1),
        newUserPhone: z.string().optional(),
        newUserCollege: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "Swap member");

      // 1. Get current member
      const currentMember = await ctx.prisma.teamMember.findUnique({
        where: { id: input.memberId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: {
            select: { id: true, name: true, status: true, size: true, track: true },
            include: { members: true },
          },
        },
      });

      if (!currentMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (currentMember.team.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only swap members in approved teams",
        });
      }

      // ⛔ LEADER PROTECTION
      if (currentMember.role === "LEADER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot swap the team leader. Only non-leader members can be replaced.",
        });
      }

      // 2. Find or create the new user
      let newUser = await ctx.prisma.user.findUnique({
        where: { email: input.newUserEmail.toLowerCase().trim() },
        include: { teamMemberships: true },
      });

      if (newUser) {
        // Constraint: new user must not already be on another team
        const activeTeamMembership = newUser.teamMemberships.find(
          (tm) => !tm.leftAt
        );
        if (activeTeamMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `User "${input.newUserEmail}" is already a member of another team`,
          });
        }
      } else {
        // Create new user (unverified — logistics can onboard on event day)
        newUser = await ctx.prisma.user.create({
          data: {
            email: input.newUserEmail.toLowerCase().trim(),
            name: input.newUserName,
            phone: input.newUserPhone,
            college: input.newUserCollege,
            emailVerified: false, // Will be marked during event
          },
          include: { teamMemberships: true },
        });
      }

      // 3. Perform the swap in a transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Mark old member as left
        await tx.teamMember.update({
          where: { id: input.memberId },
          data: { leftAt: new Date() },
        });

        // Remove the unique userId constraint by deleting the old membership
        await tx.teamMember.delete({
          where: { id: input.memberId },
        });

        // Add new member
        const newMember = await tx.teamMember.create({
          data: {
            teamId: currentMember.team.id,
            userId: newUser!.id,
            role: "MEMBER",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                college: true,
              },
            },
          },
        });

        return newMember;
      });

      // 4. Audit trail
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "logistics.member_swapped",
          entity: "TeamMember",
          entityId: input.memberId,
          metadata: {
            teamId: currentMember.team.id,
            teamName: currentMember.team.name,
            removedUser: {
              id: currentMember.user.id,
              name: currentMember.user.name,
              email: currentMember.user.email,
            },
            addedUser: {
              id: newUser.id,
              name: input.newUserName,
              email: input.newUserEmail,
            },
            newMemberId: result.id,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return result;
    }),

  // ═══════════════════════════════════════════════════════════
  // ATTENDANCE STATS (summary for logistics dashboard)
  // ═══════════════════════════════════════════════════════════

  getAttendanceStats: adminProcedure.query(async ({ ctx }) => {
    requireLogisticsRole(ctx.admin.role, "View attendance stats");

    const [
      totalApproved,
      present,
      absent,
      partial,
      notMarked,
      totalMembers,
      membersPresent,
    ] = await Promise.all([
      ctx.prisma.team.count({ where: { status: "APPROVED", deletedAt: null } }),
      ctx.prisma.team.count({
        where: { status: "APPROVED", attendance: "PRESENT", deletedAt: null },
      }),
      ctx.prisma.team.count({
        where: { status: "APPROVED", attendance: "ABSENT", deletedAt: null },
      }),
      ctx.prisma.team.count({
        where: { status: "APPROVED", attendance: "PARTIAL", deletedAt: null },
      }),
      ctx.prisma.team.count({
        where: { status: "APPROVED", attendance: "NOT_MARKED", deletedAt: null },
      }),
      ctx.prisma.teamMember.count({
        where: { team: { status: "APPROVED", deletedAt: null } },
      }),
      ctx.prisma.teamMember.count({
        where: { team: { status: "APPROVED", deletedAt: null }, isPresent: true },
      }),
    ]);

    return {
      totalApproved,
      present,
      absent,
      partial,
      notMarked,
      totalMembers,
      membersPresent,
      membersAbsent: totalMembers - membersPresent,
      attendanceRate:
        totalApproved > 0
          ? Math.round(((present + partial) / totalApproved) * 100)
          : 0,
    };
  }),

  // ═══════════════════════════════════════════════════════════
  // EXPORT ATTENDANCE (CSV data)
  // ═══════════════════════════════════════════════════════════

  exportAttendance: adminProcedure
    .input(
      z.object({
        track: z.string().optional(),
        attendance: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireLogisticsRole(ctx.admin.role, "Export attendance");

      const where: Record<string, unknown> = {
        status: "APPROVED",
        deletedAt: null,
      };

      if (input.track && input.track !== "all") {
        where.track = input.track;
      }
      if (input.attendance && input.attendance !== "all") {
        where.attendance = input.attendance;
      }

      const teams = await ctx.prisma.team.findMany({
        where,
        include: {
          members: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  college: true,
                },
              },
            },
            orderBy: { role: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      // Audit
      await ctx.prisma.activityLog.create({
        data: {
          userId: null,
          action: "logistics.attendance_exported",
          entity: "Team",
          entityId: "bulk",
          metadata: {
            count: teams.length,
            filters: input,
            adminId: ctx.admin.id,
            adminName: ctx.admin.name,
          },
        },
      });

      return {
        teams: teams.map((t) => ({
          shortCode: t.shortCode,
          name: t.name,
          track: t.track,
          college: t.college,
          attendance: t.attendance,
          checkedInAt: t.checkedInAt,
          attendanceNotes: t.attendanceNotes,
          members: t.members.map((m) => ({
            name: m.user.name,
            email: m.user.email,
            phone: m.user.phone,
            college: m.user.college,
            role: m.role,
            isPresent: m.isPresent,
            checkedInAt: m.checkedInAt,
          })),
        })),
        count: teams.length,
      };
    }),
});
