// Authentication Helper Functions
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// ── Participant auth (OTP-based, session_token cookie) ──────

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    // ✅ SECURITY FIX: Clean up expired session from DB
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return {
    user: session.user,
    token: session.token,
  };
}

// ── Admin auth (password-based, admin_token cookie) ─────────

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    // ✅ SECURITY FIX: Clean up expired admin session from DB
    if (session) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return {
    admin: session.admin,
    token: session.token,
  };
}

export async function checkAdminAuth() {
  const session = await getAdminSession();

  if (!session) {
    return null;
  }

  if (!session.admin.isActive) {
    return null;
  }

  return session.admin;
}

// ── Convenience helpers ─────────────────────────────────────

export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireAdminAuth() {
  const admin = await checkAdminAuth();
  
  if (!admin) {
    throw new Error("Admin access required");
  }

  return admin;
}
