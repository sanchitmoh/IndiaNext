import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashSessionToken } from "@/lib/session-security";

/**
 * Verify admin authentication
 */
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { token: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.admin;
}

/**
 * GET /api/admin/teams/[teamId]/members
 * 
 * Fetch team members for filter dropdown
 * 
 * @param req - Next.js request object
 * @param params - Route parameters containing teamId
 * @returns JSON response with team members
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    // 1. Authenticate admin
    const admin = await verifyAdmin();
    
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is admin (all admin roles can view team members)
    if (!["ADMIN", "SUPER_ADMIN", "ORGANIZER", "JUDGE", "LOGISTICS"].includes(admin.role)) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin access required" },
        { status: 403 }
      );
    }

    // 2. Get teamId from params
    const { teamId } = await params;

    // 3. Fetch team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    // 4. Format response
    const members = teamMembers.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    }));

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to fetch team members",
      },
      { status: 500 }
    );
  }
}
