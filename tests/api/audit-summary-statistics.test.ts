/**
 * Property-Based Tests for Audit Trail Summary Statistics
 *
 * Feature: admin-audit-trail
 * Properties: 10, 11, 12, 13
 *
 * This test file verifies that summary statistics calculations are correct:
 * - Property 10: Summary Total Edits - **Validates: Requirements US-7.1**
 * - Property 11: Summary Last Edit Date - **Validates: Requirements US-7.2**
 * - Property 12: Summary Most Active User - **Validates: Requirements US-7.3**
 * - Property 13: Summary Top Changed Fields - **Validates: Requirements US-7.4**
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
      count: vi.fn(),
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
import { GET } from '@/app/api/admin/teams/[teamId]/audit/route';
import { prisma } from '@/lib/prisma';

/**
 * Generator for audit log entries with configurable properties
 */
function auditLogGenerator() {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-summary'),
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
      'additionalNotes',
      'proposedSolution'
    ),
    oldValue: fc.option(fc.string({ maxLength: 100 })),
    newValue: fc.option(fc.string({ maxLength: 100 })),
    ipAddress: fc.ipV4(),
    userAgent: fc.string({ maxLength: 50 }),
    metadata: fc.constant(null),
    user: fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 3, maxLength: 30 }),
      email: fc.emailAddress(),
      teamMemberships: fc.constantFrom([{ role: 'LEADER' }], [{ role: 'MEMBER' }]),
    }),
  });
}

