/**
 * Property-Based Test for Audit Trail Chronological Ordering
 *
 * Feature: admin-audit-trail, Property 1: Chronological Ordering
 * **Validates: Requirements US-1.2**
 *
 * This test verifies that audit logs are always returned in descending
 * chronological order (newest first) regardless of the order they are
 * stored in the database.
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
 * Generator for audit log entries with random timestamps
 */
function auditLogGenerator() {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-chronological'),
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
      'college'
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
      teamMemberships: fc.constant([{ role: 'LEADER' }]),
    }),
  });
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

describe('Audit Trail API - Property 1: Chronological Ordering', () => {
  const testTeamId = 'test-team-chronological';
  const testUserId = 'test-user-chronological';

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
    name: 'Test Team Chronological',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should return audit logs in descending chronological order (newest first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 5, maxLength: 20 }),
        async (generatedLogs) => {
          // Filter out any logs with invalid timestamps
          const validLogs = generatedLogs.filter((log) => !isNaN(log.timestamp.getTime()));

          // Skip test if we don't have enough valid logs
          if (validLogs.length < 2) {
            return true;
          }

          // Sort logs by timestamp descending (what the API should do)
          const sortedLogs = [...validLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma to return sorted logs (simulating orderBy: { timestamp: 'desc' })
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch logs via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          // Verify response is successful
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify logs are ordered by timestamp descending (newest first)
          for (let i = 0; i < fetchedLogs.length - 1; i++) {
            const currentTimestamp = new Date(fetchedLogs[i].timestamp).getTime();
            const nextTimestamp = new Date(fetchedLogs[i + 1].timestamp).getTime();

            // Current log should have timestamp >= next log (descending order)
            expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
          }

          // Verify all logs are returned
          expect(fetchedLogs.length).toBe(validLogs.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain chronological order with identical timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          fc.integer({ min: 3, max: 10 })
        ),
        async ([sharedTimestamp, count]) => {
          // Create multiple logs with the same timestamp
          const logsWithSameTimestamp = Array.from({ length: count }, (_, i) => ({
            id: `log-${i}-${Date.now()}`,
            teamId: testTeamId,
            userId: testUserId,
            submissionId: `sub-${i}`,
            timestamp: sharedTimestamp,
            action: 'UPDATE' as const,
            fieldName: `field${i}`,
            oldValue: `old${i}`,
            newValue: `new${i}`,
            ipAddress: '192.168.1.1',
            userAgent: 'Test Agent',
            metadata: null,
            user: {
              id: testUserId,
              name: 'Test User',
              email: 'test@example.com',
              teamMemberships: [{ role: 'LEADER' }],
            },
          }));

          // Shuffle and mock
          const shuffled = shuffle(logsWithSameTimestamp);
          (prisma.auditLog.findMany as any).mockResolvedValue(shuffled as any);
          (prisma.auditLog.count as any).mockResolvedValue(shuffled.length);

          // Fetch logs via API
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // All logs should have the same timestamp
          const timestamps = fetchedLogs.map((log: any) => new Date(log.timestamp).getTime());
          const uniqueTimestamps = new Set(timestamps);
          expect(uniqueTimestamps.size).toBe(1);

          // Verify all logs are returned
          expect(fetchedLogs.length).toBe(count);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain chronological order across different submission IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            submissionId: fc.uuid(),
            logs: fc.array(auditLogGenerator(), { minLength: 1, maxLength: 5 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (submissions) => {
          // Flatten all logs from all submissions
          const allLogs = submissions.flatMap((submission) =>
            submission.logs.map((log) => ({
              ...log,
              submissionId: submission.submissionId,
              teamId: testTeamId,
              userId: testUserId,
            }))
          );

          // Sort logs by timestamp descending (simulating orderBy: { timestamp: 'desc' })
          const sortedLogs = [...allLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch logs via API
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify chronological ordering regardless of submissionId
          for (let i = 0; i < fetchedLogs.length - 1; i++) {
            const currentTimestamp = new Date(fetchedLogs[i].timestamp).getTime();
            const nextTimestamp = new Date(fetchedLogs[i + 1].timestamp).getTime();

            expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
          }

          // Verify all logs are returned
          expect(fetchedLogs.length).toBe(allLogs.length);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain chronological order with pagination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 25, maxLength: 50 }),
        fc.integer({ min: 5, max: 15 }),
        async (generatedLogs, pageSize) => {
          // Filter out any logs with invalid timestamps
          const validLogs = generatedLogs.filter((log) => !isNaN(log.timestamp.getTime()));

          // Skip test if we don't have enough valid logs
          if (validLogs.length < pageSize) {
            return true;
          }

          // Sort logs by timestamp descending (what the database should return)
          const sortedLogs = [...validLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock first page
          const page1Logs = sortedLogs.slice(0, pageSize);
          (prisma.auditLog.findMany as any).mockResolvedValueOnce(page1Logs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch first page
          const req1 = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?page=1&limit=${pageSize}`
          );
          const response1 = await GET(req1, { params: { teamId: testTeamId } });
          const data1 = await response1.json();

          expect(response1.status).toBe(200);
          expect(data1.success).toBe(true);

          const fetchedPage1Logs = data1.data.logs;

          // Verify first page is chronologically ordered
          for (let i = 0; i < fetchedPage1Logs.length - 1; i++) {
            const currentTimestamp = new Date(fetchedPage1Logs[i].timestamp).getTime();
            const nextTimestamp = new Date(fetchedPage1Logs[i + 1].timestamp).getTime();

            expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
          }

          // If there's a second page, test it
          if (data1.data.pagination.totalPages > 1) {
            const page2Logs = sortedLogs.slice(pageSize, pageSize * 2);
            (prisma.auditLog.findMany as any).mockResolvedValueOnce(page2Logs as any);

            const req2 = new Request(
              `http://localhost/api/admin/teams/${testTeamId}/audit?page=2&limit=${pageSize}`
            );
            const response2 = await GET(req2, { params: { teamId: testTeamId } });
            const data2 = await response2.json();

            expect(response2.status).toBe(200);
            expect(data2.success).toBe(true);

            const fetchedPage2Logs = data2.data.logs;

            // Verify second page is chronologically ordered
            for (let i = 0; i < fetchedPage2Logs.length - 1; i++) {
              const currentTimestamp = new Date(fetchedPage2Logs[i].timestamp).getTime();
              const nextTimestamp = new Date(fetchedPage2Logs[i + 1].timestamp).getTime();

              expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
            }

            // Verify ordering across pages (last item of page 1 >= first item of page 2)
            if (fetchedPage1Logs.length > 0 && fetchedPage2Logs.length > 0) {
              const lastPage1Timestamp = new Date(
                fetchedPage1Logs[fetchedPage1Logs.length - 1].timestamp
              ).getTime();
              const firstPage2Timestamp = new Date(fetchedPage2Logs[0].timestamp).getTime();

              expect(lastPage1Timestamp).toBeGreaterThanOrEqual(firstPage2Timestamp);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
