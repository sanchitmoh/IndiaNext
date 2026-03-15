/**
 * scan-emitter.ts
 *
 * A singleton Node.js EventEmitter shared across the Next.js server process.
 * When any device calls lookupTeamByCode, the router emits a 'scan' event here.
 * The SSE route at /api/logistics/scan-events listens and streams the event to
 * all connected laptop browsers in real time — no Pusher quota needed.
 */

import { EventEmitter } from 'events';

export interface ScanEvent {
  teamId: string;
  teamName: string;
  shortCode: string;
  track: string;
  college: string | null;
  attendance: string;
  checkedInAt: Date | null;
  members: Array<{
    id: string;
    role: string;
    isPresent: boolean;
    user: { name: string; email: string };
  }>;
  scannedAt: string; // ISO timestamp
  /** The admin ID of the desk that triggered this scan — used for per-desk SSE filtering */
  scannerAdminId: string;
}

// Use a global singleton to survive Next.js hot-reload in development
const g = globalThis as typeof globalThis & { _scanEmitter?: EventEmitter };
if (!g._scanEmitter) {
  g._scanEmitter = new EventEmitter();
  g._scanEmitter.setMaxListeners(50); // Support up to 50 concurrent SSE clients
}

export const scanEmitter = g._scanEmitter;