describe('Audit Trail API - Summary Statistics Properties', () => {
  const testTeamId = 'test-team-summary';

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
    name: 'Test Team Summary',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  describe('Property 10: Summary Total Edits', () => {
    it('should equal the count of distinct submissionId values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 1, maxLength: 50 }),
          async (generatedLogs) => {
            // Mock Prisma to return the generated logs
            (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(generatedLogs.length);

            // Fetch logs via API endpoint
            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Calculate expected total edits (distinct submissionIds)
            const distinctSubmissionIds = new Set(generatedLogs.map((log) => log.submissionId));
            const expectedTotalEdits = distinctSubmissionIds.size;

            // Verify summary total edits matches expected
            expect(data.success).toBe(true);
            expect(data.data.summary.totalEdits).toBe(expectedTotalEdits);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be 0 for teams with no audit logs', async () => {
      // Mock empty audit logs
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.totalEdits).toBe(0);
    });

    it('should count multiple logs with same submissionId as one edit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(auditLogGenerator(), { minLength: 2, maxLength: 10 }),
          async (sharedSubmissionId, generatedLogs) => {
            // Set all logs to have the same submissionId
            const logsWithSameSubmission = generatedLogs.map((log) => ({
              ...log,
              submissionId: sharedSubmissionId,
            }));

            (prisma.auditLog.findMany as any).mockResolvedValue(logsWithSameSubmission as any);
            (prisma.auditLog.count as any).mockResolvedValue(logsWithSameSubmission.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Should count as 1 edit since all have same submissionId
            expect(data.success).toBe(true);
            expect(data.data.summary.totalEdits).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Summary Last Edit Date', () => {
    it('should equal the maximum timestamp value across all audit logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 1, maxLength: 50 }),
          async (generatedLogs) => {
            // Filter out invalid timestamps
            const validLogs = generatedLogs.filter((log) => !isNaN(log.timestamp.getTime()));

            if (validLogs.length === 0) {
              return true; // Skip if no valid logs
            }

            (prisma.auditLog.findMany as any).mockResolvedValue(validLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(validLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Calculate expected last edit date (max timestamp)
            const expectedLastEditDate = validLogs.reduce((max, log) => {
              return log.timestamp > max ? log.timestamp : max;
            }, validLogs[0].timestamp);

            // Verify summary last edit date matches expected
            expect(data.success).toBe(true);
            expect(new Date(data.data.summary.lastEditDate).getTime()).toBe(
              expectedLastEditDate.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be null for teams with no audit logs', async () => {
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.lastEditDate).toBeNull();
    });

    it('should handle logs with identical timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .date({
              min: new Date('2024-01-01'),
              max: new Date('2024-12-31'),
            })
            .filter((d) => !isNaN(d.getTime())), // Filter out invalid dates
          fc.array(auditLogGenerator(), { minLength: 2, maxLength: 10 }),
          async (sharedTimestamp, generatedLogs) => {
            // Set all logs to have the same timestamp
            const logsWithSameTimestamp = generatedLogs.map((log) => ({
              ...log,
              timestamp: sharedTimestamp,
            }));

            (prisma.auditLog.findMany as any).mockResolvedValue(
              logsWithSameTimestamp as any
            );
            (prisma.auditLog.count as any).mockResolvedValue(
              logsWithSameTimestamp.length
            );

            const req = new Request(
              `http://localhost/api/admin/teams/${testTeamId}/audit`
            );
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Should return the shared timestamp
            expect(data.success).toBe(true);
            expect(new Date(data.data.summary.lastEditDate).getTime()).toBe(
              sharedTimestamp.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Summary Most Active User', () => {
    it('should be the user with the highest count of audit log entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 5, maxLength: 50 }),
          async (generatedLogs) => {
            (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(generatedLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Calculate expected most active user
            const userCounts = new Map<string, { user: any; count: number }>();
            for (const log of generatedLogs) {
              const existing = userCounts.get(log.userId);
              if (existing) {
                existing.count++;
              } else {
                userCounts.set(log.userId, { user: log.user, count: 1 });
              }
            }

            let expectedMostActiveUser = null;
            let maxCount = 0;
            for (const [_userId, data] of userCounts) {
              if (data.count > maxCount) {
                maxCount = data.count;
                expectedMostActiveUser = {
                  id: data.user.id,
                  name: data.user.name,
                  email: data.user.email,
                  count: data.count,
                  role: data.user.teamMemberships[0]?.role || 'MEMBER',
                };
              }
            }

            // Verify summary most active user matches expected
            expect(data.success).toBe(true);
            if (expectedMostActiveUser) {
              expect(data.data.summary.mostActiveUser).not.toBeNull();
              expect(data.data.summary.mostActiveUser.id).toBe(expectedMostActiveUser.id);
              expect(data.data.summary.mostActiveUser.count).toBe(expectedMostActiveUser.count);
              expect(data.data.summary.mostActiveUser.count).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be null for teams with no audit logs', async () => {
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.mostActiveUser).toBeNull();
    });

    it('should include user details (id, name, email, count, role)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 1, maxLength: 20 }),
          async (generatedLogs) => {
            (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(generatedLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            expect(data.success).toBe(true);
            if (data.data.summary.mostActiveUser) {
              const mostActive = data.data.summary.mostActiveUser;

              // Verify all required fields are present
              expect(mostActive).toHaveProperty('id');
              expect(mostActive).toHaveProperty('name');
              expect(mostActive).toHaveProperty('email');
              expect(mostActive).toHaveProperty('count');
              expect(mostActive).toHaveProperty('role');

              // Verify types
              expect(typeof mostActive.id).toBe('string');
              expect(typeof mostActive.name).toBe('string');
              expect(typeof mostActive.email).toBe('string');
              expect(typeof mostActive.count).toBe('number');
              expect(['LEADER', 'MEMBER']).toContain(mostActive.role);

              // Verify count is positive
              expect(mostActive.count).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle ties by returning one of the tied users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(fc.uuid(), fc.uuid()),
          fc.integer({ min: 2, max: 10 }),
          async ([userId1, userId2], count) => {
            // Create equal number of logs for two different users
            const user1Logs = Array.from({ length: count }, (_, i) => ({
              id: `log-user1-${i}`,
              teamId: testTeamId,
              userId: userId1,
              submissionId: `sub-user1-${i}`,
              timestamp: new Date(`2024-01-${i + 1}`),
              action: 'UPDATE' as const,
              fieldName: 'teamName',
              oldValue: 'old',
              newValue: 'new',
              ipAddress: '192.168.1.1',
              userAgent: 'test',
              metadata: null,
              user: {
                id: userId1,
                name: 'User One',
                email: 'user1@test.com',
                teamMemberships: [{ role: 'LEADER' }],
              },
            }));

            const user2Logs = Array.from({ length: count }, (_, i) => ({
              id: `log-user2-${i}`,
              teamId: testTeamId,
              userId: userId2,
              submissionId: `sub-user2-${i}`,
              timestamp: new Date(`2024-02-${i + 1}`),
              action: 'UPDATE' as const,
              fieldName: 'college',
              oldValue: 'old',
              newValue: 'new',
              ipAddress: '192.168.1.2',
              userAgent: 'test',
              metadata: null,
              user: {
                id: userId2,
                name: 'User Two',
                email: 'user2@test.com',
                teamMemberships: [{ role: 'MEMBER' }],
              },
            }));

            const allLogs = [...user1Logs, ...user2Logs];
            (prisma.auditLog.findMany as any).mockResolvedValue(allLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(allLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.summary.mostActiveUser).not.toBeNull();

            // Should return one of the tied users with correct count
            const mostActive = data.data.summary.mostActiveUser;
            expect([userId1, userId2]).toContain(mostActive.id);
            expect(mostActive.count).toBe(count);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Summary Top Changed Fields', () => {
    it('should be ordered by frequency of changes in descending order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 5, maxLength: 50 }),
          async (generatedLogs) => {
            (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(generatedLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            // Calculate expected top changed fields
            const fieldCounts = new Map<string, number>();
            for (const log of generatedLogs) {
              const count = fieldCounts.get(log.fieldName) || 0;
              fieldCounts.set(log.fieldName, count + 1);
            }

            const expectedTopFields = Array.from(fieldCounts.entries())
              .map(([field, count]) => ({ field, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5); // Top 5 fields

            // Verify summary top changed fields matches expected
            expect(data.success).toBe(true);
            const actualTopFields = data.data.summary.topChangedFields;

            // Verify ordering (descending by count)
            for (let i = 0; i < actualTopFields.length - 1; i++) {
              expect(actualTopFields[i].count).toBeGreaterThanOrEqual(actualTopFields[i + 1].count);
            }

            // Verify the fields and counts match expected
            expect(actualTopFields.length).toBeLessThanOrEqual(5);
            expect(actualTopFields.length).toBe(Math.min(expectedTopFields.length, 5));

            for (let i = 0; i < actualTopFields.length; i++) {
              expect(actualTopFields[i].field).toBe(expectedTopFields[i].field);
              expect(actualTopFields[i].count).toBe(expectedTopFields[i].count);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be empty array for teams with no audit logs', async () => {
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.topChangedFields).toEqual([]);
    });

    it('should limit results to top 5 fields', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 6, max: 20 }), async (numFields) => {
          // Create logs with many different fields
          const fieldNames = Array.from({ length: numFields }, (_, i) => `field${i}`);
          const logs = fieldNames.flatMap((fieldName, index) =>
            Array.from({ length: numFields - index }, (_, i) => ({
              id: `log-${fieldName}-${i}`,
              teamId: testTeamId,
              userId: `user-${i}`,
              submissionId: `sub-${fieldName}-${i}`,
              timestamp: new Date(`2024-01-${(i % 28) + 1}`),
              action: 'UPDATE' as const,
              fieldName,
              oldValue: 'old',
              newValue: 'new',
              ipAddress: '192.168.1.1',
              userAgent: 'test',
              metadata: null,
              user: {
                id: `user-${i}`,
                name: `User ${i}`,
                email: `user${i}@test.com`,
                teamMemberships: [{ role: 'MEMBER' }],
              },
            }))
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(logs as any);
          (prisma.auditLog.count as any).mockResolvedValue(logs.length);

          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(data.success).toBe(true);
          expect(data.data.summary.topChangedFields.length).toBeLessThanOrEqual(5);
        }),
        { numRuns: 100 }
      );
    });

    it('should include field name and count for each entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogGenerator(), { minLength: 1, maxLength: 20 }),
          async (generatedLogs) => {
            (prisma.auditLog.findMany as any).mockResolvedValue(generatedLogs as any);
            (prisma.auditLog.count as any).mockResolvedValue(generatedLogs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            expect(data.success).toBe(true);
            const topFields = data.data.summary.topChangedFields;

            for (const entry of topFields) {
              // Verify structure
              expect(entry).toHaveProperty('field');
              expect(entry).toHaveProperty('count');

              // Verify types
              expect(typeof entry.field).toBe('string');
              expect(typeof entry.count).toBe('number');

              // Verify count is positive
              expect(entry.count).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle fields with equal counts by maintaining stable order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          async (numFields, countPerField) => {
            // Create logs where multiple fields have the same count
            const fieldNames = Array.from({ length: numFields }, (_, i) => `field${i}`);
            const logs = fieldNames.flatMap((fieldName, fieldIndex) =>
              Array.from({ length: countPerField }, (_, i) => ({
                id: `log-${fieldName}-${i}`,
                teamId: testTeamId,
                userId: `user-${i}`,
                submissionId: `sub-${fieldName}-${i}`,
                timestamp: new Date(`2024-01-${(i % 28) + 1}`),
                action: 'UPDATE' as const,
                fieldName,
                oldValue: 'old',
                newValue: 'new',
                ipAddress: '192.168.1.1',
                userAgent: 'test',
                metadata: null,
                user: {
                  id: `user-${i}`,
                  name: `User ${i}`,
                  email: `user${i}@test.com`,
                  teamMemberships: [{ role: 'MEMBER' }],
                },
              }))
            );

            (prisma.auditLog.findMany as any).mockResolvedValue(logs as any);
            (prisma.auditLog.count as any).mockResolvedValue(logs.length);

            const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
            const response = await GET(req, { params: { teamId: testTeamId } });
            const data = await response.json();

            expect(data.success).toBe(true);
            const topFields = data.data.summary.topChangedFields;

            // All fields should have the same count
            for (const entry of topFields) {
              expect(entry.count).toBe(countPerField);
            }

            // Should return all fields (up to 5)
            expect(topFields.length).toBe(Math.min(numFields, 5));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
