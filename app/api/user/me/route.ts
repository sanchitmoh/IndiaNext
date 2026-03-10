import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session-security';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: hashSessionToken(sessionToken) },
      include: {
        user: {
          include: {
            teamMemberships: {
              include: {
                team: {
                  include: {
                    members: {
                      include: { user: true },
                      orderBy: { id: 'asc' }
                    },
                    submission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const { user } = session;
    const { searchParams } = new URL(req.url);
    const requestedTrack = searchParams.get('track');

    if (!user.teamMemberships || user.teamMemberships.length === 0) {
      return NextResponse.json({ success: false, error: 'NO_TEAM_FOUND' }, { status: 404 });
    }

    // If multiple teams and no track selected, return selection option
    if (user.teamMemberships.length > 1 && !requestedTrack) {
      return NextResponse.json({
        success: true,
        multipleTeams: true,
        teams: user.teamMemberships.map(m => ({
          id: m.team.id,
          name: m.team.name,
          track: m.team.track,
          trackDisplay: m.team.track === 'IDEA_SPRINT' 
            ? 'Track 2: IdeaSprint - Build MVP in 24 Hours'
            : 'Track 1: BuildStorm - Solve Problem Statement in 24 Hours'
        }))
      });
    }

    // Pick specific track if requested, otherwise default to first
    let selectedMembership = user.teamMemberships[0];
    if (requestedTrack) {
      const match = user.teamMemberships.find(m => m.team.track === requestedTrack);
      if (match) selectedMembership = match;
    }

    const teamRecord = selectedMembership.team;
    const teamMembers = teamRecord.members;
    
    // 🚩 CHECK LOCK STATUS: Has this team already been updated?
    const existingUpdateLog = await prisma.activityLog.findFirst({
      where: {
        entityId: teamRecord.id,
        action: 'team.updated'
      }
    });
    const isLocked = !!existingUpdateLog;

    // Identify the "Leader" as the current user for form mapping purposes
    const leaderMembership = teamMembers.find(m => m.userId === user.id) || teamMembers[0];
    const otherMemberships = teamMembers.filter(m => m.id !== leaderMembership.id);

    const trackString = teamRecord.track === 'IDEA_SPRINT' 
      ? 'Track 2: IdeaSprint - Build MVP in 24 Hours'
      : 'Track 1: BuildStorm - Solve Problem Statement in 24 Hours';

    // Map Prisma to HackathonForm 'Answers' format
    const answers: Record<string, any> = {
      track: trackString,
      teamId: teamRecord.id,
      teamName: teamRecord.name,
      teamSize: `${teamRecord.size} Members`,
      hearAbout: teamRecord.hearAbout || '',

      // leader
      leaderName: leaderMembership.user.name,
      leaderGender: leaderMembership.user.gender || '',
      leaderEmail: leaderMembership.user.email,
      leaderMobile: leaderMembership.user.phone || '',
      leaderCollege: leaderMembership.user.college || '',
      leaderDegree: leaderMembership.user.degree || '',
      
      // agreement arrays
      consent: ["I confirm all details submitted are correct.", "I agree to receive updates via Email/WhatsApp.", "I understand participation is subject to verification."]
    };

    if (otherMemberships[0]) {
      answers.member2Name = otherMemberships[0].user.name;
      answers.member2Gender = otherMemberships[0].user.gender || '';
      answers.member2Email = otherMemberships[0].user.email;
      answers.member2College = otherMemberships[0].user.college || '';
      answers.member2Degree = otherMemberships[0].user.degree || '';
    }

    if (otherMemberships[1]) {
      answers.member3Name = otherMemberships[1].user.name;
      answers.member3Gender = otherMemberships[1].user.gender || '';
      answers.member3Email = otherMemberships[1].user.email;
      answers.member3College = otherMemberships[1].user.college || '';
      answers.member3Degree = otherMemberships[1].user.degree || '';
    }

    if (otherMemberships[2]) {
      answers.member4Name = otherMemberships[2].user.name;
      answers.member4Gender = otherMemberships[2].user.gender || '';
      answers.member4Email = otherMemberships[2].user.email;
      answers.member4College = otherMemberships[2].user.college || '';
      answers.member4Degree = otherMemberships[2].user.degree || '';
    }

    let assignedProblem = null;
    const sub = teamRecord.submission;
    if (sub) {
      if (teamRecord.track === 'IDEA_SPRINT') {
        answers.ideaTitle = sub.ideaTitle || '';
        answers.problemStatement = sub.problemStatement || '';
        answers.proposedSolution = sub.proposedSolution || '';
        answers.targetUsers = sub.targetUsers || '';
        answers.expectedImpact = sub.expectedImpact || '';
        answers.techStack = sub.techStack || '';
        answers.docLink = sub.docLink || '';
        answers.githubLink = sub.githubLink || '';
        answers.githubLinkIdea = sub.githubLink || ''; // pre-fill the IdeaSprint-specific question ID
        answers.ideaAdditionalNotes = teamRecord.additionalNotes || '';
        answers.ideaRules = [
          "I confirm that this idea is original and not copied.",
          "I agree that plagiarism will lead to disqualification.",
          "I agree organizers may use idea name for promotion.",
          "I understand judges decision is final.",
          "I agree to maintain respectful communication."
        ];
      } else {
        answers.problemDesc = sub.problemDesc || '';
        answers.githubLink = sub.githubLink || '';
        answers.buildAdditionalNotes = teamRecord.additionalNotes || '';
        answers.buildRules = [
          "I agree MVP must be built during 24-hour hackathon.",
          "I agree reused pre-built projects lead to disqualification.",
          "I agree to submit GitHub repo link with full source code.",
          "I agree to submit deployed demo link before deadline.",
          "I agree plagiarism leads to disqualification.",
          "I agree to follow code of conduct.",
          "I agree organizers decision is final."
        ];
        
        if (sub.assignedProblemStatementId) {
          const problemStmt = await prisma.problemStatement.findUnique({
             where: { id: sub.assignedProblemStatementId }
          });
          if (problemStmt) {
            assignedProblem = {
              id: problemStmt.id,
              title: problemStmt.title,
              objective: problemStmt.objective,
              description: problemStmt.description,
              extensionsRemaining: 0
            };
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: answers,
      initialAssignedProblem: assignedProblem,
      isLocked: isLocked
    });
  } catch (error) {
    console.error('Fetch me error:', error);
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
