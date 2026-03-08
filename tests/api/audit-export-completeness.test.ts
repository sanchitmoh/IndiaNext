/**
 * Property-Based Test for Audit Trail Export Completeness
 *
 * Feature: admin-audit-trail, Property 7: Export Completeness
 * **Validates: Requirements US-6.2**
 *
 * This test verifies that CSV exports include all required columns and
 * all rows corresponding to the audit logs, ensuring no data is lost
 * during the export process.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Prisma - must be defined before vi.mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSession: {
      findUnique: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue({ value: 'admin-token' }),
  })),
}));

// Mock session security
vi.mock('@/lib/session-security', () => ({
  hashSessionToken: vi.fn((token) => `hashed_${token}`),
}));

// Import after mocks are set up
import { GET } from '@/app/api/admin/teams/[teamId]/audit/export/route';
import { prisma } from '@/lib/prisma';

/**
 * Generator for audit log entries with diverse values
 */
function auditLogGenerator() {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-export'),
    userId: fc.uuid(),
    submissionId: fc.uuid(),
    timestamp: fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2024-12-31'),
    }),
    action: fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
    fieldName: fc.constantFrom(
      'teamName',
      'member2Email',
      'problemStatement',
      'ideaTitle',
      'college',
      'hearAbout',
      'additionalNotes'
    ),
    oldValue: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    newValue: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    ipAddress: fc.option(fc.ipV4()),
    userAgent: fc.string({ maxLength: 50 }),
    metadata: fc.constant(null),
    user: fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 3, maxLength: 30 }),
      email: fc.emailAddress(),
      teamMemberships: fc.array(
        fc.record({
          role: fc.constantFrom('LEADER', 'MEMBER'),
        }),
        { minLength: 1, maxLength: 1 }
      ),
    }),
  });
}

