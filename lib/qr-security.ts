/**
 * QR Code Security
 *
 * Adds cryptographic security to QR codes to prevent replay attacks.
 * Each QR code includes a nonce, expiry timestamp, and scan limit.
 *
 * Features:
 *   - Cryptographic nonce (16 bytes hex) for uniqueness
 *   - 24-hour expiry timestamp
 *   - 10-scan limit per QR code
 *   - Redis-based scan counter with atomic increment
 *   - Base64 encoding for QR payload
 *
 * QR Payload Structure:
 *   {
 *     shortCode: string,
 *     nonce: string,
 *     expiresAt: number (epoch ms),
 *     maxScans: number
 *   }
 *
 * Redis Structure:
 *   Key: qr:{shortCode}:{nonce}
 *   Value: scan count (integer)
 *   Expiry: 24 hours (matches QR validity)
 *
 * Usage:
 *   // Generate secure QR code
 *   const payload = await generateSecureQRCode('TEAM123');
 *   const qrData = Buffer.from(JSON.stringify(payload)).toString('base64');
 *
 *   // Validate QR code on scan
 *   const result = await validateQRCode(qrData);
 *   if (!result.valid) {
 *     throw new Error(result.reason);
 *   }
 */

import { randomBytes } from 'crypto';
import { getRedis } from './rate-limit';

// ─── Constants ─────────────────────────────────────────────────────────────────

const QR_VALIDITY_HOURS = 24;
const QR_MAX_SCANS = 10;
// QR code expiry in seconds (24 hours)
const _QR_EXPIRY_SECONDS = QR_VALIDITY_HOURS * 60 * 60;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SecureQRPayload {
  shortCode: string;
  nonce: string;
  expiresAt: number; // epoch ms
  maxScans: number;
}

export interface QRValidationResult {
  valid: boolean;
  reason?: string;
  shortCode?: string;
  scansRemaining?: number;
}

// ─── Generate Secure QR Code ───────────────────────────────────────────────────

/**
 * Generate a secure QR code payload with nonce, expiry, and scan limit.
 *
 * @param shortCode - The team short code
 * @param maxScans - Maximum number of scans allowed (default: 10)
 * @param validityHours - QR code validity in hours (default: 24)
 * @returns Secure QR payload object
 */
export async function generateSecureQRCode(
  shortCode: string,
  maxScans: number = QR_MAX_SCANS,
  validityHours: number = QR_VALIDITY_HOURS
): Promise<SecureQRPayload> {
  // Generate cryptographic nonce
  const nonce = randomBytes(16).toString('hex');

  // Calculate expiry timestamp
  const expiresAt = Date.now() + validityHours * 60 * 60 * 1000;

  // Initialize scan counter in Redis
  const client = getRedis();
  if (client) {
    try {
      const key = `qr:${shortCode}:${nonce}`;
      const expirySeconds = validityHours * 60 * 60;

      // Set initial scan count to 0 with expiry
      await client.set(key, '0', { ex: expirySeconds });
    } catch (err) {
      console.error('[QRSecurity] Failed to initialize scan counter in Redis:', err);
    }
  } else {
    console.warn('[QRSecurity] No Redis — scan limits will not be enforced');
  }

  return {
    shortCode,
    nonce,
    expiresAt,
    maxScans,
  };
}

// ─── Validate QR Code ──────────────────────────────────────────────────────────

/**
 * Validate a QR code payload and enforce security checks.
 * Supports both legacy format (plain shortCode) and new format (JSON payload).
 * Checks expiry, nonce validity, and scan limits for new format.
 *
 * @param qrPayload - Base64-encoded QR payload string
 * @returns Validation result with status and reason
 */
