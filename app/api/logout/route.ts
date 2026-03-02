import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(_req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      // Delete session from database
      await prisma.session.delete({
        where: { token: sessionToken },
      }).catch(() => {
        // Ignore if session doesn't exist
      });
    }

    // Clear the session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('session_token');
    // ✅ SECURITY FIX (M-1): Also clear admin session cookie
    response.cookies.delete('admin_token');

    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    
    // Still clear cookie even if database operation fails
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('session_token');
    // ✅ SECURITY FIX (M-1): Also clear admin session cookie
    response.cookies.delete('admin_token');

    return response;
  }
}
