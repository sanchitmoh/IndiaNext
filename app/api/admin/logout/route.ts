import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashSessionToken } from "@/lib/session-security";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;

    if (token) {
      await prisma.adminSession.deleteMany({
        where: { token: hashSessionToken(token) },
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("[Admin Logout] Error:", error);
    return NextResponse.json({ success: true });
  }
}