export async function validateQRCode(qrPayload: string): Promise<QRValidationResult> {
  try {
    // Decode base64 payload
    const decoded = Buffer.from(qrPayload, 'base64').toString('utf-8');
    
    // Try to parse as JSON (new format)
    let payload: SecureQRPayload | null = null;
    let shortCode: string;
    
    try {
      const parsedPayload = JSON.parse(decoded);
      if (parsedPayload && typeof parsedPayload === 'object' && parsedPayload.shortCode) {
        payload = parsedPayload as SecureQRPayload;
        shortCode = payload.shortCode;
      } else {
        throw new Error('Invalid payload structure');
      }
    } catch (_jsonError) {
      // Not JSON, treat as legacy format (plain shortCode)
      shortCode = decoded;
      
      // Validate shortCode format (basic validation)
      if (!shortCode || typeof shortCode !== 'string' || shortCode.length < 3) {
        return {
          valid: false,
          reason: 'Invalid QR code format: invalid shortCode',
        };
      }
      
      // For legacy format, just return valid with shortCode
      return {
        valid: true,
        shortCode: shortCode.toUpperCase().trim(),
      };
    }

    // New format validation
    if (!payload) {
      return {
        valid: false,
        reason: 'Invalid QR code format: failed to parse JSON payload',
      };
    }
    
    if (!payload.shortCode || !payload.nonce || !payload.expiresAt || !payload.maxScans) {
      return {
        valid: false,
        reason: 'Invalid QR code format: missing required fields',
      };
    }

    // Check expiry
    const now = Date.now();
    if (now > payload.expiresAt) {
      return {
        valid: false,
        reason: 'QR code has expired',
      };
    }

    // Check scan limit in Redis
    const client = getRedis();
    if (client) {
      try {
        const key = `qr:${payload.shortCode}:${payload.nonce}`;

        // Get current scan count
        const currentCount = await client.get(key);

        if (currentCount === null) {
          // Nonce not found in Redis (expired or never created)
          return {
            valid: false,
            reason: 'QR code nonce not found or expired',
          };
        }

        const scanCount = Number(currentCount);

        // Check if scan limit exceeded
        if (scanCount >= payload.maxScans) {
          return {
            valid: false,
            reason: `QR code scan limit exceeded (${payload.maxScans} scans)`,
          };
        }

        // Atomically increment scan counter
        const newCount = await client.incr(key);

        return {
          valid: true,
          shortCode: shortCode,
          scansRemaining: payload.maxScans - newCount,
        };
      } catch (err) {
        console.error('[QRSecurity] Redis error during validation:', err);
        // Fall through to allow scan without Redis (degraded mode)
      }
    }

    // Redis unavailable - allow scan but log warning
    console.warn('[QRSecurity] No Redis — scan limits not enforced');
    return {
      valid: true,
      shortCode: shortCode,
      scansRemaining: undefined, // Unknown without Redis
    };
  } catch (err) {
    console.error('[QRSecurity] QR validation error:', err);
    return {
      valid: false,
      reason: 'Invalid QR code format: failed to parse payload',
    };
  }
}

// ─── Helper: Encode QR Payload to Base64 ───────────────────────────────────────

/**
 * Encode a secure QR payload to base64 string for QR code generation.
 *
 * @param payload - Secure QR payload object
 * @returns Base64-encoded string
 */
export function encodeQRPayload(payload: SecureQRPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// ─── Helper: Get QR Code Info (without incrementing) ───────────────────────────

/**
 * Get information about a QR code without incrementing scan counter.
 * Useful for admin inspection or debugging.
 *
 * @param qrPayload - Base64-encoded QR payload string
 * @returns QR code information or null if invalid
 */
export async function getQRCodeInfo(
  qrPayload: string
): Promise<(SecureQRPayload & { currentScans: number }) | null> {
  try {
    const decoded = Buffer.from(qrPayload, 'base64').toString('utf-8');
    const payload: SecureQRPayload = JSON.parse(decoded);

    const client = getRedis();
    let currentScans = 0;

    if (client) {
      try {
        const key = `qr:${payload.shortCode}:${payload.nonce}`;
        const count = await client.get(key);
        currentScans = count !== null ? Number(count) : 0;
      } catch (err) {
        console.error('[QRSecurity] Failed to get scan count:', err);
      }
    }

    return {
      ...payload,
      currentScans,
    };
  } catch (err) {
    console.error('[QRSecurity] Failed to get QR info:', err);
    return null;
  }
}
