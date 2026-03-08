/**
 * Property-Based Test for Audit Trail Data Completeness
 *
 * Feature: admin-audit-trail, Property 3: Data Completeness
 * **Validates: Requirements US-1.3, US-3.1, US-3.2**
 *
 * This test verifies that all audit log entries returned by the API
 * include all required fields with proper structure. Specifically:
 * - All core audit log fields (id, timestamp, action, fieldName, etc.)
 * - User object with complete information (id, name, email, role)
 * - Metadata fields (ipAddress, userAgent)
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
 * Generator for complete audit log entries with all required fields
 */
function auditLogGenerator() {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-completeness'),
    userId: fc.uuid(),
    submissionId: fc.uuid(),
    timestamp: fc
      .date({
        min: new Date('2024-01-01'),
        max: new Date('2024-12-31'),
      })
      .filter((d) => !isNaN(d.getTime())), // Filter out invalid dates
    action: fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
    fieldName: fc.constantFrom(
      'teamName',
      'member2Email',
      'problemStatement',
      'ideaTitle',
      'college',
      'hearAbout',
      'additionalNotes',
      'proposedSolution',
      'targetUsers',
      'expectedImpact'
    ),
    oldValue: fc.option(fc.string({ maxLength: 200 })),
    newValue: fc.option(fc.string({ maxLength: 200 })),
    ipAddress: fc.ipV4(),
    userAgent: fc.string({ minLength: 10, maxLength: 100 }),
    metadata: fc.constant(null),
    user: fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 3, maxLength: 50 }),
      email: fc.emailAddress(),
      teamMemberships: fc.constantFrom([{ role: 'LEADER' }], [{ role: 'MEMBER' }]),
    }),
  });
}