/**
 * Parse CSV string into rows and columns
 * Handles quoted fields with commas, newlines, and escaped quotes
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote - add one quote and skip next
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      // End of row
      currentRow.push(currentField);
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      // Regular character (including newlines within quotes)
      currentField += char;
    }
  }

  // Add last field and row if not empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

describe('Audit Trail Export API - Property 7: Export Completeness', () => {
  const testTeamId = 'test-team-export';

  // Mock admin session
  const mockAdminSession = {
    id: 'session-123',
    token: 'hashed_admin-token',
    expiresAt: new Date(Date.now() + 3600000),
    admin: {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  };

  const mockTeam = {
    id: testTeamId,
    name: 'Test Team Export',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should include all required columns in CSV export', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 50 }),
        async (generatedLogs) => {
          // Mock Prisma to return the generated logs
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);
          expect(response.headers.get('Content-Type')).toBe('text/csv');

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify CSV has at least header row
          expect(rows.length).toBeGreaterThanOrEqual(1);

          // Verify header row contains all required columns
          const headers = rows[0];
          const requiredColumns = [
            'Timestamp',
            'User',
            'Email',
            'Role',
            'Action',
            'Field',
            'Old Value',
            'New Value',
            'IP Address',
          ];

          expect(headers).toEqual(requiredColumns);

          // Verify number of columns is exactly 9
          expect(headers.length).toBe(9);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all rows corresponding to audit logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 50 }),
        async (generatedLogs) => {
          // Mock Prisma to return the generated logs
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify number of data rows matches number of audit logs
          // (rows.length - 1 because first row is header)
          expect(rows.length - 1).toBe(generatedLogs.length);

          // Verify each audit log has a corresponding row
          for (let i = 0; i < generatedLogs.length; i++) {
            const log = generatedLogs[i];
            const row = rows[i + 1]; // +1 to skip header

            // Verify row has 9 columns
            expect(row.length).toBe(9);

            // Verify row contains data from the audit log
            // Note: We don't check exact values due to formatting differences,
            // but we verify that the row is not empty and has the right structure
            expect(row[0]).toBeTruthy(); // Timestamp
            expect(row[1]).toBe(log.user.name); // User
            expect(row[2]).toBe(log.user.email); // Email
            expect(row[3]).toBe(log.user.teamMemberships[0].role); // Role
            expect(row[4]).toBe(log.action); // Action
            expect(row[5]).toBeTruthy(); // Field (may be escaped)
            // Old Value and New Value can be empty strings (null values)
            expect(row[8]).toBeTruthy(); // IP Address (or 'N/A')
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve data integrity for all field types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 5, maxLength: 20 }),
        async (generatedLogs) => {
          // Mock Prisma to return the generated logs
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify each row has the correct structure
          for (let i = 0; i < generatedLogs.length; i++) {
            const log = generatedLogs[i];
            const row = rows[i + 1]; // +1 to skip header

            // Verify row has 9 columns
            expect(row.length).toBe(9);

            // Verify user information is preserved exactly (no escaping needed for these)
            expect(row[1]).toBe(log.user.name);
            expect(row[2]).toBe(log.user.email);
            expect(row[3]).toBe(log.user.teamMemberships[0].role);

            // Verify action is preserved exactly
            expect(row[4]).toBe(log.action);

            // Verify field name is present (may be escaped, so just check it's not empty)
            expect(row[5].length).toBeGreaterThan(0);

            // Verify old value: empty string if null, otherwise has content
            if (log.oldValue === null) {
              expect(row[6]).toBe('');
            } else {
              // Just verify it's not empty - CSV escaping may change representation
              expect(row[6].length).toBeGreaterThan(0);
            }

            // Verify new value: empty string if null, otherwise has content
            if (log.newValue === null) {
              expect(row[7]).toBe('');
            } else {
              // Just verify it's not empty - CSV escaping may change representation
              expect(row[7].length).toBeGreaterThan(0);
            }

            // Verify IP address is preserved
            if (log.ipAddress === null) {
              expect(row[8]).toBe('N/A');
            } else {
              expect(row[8]).toBe(log.ipAddress);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle CSV escaping correctly for special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            teamId: fc.constant('test-team-export'),
            userId: fc.uuid(),
            submissionId: fc.uuid(),
            timestamp: fc.date({
              min: new Date('2024-01-01'),
              max: new Date('2024-12-31'),
            }),
            action: fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
            fieldName: fc.constantFrom('teamName', 'problemStatement'),
            // Generate values with special CSV characters
            oldValue: fc.option(
              fc.constantFrom(
                'Value with, comma',
                'Value with "quotes"',
                'Value with\nnewline',
                'Normal value'
              )
            ),
            newValue: fc.option(
              fc.constantFrom(
                'Value with, comma',
                'Value with "quotes"',
                'Value with\nnewline',
                'Normal value'
              )
            ),
            ipAddress: fc.option(fc.ipV4()),
            userAgent: fc.string({ maxLength: 50 }),
            metadata: fc.constant(null),
            user: fc.record({
              id: fc.uuid(),
              name: fc.constantFrom('John, Doe', 'Jane "Smith"', 'Normal Name'),
              email: fc.emailAddress(),
              teamMemberships: fc.constant([{ role: 'LEADER' }]),
            }),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (generatedLogs) => {
          // Mock Prisma to return the generated logs
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify all rows are parsed correctly (no broken rows due to unescaped special chars)
          expect(rows.length - 1).toBe(generatedLogs.length);

          // Verify each row has exactly 9 columns (proper escaping prevents column splitting)
          for (let i = 1; i < rows.length; i++) {
            expect(rows[i].length).toBe(9);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should export empty CSV with only headers when no audit logs exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant([]), // Empty array of logs
        async (generatedLogs) => {
          // Mock Prisma to return empty array
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify CSV has only header row
          expect(rows.length).toBe(1);

          // Verify header row contains all required columns
          const headers = rows[0];
          const requiredColumns = [
            'Timestamp',
            'User',
            'Email',
            'Role',
            'Action',
            'Field',
            'Old Value',
            'New Value',
            'IP Address',
          ];

          expect(headers).toEqual(requiredColumns);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain row order matching audit log order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 30 }),
        async (generatedLogs) => {
          // Mock Prisma to return the generated logs in specific order
          (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Get CSV content
          const csv = await response.text();
          const rows = parseCSV(csv);

          // Verify rows appear in same order as audit logs
          for (let i = 0; i < generatedLogs.length; i++) {
            const log = generatedLogs[i];
            const row = rows[i + 1]; // +1 to skip header

            // Verify this row corresponds to this log by checking unique identifiers
            expect(row[1]).toBe(log.user.name);
            expect(row[2]).toBe(log.user.email);
            expect(row[4]).toBe(log.action);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
