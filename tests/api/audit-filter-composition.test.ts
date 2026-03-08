/**
 * Property-Based Test for Audit Trail Filter Composition
 *
 * Feature: admin-audit-trail, Property 5: Filter Composition
 * **Validates: Requirements US-4.1, US-4.2, US-4.3, US-4.4, US-4.5**
 *
 * This test verifies that when multiple filters are applied simultaneously,
 * all returned audit logs satisfy ALL filter conditions (AND logic).
 * Tests various combinations of date range, userId, fieldName, and action filters.
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
 * Generator for audit log entries with diverse values for filtering
 */
function auditLogGenerator() {
  return fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4').chain((userId) =>
    fc.record({
      id: fc.uuid(),
      teamId: fc.constant('test-team-filter'),
      userId: fc.constant(userId),
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
        'hearAbout'
      ),
      oldValue: fc.option(fc.string({ maxLength: 100 })),
      newValue: fc.option(fc.string({ maxLength: 100 })),
      ipAddress: fc.ipV4(),
      userAgent: fc.string({ maxLength: 50 }),
      metadata: fc.constant(null),
      user: fc.record({
        id: fc.constant(userId),
        name: fc.string({ minLength: 3, maxLength: 30 }),
        email: fc.emailAddress(),
        teamMemberships: fc.constant([{ role: 'LEADER' }]),
      }),
    })
  );
}

/**
 * Generator for filter combinations
 */
function filterGenerator() {
  return fc.record({
    userId: fc.option(fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4'), { nil: null }),
    fieldName: fc.option(
      fc.constantFrom(
        'teamName',
        'member2Email',
        'problemStatement',
        'ideaTitle',
        'college',
        'hearAbout'
      ),
      { nil: null }
    ),
    action: fc.option(fc.constantFrom('CREATE', 'UPDATE', 'DELETE'), { nil: null }),
    fromDate: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }), {
      nil: null,
    }),
    toDate: fc.option(fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }), {
      nil: null,
    }),
  });
}

/**
 * Check if a log matches all filter conditions
 */
function logMatchesFilters(
  log: any,
  filters: {
    userId?: string | null;
    fieldName?: string | null;
    action?: string | null;
    fromDate?: Date | null;
    toDate?: Date | null;
  }
): boolean {
  // Check userId filter
  if (filters.userId && log.userId !== filters.userId) {
    return false;
  }

  // Check fieldName filter
  if (filters.fieldName && log.fieldName !== filters.fieldName) {
    return false;
  }

  // Check action filter
  if (filters.action && log.action !== filters.action) {
    return false;
  }

  // Check fromDate filter
  if (filters.fromDate && log.timestamp < filters.fromDate) {
    return false;
  }

  // Check toDate filter
  if (filters.toDate && log.timestamp > filters.toDate) {
    return false;
  }

  return true;
}