describe('Audit Trail API - Property 3: Data Completeness', () => {
  const testTeamId = 'test-team-completeness';

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
    name: 'Test Team Completeness',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should return all required fields for every audit log entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 50 }),
        async (logs) => {
          // Sort by timestamp descending (as the API does)
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma to return logs
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

          // Verify each log has all required fields
          for (const log of fetchedLogs) {
            // Core audit log fields
            expect(log).toHaveProperty('id');
            expect(typeof log.id).toBe('string');
            expect(log.id).toBeTruthy();

            expect(log).toHaveProperty('submissionId');
            expect(typeof log.submissionId).toBe('string');
            expect(log.submissionId).toBeTruthy();

            expect(log).toHaveProperty('timestamp');
            // Timestamp is serialized as string in JSON response
            const timestamp = new Date(log.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).not.toBeNaN();

            expect(log).toHaveProperty('action');
            expect(['CREATE', 'UPDATE', 'DELETE']).toContain(log.action);

            expect(log).toHaveProperty('fieldName');
            expect(typeof log.fieldName).toBe('string');
            expect(log.fieldName).toBeTruthy();

            // oldValue and newValue can be null, but must be present
            expect(log).toHaveProperty('oldValue');
            if (log.oldValue !== null) {
              expect(typeof log.oldValue).toBe('string');
            }

            expect(log).toHaveProperty('newValue');
            if (log.newValue !== null) {
              expect(typeof log.newValue).toBe('string');
            }

            // User object must be present and complete
            expect(log).toHaveProperty('user');
            expect(log.user).toBeTruthy();
            expect(typeof log.user).toBe('object');

            // User object required fields
            expect(log.user).toHaveProperty('id');
            expect(typeof log.user.id).toBe('string');
            expect(log.user.id).toBeTruthy();

            expect(log.user).toHaveProperty('name');
            expect(typeof log.user.name).toBe('string');
            expect(log.user.name).toBeTruthy();

            expect(log.user).toHaveProperty('email');
            expect(typeof log.user.email).toBe('string');
            expect(log.user.email).toBeTruthy();
            // Basic email format validation
            expect(log.user.email).toMatch(/@/);

            expect(log.user).toHaveProperty('role');
            expect(['LEADER', 'MEMBER']).toContain(log.user.role);

            // Metadata fields
            expect(log).toHaveProperty('ipAddress');
            if (log.ipAddress !== null) {
              expect(typeof log.ipAddress).toBe('string');
            }

            expect(log).toHaveProperty('userAgent');
            if (log.userAgent !== null) {
              expect(typeof log.userAgent).toBe('string');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure user object is never null or undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 30 }),
        async (logs) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
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

          // Every log must have a user object
          for (const log of fetchedLogs) {
            expect(log.user).toBeDefined();
            expect(log.user).not.toBeNull();
            expect(typeof log.user).toBe('object');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure all user fields are non-empty strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 30 }),
        async (logs) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
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

          // Verify user fields are non-empty
          for (const log of fetchedLogs) {
            expect(log.user.id.length).toBeGreaterThan(0);
            expect(log.user.name.length).toBeGreaterThan(0);
            expect(log.user.email.length).toBeGreaterThan(0);
            expect(log.user.role.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data completeness across pagination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 25, maxLength: 50 }),
        fc.integer({ min: 5, max: 15 }),
        async (logs, pageSize) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Test first page
          const page1Logs = sortedLogs.slice(0, pageSize);
          (prisma.auditLog.findMany as any).mockResolvedValueOnce(page1Logs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          const req1 = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?page=1&limit=${pageSize}`
          );
          const response1 = await GET(req1, { params: { teamId: testTeamId } });
          const data1 = await response1.json();

          expect(response1.status).toBe(200);
          expect(data1.success).toBe(true);

          // Verify completeness on first page
          for (const log of data1.data.logs) {
            expect(log).toHaveProperty('id');
            expect(log).toHaveProperty('submissionId');
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('action');
            expect(log).toHaveProperty('fieldName');
            expect(log).toHaveProperty('oldValue');
            expect(log).toHaveProperty('newValue');
            expect(log).toHaveProperty('user');
            expect(log.user).toHaveProperty('id');
            expect(log.user).toHaveProperty('name');
            expect(log.user).toHaveProperty('email');
            expect(log.user).toHaveProperty('role');
            expect(log).toHaveProperty('ipAddress');
            expect(log).toHaveProperty('userAgent');
          }

          // Test second page if available
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

            // Verify completeness on second page
            for (const log of data2.data.logs) {
              expect(log).toHaveProperty('id');
              expect(log).toHaveProperty('submissionId');
              expect(log).toHaveProperty('timestamp');
              expect(log).toHaveProperty('action');
              expect(log).toHaveProperty('fieldName');
              expect(log).toHaveProperty('oldValue');
              expect(log).toHaveProperty('newValue');
              expect(log).toHaveProperty('user');
              expect(log.user).toHaveProperty('id');
              expect(log.user).toHaveProperty('name');
              expect(log.user).toHaveProperty('email');
              expect(log.user).toHaveProperty('role');
              expect(log).toHaveProperty('ipAddress');
              expect(log).toHaveProperty('userAgent');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data completeness with filters applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 40 }),
        fc.record({
          userId: fc.option(fc.uuid()),
          fieldName: fc.option(fc.constantFrom('teamName', 'member2Email', 'problemStatement')),
          action: fc.option(fc.constantFrom('CREATE', 'UPDATE', 'DELETE')),
        }),
        async (logs, filters) => {
          // Apply filters to logs
          let filteredLogs = [...logs];

          if (filters.userId) {
            filteredLogs = filteredLogs.filter((log) => log.userId === filters.userId);
          }
          if (filters.fieldName) {
            filteredLogs = filteredLogs.filter((log) => log.fieldName === filters.fieldName);
          }
          if (filters.action) {
            filteredLogs = filteredLogs.filter((log) => log.action === filters.action);
          }

          // Skip if no logs match filters
          if (filteredLogs.length === 0) {
            return true;
          }

          // Sort by timestamp descending
          const sortedLogs = filteredLogs.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Build query string
          const queryParams = new URLSearchParams();
          if (filters.userId) queryParams.set('userId', filters.userId);
          if (filters.fieldName) queryParams.set('fieldName', filters.fieldName);
          if (filters.action) queryParams.set('action', filters.action);

          // Fetch logs via API with filters
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?${queryParams.toString()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify completeness even with filters
          for (const log of fetchedLogs) {
            // All required fields must be present
            expect(log).toHaveProperty('id');
            expect(log).toHaveProperty('submissionId');
            expect(log).toHaveProperty('timestamp');
            expect(log).toHaveProperty('action');
            expect(log).toHaveProperty('fieldName');
            expect(log).toHaveProperty('oldValue');
            expect(log).toHaveProperty('newValue');
            expect(log).toHaveProperty('user');
            expect(log.user).toHaveProperty('id');
            expect(log.user).toHaveProperty('name');
            expect(log.user).toHaveProperty('email');
            expect(log.user).toHaveProperty('role');
            expect(log).toHaveProperty('ipAddress');
            expect(log).toHaveProperty('userAgent');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty result set with proper structure', async () => {
    // Test with no audit logs
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    (prisma.auditLog.count as any).mockResolvedValue(0);

    const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
    const response = await GET(req, { params: { teamId: testTeamId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.logs).toEqual([]);
    expect(data.data.pagination).toBeDefined();
    expect(data.data.summary).toBeDefined();
  });

  it('should ensure timestamp is a valid Date object', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 20 }),
        async (logs) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
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

          // Verify timestamp is a valid Date
          for (const log of fetchedLogs) {
            // Timestamp is serialized as string in JSON response
            const timestamp = new Date(log.timestamp);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).not.toBeNaN();
            // Timestamp should be in a reasonable range (not year 1970 or 3000)
            expect(timestamp.getFullYear()).toBeGreaterThanOrEqual(2020);
            expect(timestamp.getFullYear()).toBeLessThanOrEqual(2030);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure action is one of the valid enum values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 20 }),
        async (logs) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
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
          const validActions = ['CREATE', 'UPDATE', 'DELETE'];

          // Verify action is valid
          for (const log of fetchedLogs) {
            expect(validActions).toContain(log.action);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure user role is one of the valid enum values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 1, maxLength: 20 }),
        async (logs) => {
          // Sort by timestamp descending
          const sortedLogs = [...logs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
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
          const validRoles = ['LEADER', 'MEMBER'];

          // Verify user role is valid
          for (const log of fetchedLogs) {
            expect(validRoles).toContain(log.user.role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
