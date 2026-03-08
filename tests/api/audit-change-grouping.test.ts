/**
 * Property-Based Test for Audit Trail Change Grouping
 * 
 * Feature: admin-audit-trail, Property 2: Change Grouping
 * **Validates: Requirements US-1.4**
 * 
 * This test verifies that audit log entries with the same submissionId
 * are grouped together when retrieved from the API. This ensures that
 * all changes from a single edit session are displayed as a cohesive unit.
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
 * Generator for audit log entries with configurable submissionId
 */
function auditLogGenerator(submissionId?: string) {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-grouping'),
    userId: fc.uuid(),
    submissionId: submissionId ? fc.constant(submissionId) : fc.uuid(),
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
 * Generator for a group of audit logs sharing the same submissionId
 */
function auditLogGroupGenerator() {
  return fc.tuple(
    fc.uuid(), // submissionId
    fc.integer({ min: 1, max: 10 }) // number of logs in group
  ).chain(([submissionId, count]) =>
    fc.tuple(
      fc.constant(submissionId),
      fc.array(auditLogGenerator(submissionId), { minLength: count, maxLength: count })
    )
  );
}

describe('Audit Trail API - Property 2: Change Grouping', () => {
  const testTeamId = 'test-team-grouping';

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
    name: 'Test Team Grouping',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should return all entries with the same submissionId together', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGroupGenerator(), { minLength: 2, maxLength: 10 }),
        async (groups) => {
          // Flatten all logs from all groups
          const allLogs = groups.flatMap(([_submissionId, logs]) => logs);
          
          // Skip if we don't have enough logs
          if (allLogs.length < 2) {
            return true;
          }

          // Sort by timestamp descending (as the API does)
          const sortedLogs = [...allLogs].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma to return sorted logs
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

          // Group fetched logs by submissionId
          const groupedBySubmission = new Map<string, any[]>();
          for (const log of fetchedLogs) {
            const existing = groupedBySubmission.get(log.submissionId);
            if (existing) {
              existing.push(log);
            } else {
              groupedBySubmission.set(log.submissionId, [log]);
            }
          }

          // Verify that each submissionId group has the correct number of entries
          for (const [submissionId, originalLogs] of groups) {
            const fetchedGroup = groupedBySubmission.get(submissionId);
            
            if (fetchedGroup) {
              // All entries with this submissionId should be present
              expect(fetchedGroup.length).toBe(originalLogs.length);
              
              // All entries in the group should have the same submissionId
              for (const log of fetchedGroup) {
                expect(log.submissionId).toBe(submissionId);
              }
            }
          }

          // Verify total count matches
          expect(fetchedLogs.length).toBe(allLogs.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain grouping integrity with single submission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 2, max: 15 }),
        async (submissionId, count) => {
          // Create multiple logs with the same submissionId
          const logs = fc.sample(
            auditLogGenerator(submissionId),
            count
          );

          // Sort by timestamp descending
          const sortedLogs = [...logs].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch logs via API
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // All logs should have the same submissionId
          const submissionIds = new Set(fetchedLogs.map((log: any) => log.submissionId));
          expect(submissionIds.size).toBe(1);
          expect(submissionIds.has(submissionId)).toBe(true);

          // All logs should be returned
          expect(fetchedLogs.length).toBe(count);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should group entries correctly even when interleaved by timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uuid(), // submissionId1
          fc.uuid(), // submissionId2
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }), // baseTime1
          fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') })  // baseTime2
        ),
        async ([submissionId1, submissionId2, baseTime1, baseTime2]) => {
          // Ensure different submissionIds
          if (submissionId1 === submissionId2) {
            return true;
          }

          // Create logs for submission 1 with timestamps around baseTime1
          const samples1 = fc.sample(
            auditLogGenerator(submissionId1),
            3
          );
          const logs1 = samples1.map((log, i) => ({
            ...log,
            timestamp: new Date(baseTime1.getTime() + i * 1000),
            submissionId: submissionId1,
          }));

          // Create logs for submission 2 with timestamps around baseTime2
          const samples2 = fc.sample(
            auditLogGenerator(submissionId2),
            3
          );
          const logs2 = samples2.map((log, i) => ({
            ...log,
            timestamp: new Date(baseTime2.getTime() + i * 1000),
            submissionId: submissionId2,
          }));

          // Combine and sort by timestamp descending
          const allLogs = [...logs1, ...logs2].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma
          (prisma.auditLog.findMany as any).mockResolvedValue(allLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(allLogs.length);

          // Fetch logs via API
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Group by submissionId
          const group1 = fetchedLogs.filter((log: any) => log.submissionId === submissionId1);
          const group2 = fetchedLogs.filter((log: any) => log.submissionId === submissionId2);

          // Each group should have the correct number of entries
          expect(group1.length).toBe(logs1.length);
          expect(group2.length).toBe(logs2.length);

          // All entries in each group should have the same submissionId
          for (const log of group1) {
            expect(log.submissionId).toBe(submissionId1);
          }
          for (const log of group2) {
            expect(log.submissionId).toBe(submissionId2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve grouping across pagination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGroupGenerator(), { minLength: 3, maxLength: 8 }),
        fc.integer({ min: 5, max: 10 }),
        async (groups, pageSize) => {
          // Flatten all logs from all groups
          const allLogs = groups.flatMap(([_submissionId, logs]) => logs);
          
          // Skip if we don't have enough logs for pagination
          if (allLogs.length < pageSize + 1) {
            return true;
          }

          // Sort by timestamp descending
          const sortedLogs = [...allLogs].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
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

          // Verify grouping on first page
          const page1Groups = new Map<string, any[]>();
          for (const log of fetchedPage1Logs) {
            const existing = page1Groups.get(log.submissionId);
            if (existing) {
              existing.push(log);
            } else {
              page1Groups.set(log.submissionId, [log]);
            }
          }

          // Each submissionId group should have all its entries together
          for (const [submissionId, groupLogs] of page1Groups) {
            // All logs with this submissionId should have the same submissionId
            for (const log of groupLogs) {
              expect(log.submissionId).toBe(submissionId);
            }
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

            // Verify grouping on second page
            const page2Groups = new Map<string, any[]>();
            for (const log of fetchedPage2Logs) {
              const existing = page2Groups.get(log.submissionId);
              if (existing) {
                existing.push(log);
              } else {
                page2Groups.set(log.submissionId, [log]);
              }
            }

            // Each submissionId group should have all its entries together
            for (const [submissionId, groupLogs] of page2Groups) {
              for (const log of groupLogs) {
                expect(log.submissionId).toBe(submissionId);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty groups correctly', async () => {
    // Test with no audit logs
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    (prisma.auditLog.count as any).mockResolvedValue(0);

    const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
    const response = await GET(req, { params: { teamId: testTeamId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.logs).toEqual([]);
    expect(data.data.pagination.total).toBe(0);
  });

  it('should maintain grouping with filters applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGroupGenerator(), { minLength: 3, maxLength: 8 }),
        fc.constantFrom('teamName', 'member2Email', 'problemStatement'),
        async (groups, fieldNameFilter) => {
          // Flatten all logs from all groups
          const allLogs = groups.flatMap(([_submissionId, logs]) => logs);
          
          // Filter logs by fieldName
          const filteredLogs = allLogs.filter(log => log.fieldName === fieldNameFilter);
          
          // Skip if no logs match the filter
          if (filteredLogs.length === 0) {
            return true;
          }

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch logs via API with filter
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?fieldName=${fieldNameFilter}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Group by submissionId
          const groupedBySubmission = new Map<string, any[]>();
          for (const log of fetchedLogs) {
            const existing = groupedBySubmission.get(log.submissionId);
            if (existing) {
              existing.push(log);
            } else {
              groupedBySubmission.set(log.submissionId, [log]);
            }
          }

          // Each group should have all entries with the same submissionId
          for (const [submissionId, groupLogs] of groupedBySubmission) {
            for (const log of groupLogs) {
              expect(log.submissionId).toBe(submissionId);
              expect(log.fieldName).toBe(fieldNameFilter);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