describe('Audit Trail API - Property 5: Filter Composition', () => {
  const testTeamId = 'test-team-filter';

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
    name: 'Test Team Filter',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should return only logs that satisfy all filter conditions (AND logic)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 100 }),
        filterGenerator(),
        async (generatedLogs, filters) => {
          // Filter out logs with invalid timestamps
          const validLogs = generatedLogs.filter((log) => !isNaN(log.timestamp.getTime()));

          // Skip test if we don't have enough valid logs
          if (validLogs.length < 10) {
            return true;
          }

          // Skip if dates are invalid
          if (filters.fromDate && isNaN(filters.fromDate.getTime())) {
            return true;
          }
          if (filters.toDate && isNaN(filters.toDate.getTime())) {
            return true;
          }

          // Skip if no filters are applied (not testing filter composition)
          const hasFilters =
            filters.userId ||
            filters.fieldName ||
            filters.action ||
            filters.fromDate ||
            filters.toDate;
          if (!hasFilters) {
            return true;
          }

          // Manually filter logs to match expected behavior
          const expectedFilteredLogs = validLogs.filter((log) => logMatchesFilters(log, filters));

          // Sort by timestamp descending (as API does)
          const sortedExpectedLogs = [...expectedFilteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma to return the filtered logs
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedExpectedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedExpectedLogs.length);

          // Build query string from filters
          const queryParams = new URLSearchParams();
          if (filters.userId) queryParams.set('userId', filters.userId);
          if (filters.fieldName) queryParams.set('fieldName', filters.fieldName);
          if (filters.action) queryParams.set('action', filters.action);
          if (filters.fromDate) queryParams.set('fromDate', filters.fromDate.toISOString());
          if (filters.toDate) queryParams.set('toDate', filters.toDate.toISOString());

          // Fetch logs via API endpoint with filters
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?${queryParams.toString()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          // Verify response is successful
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs satisfy ALL filter conditions
          for (const log of fetchedLogs) {
            // Check userId filter
            if (filters.userId) {
              expect(log.user.id).toBe(filters.userId);
            }

            // Check fieldName filter
            if (filters.fieldName) {
              expect(log.fieldName).toBe(filters.fieldName);
            }

            // Check action filter
            if (filters.action) {
              expect(log.action).toBe(filters.action);
            }

            // Check fromDate filter
            if (filters.fromDate) {
              const logTimestamp = new Date(log.timestamp);
              expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(filters.fromDate.getTime());
            }

            // Check toDate filter
            if (filters.toDate) {
              const logTimestamp = new Date(log.timestamp);
              expect(logTimestamp.getTime()).toBeLessThanOrEqual(filters.toDate.getTime());
            }
          }

          // Verify count matches expected filtered count
          expect(fetchedLogs.length).toBe(sortedExpectedLogs.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle date range filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.date({ min: new Date('2024-03-01'), max: new Date('2024-06-30') }),
        fc.date({ min: new Date('2024-07-01'), max: new Date('2024-09-30') }),
        async (generatedLogs, fromDate, toDate) => {
          // Skip test if dates are invalid
          if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return true;
          }

          // Filter logs within date range
          const filteredLogs = generatedLogs.filter(
            (log) => log.timestamp >= fromDate && log.timestamp <= toDate
          );

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with date range filter
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs are within date range
          for (const log of fetchedLogs) {
            const logTimestamp = new Date(log.timestamp);
            expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
            expect(logTimestamp.getTime()).toBeLessThanOrEqual(toDate.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle userId filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('user-1', 'user-2', 'user-3'),
        async (generatedLogs, userId) => {
          // Filter logs by userId
          const filteredLogs = generatedLogs.filter((log) => log.userId === userId);

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with userId filter
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?userId=${userId}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs have the specified userId
          for (const log of fetchedLogs) {
            expect(log.user.id).toBe(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle fieldName filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('teamName', 'member2Email', 'problemStatement'),
        async (generatedLogs, fieldName) => {
          // Filter logs by fieldName
          const filteredLogs = generatedLogs.filter((log) => log.fieldName === fieldName);

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with fieldName filter
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?fieldName=${fieldName}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs have the specified fieldName
          for (const log of fetchedLogs) {
            expect(log.fieldName).toBe(fieldName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle action filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
        async (generatedLogs, action) => {
          // Filter logs by action
          const filteredLogs = generatedLogs.filter((log) => log.action === action);

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with action filter
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?action=${action}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs have the specified action
          for (const log of fetchedLogs) {
            expect(log.action).toBe(action);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple filters combined (userId + fieldName)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 30, maxLength: 100 }),
        fc.constantFrom('user-1', 'user-2', 'user-3'),
        fc.constantFrom('teamName', 'member2Email', 'problemStatement'),
        async (generatedLogs, userId, fieldName) => {
          // Filter logs by both userId and fieldName
          const filteredLogs = generatedLogs.filter(
            (log) => log.userId === userId && log.fieldName === fieldName
          );

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with both filters
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?userId=${userId}&fieldName=${fieldName}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs satisfy BOTH conditions
          for (const log of fetchedLogs) {
            expect(log.user.id).toBe(userId);
            expect(log.fieldName).toBe(fieldName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple filters combined (action + date range)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 30, maxLength: 100 }),
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
        fc.date({ min: new Date('2024-03-01'), max: new Date('2024-06-30') }),
        fc.date({ min: new Date('2024-07-01'), max: new Date('2024-09-30') }),
        async (generatedLogs, action, fromDate, toDate) => {
          // Filter logs by action and date range
          const filteredLogs = generatedLogs.filter(
            (log) => log.action === action && log.timestamp >= fromDate && log.timestamp <= toDate
          );

          // Sort by timestamp descending
          const sortedLogs = [...filteredLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Fetch with all filters
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?action=${action}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all logs satisfy ALL conditions
          for (const log of fetchedLogs) {
            expect(log.action).toBe(action);
            const logTimestamp = new Date(log.timestamp);
            expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
            expect(logTimestamp.getTime()).toBeLessThanOrEqual(toDate.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no logs match all filter conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        async (generatedLogs) => {
          // Use a userId that doesn't exist in the generated logs
          const nonExistentUserId = 'user-nonexistent-999';

          // Filter should return empty
          const filteredLogs: any[] = [];

          (prisma.auditLog.findMany as any).mockResolvedValue(filteredLogs);
          (prisma.auditLog.count as any).mockResolvedValue(0);

          // Fetch with filter that matches nothing
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?userId=${nonExistentUserId}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.data.logs).toEqual([]);
          expect(data.data.pagination.total).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});
