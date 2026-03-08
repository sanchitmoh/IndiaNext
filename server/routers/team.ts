// Team Router - For post-registration team management
// NOTE: Initial registration uses REST API (/api/register)
// This router is for managing teams after registration

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const teamRouter = router({
  // Get my teams
  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    const teams = await ctx.prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: ctx.session.user.id,
          },
        },
        deletedAt: null,
      },
      include: {
        members: {
          include: {
            user: {
              // ✅ SECURITY FIX: Select only safe fields instead of `user: true`
              select: {
                id: true,
                name: true,
                email: true,
                college: true,
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
        tags: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return teams;
  }),

  // Get team by ID
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const team = await ctx.prisma.team.findUnique({
      // ✅ BUG FIX: Exclude soft-deleted teams
      where: { id: input.id, deletedAt: null },
      include: {
        members: {
          include: {
            user: {
              // ✅ SECURITY FIX: Select only safe fields
              select: {
                id: true,
                name: true,
                email: true,
                college: true,
                role: true,
              },
            },
          },
        },
        submission: {
          include: { files: true },
        },
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
        },
        tags: true,
      },
    });

    if (!team) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
    }

    // Check if user is member
    const isMember = team.members.some((m: { userId: string }) => m.userId === ctx.session.user.id);
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a team member' });
    }

    return team;
  }),

  // Update submission (after initial registration)
  updateSubmission: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        data: z.object({
          // IdeaSprint fields
          ideaTitle: z.string().optional(),
          problemStatement: z.string().optional(),
          proposedSolution: z.string().optional(),
          targetUsers: z.string().optional(),
          expectedImpact: z.string().optional(),
          techStack: z.string().optional(),
          marketSize: z.string().optional(),
          competitors: z.string().optional(),
          // BuildStorm fields
          problemDesc: z.string().optional(),
          githubLink: z.string().url().optional().or(z.literal('')),
          demoLink: z.string().url().optional().or(z.literal('')),
          techStackUsed: z.string().optional(),
          challenges: z.string().optional(),
          futureScope: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is team leader
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: { members: true },
      });

      if (!team) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      }

      // ✅ BUG FIX: Only team leader can update submissions
      const isLeader = team.members.some(
        (m: { userId: string; role: string }) =>
          m.userId === ctx.session.user.id && m.role === 'LEADER'
      );
      if (!isLeader) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only team leader can update submission',
        });
      }

      // Don't allow updates if already submitted
      if (team.status !== 'DRAFT' && team.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update submission after review',
        });
      }

      // Upsert submission
      const submission = await ctx.prisma.submission.upsert({
        where: { teamId: input.teamId },
        create: {
          teamId: input.teamId,
          ...input.data,
          lastEditedAt: new Date(),
        },
        update: {
          ...input.data,
          lastEditedAt: new Date(),
        },
      });

      // Log activity
      await ctx.prisma.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'submission.updated',
          entity: 'Submission',
          entityId: submission.id,
          metadata: {
            teamId: input.teamId,
            teamName: team.name,
          },
        },
      });

      return submission;
    }),

  // Submit for review
  submitForReview: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: { members: true, submission: true },
      });

      if (!team) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      }

      // ✅ BUG FIX: Check for soft-deleted team
      if (team.deletedAt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      }

      const isMember = team.members.some(
        (m: { userId: string }) => m.userId === ctx.session.user.id
      );
      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a team member' });
      }

      if (!team.submission) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No submission found' });
      }

      if (team.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Team already submitted',
        });
      }

      // Update submission and team status
      await ctx.prisma.$transaction([
        ctx.prisma.submission.update({
          where: { id: team.submission.id },
          data: { submittedAt: new Date() },
        }),
        ctx.prisma.team.update({
          where: { id: input.teamId },
          data: { status: 'PENDING' },
        }),
        ctx.prisma.activityLog.create({
          data: {
            userId: ctx.session.user.id,
            action: 'team.submitted',
            entity: 'Team',
            entityId: input.teamId,
            metadata: {
              teamName: team.name,
              track: team.track,
            },
          },
        }),
      ]);

      // Create notifications for all team members
      const notificationPromises = team.members.map((member: { userId: string }) =>
        ctx.prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'STATUS_UPDATE',
            title: 'Submission Received',
            message: `Your team "${team.name}" has been submitted for review.`,
            link: `/team/${team.id}`,
          },
        })
      );

      await Promise.all(notificationPromises);

      return { success: true };
    }),

  // Withdraw submission
  withdraw: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.teamId },
        include: { members: true },
      });

      if (!team) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      }

      // Only leader can withdraw
      const isLeader = team.members.some(
        (m: { userId: string; role: string }) =>
          m.userId === ctx.session.user.id && m.role === 'LEADER'
      );
      if (!isLeader) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only team leader can withdraw',
        });
      }

      // ✅ BUG FIX: Block UNDER_REVIEW as well — only PENDING teams can be withdrawn
      if (
        team.status === 'APPROVED' ||
        team.status === 'REJECTED' ||
        team.status === 'UNDER_REVIEW'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot withdraw after final decision or while under review',
        });
      }

      await ctx.prisma.team.update({
        where: { id: input.teamId },
        data: { status: 'WITHDRAWN' },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'team.withdrawn',
          entity: 'Team',
          entityId: input.teamId,
        },
      });

      return { success: true };
    }),
});
