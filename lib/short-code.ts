import { prisma } from '@/lib/prisma';
import type { Track } from '@prisma/client/edge';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════
// Short Code Generator
// ═══════════════════════════════════════════════════════════
// Generates human-friendly team IDs like "IS-7K3X" or "BS-A9M2"
// instead of raw cuid (e.g. "cm5x7k9g20001qr8s3j4b6h1f")

const TRACK_PREFIX: Record<Track, string> = {
  IDEA_SPRINT: 'IS',
  BUILD_STORM: 'BS',
};

// Uppercase alphanumeric chars excluding ambiguous ones (0/O, 1/I/L)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4; // 30^4 = 810,000 combinations per track
const MAX_RETRIES = 10;

/**
 * Generate a random alphanumeric string of given length
 */
function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

/**
 * Generate a unique short code for a team.
 * Format: {TRACK_PREFIX}-{4 random chars}
 * Examples: IS-7K3X, BS-A9M2
 *
 * Uses collision detection with retry loop.
 * With 810K combos per track, collisions are extremely rare.
 */
export async function generateShortCode(track: Track): Promise<string> {
  const prefix = TRACK_PREFIX[track];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = `${prefix}-${randomCode(CODE_LENGTH)}`;

    // Check if code already exists
    const existing = await prisma.team.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }

    console.warn(`[ShortCode] Collision on attempt ${attempt + 1}: ${code}`);
  }

  // Extremely unlikely fallback: extend to 6 chars
  const fallback = `${prefix}-${randomCode(6)}`;
  console.warn(`[ShortCode] Using extended fallback code: ${fallback}`);
  return fallback;
}

/**
 * Generate a short code inside a Prisma transaction client.
 * Use this when creating teams within $transaction.
 */
export async function generateShortCodeTx(
  tx: { team: { findUnique: (args: { where: { shortCode: string }; select: { id: true } }) => Promise<{ id: string } | null> } },
  track: Track
): Promise<string> {
  const prefix = TRACK_PREFIX[track];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = `${prefix}-${randomCode(CODE_LENGTH)}`;

    const existing = await tx.team.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }

    console.warn(`[ShortCode] Collision on attempt ${attempt + 1}: ${code}`);
  }

  const fallback = `${prefix}-${randomCode(6)}`;
  console.warn(`[ShortCode] Using extended fallback code: ${fallback}`);
  return fallback;
}
