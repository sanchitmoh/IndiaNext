/**
 * /api/logistics/scan-events — Server-Sent Events endpoint
 *
 * The logistics dashboard on the laptop connects here on load.
 * Whenever lookupTeamByCode fires (mobile or laptop scan), the tRPC router
 * emits to scanEmitter → this route pushes the JSON team data to all SSE
 * clients. Zero external services. Zero quota.
 *
 * Usage (client):
 *   const es = new EventSource('/api/logistics/scan-events');
 *   es.onmessage = (e) => { const team = JSON.parse(e.data); ... };
 */

import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session-security';
import { scanEmitter, type ScanEvent } from '@/lib/scan-emitter';

export const runtime = 'nodejs'; // SSE requires Node.js runtime (not Edge)
export const dynamic = 'force-dynamic';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { token: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.admin;
}

export async function GET(req: NextRequest) {
  // ── Auth guard: only logged-in admins can subscribe ──────────────────────
  const admin = await verifyAdmin();
  if (!admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial connected confirmation so the client knows it's live
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Forward scan events — but ONLY if the scan came from this same admin/desk.
      // Each logistics desk logs in as a unique admin account,
      // so filtering by scannerAdminId prevents cross-desk leakage.
      const onScan = (event: ScanEvent) => {
        if (event.scannerAdminId !== admin.id) return; // ← desk isolation
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client disconnected mid-write — cleaned up below
        }
      };

      scanEmitter.on('scan', onScan);

      // Keep-alive ping every 25s to prevent proxy/CDN timeouts
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        scanEmitter.off('scan', onScan);
        clearInterval(ping);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
    },
  });
}
