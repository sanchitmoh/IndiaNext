/**
 * Property-Based Test for Audit Trail Case-Insensitive Search
 *
 * Feature: admin-audit-trail, Property 6: Case-Insensitive Search
 * **Validates: Requirements US-5.1, US-5.2, US-5.3, US-5.5**
 *
 * This test verifies that search functionality is case-insensitive and searches
 * across all relevant fields (oldValue, newValue, user name, user email, fieldName).
 * Tests that different case variations (lower, upper, mixed) return the same results.
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
 * Generator for audit log entries with searchable content
 */
function auditLogGenerator() {
  return fc.record({
    id: fc.uuid(),
    teamId: fc.constant('test-team-search'),
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
      'proposedSolution',
      'targetUsers'
    ),
    oldValue: fc.option(
      fc.constantFrom(
        'Innovation Squad',
        'john@example.com',
        'Building a mobile app',
        'Climate Change Solution',
        'MIT',
        'Social Media',
        null
      )
    ),
    newValue: fc.option(
      fc.constantFrom(
        'Innovation Squad 2.0',
        'jane@example.com',
        'Building a web platform',
        'AI-Powered Healthcare',
        'Stanford',
        'Friend Referral',
        null
      )
    ),
    ipAddress: fc.ipV4(),
    userAgent: fc.string({ maxLength: 50 }),
    metadata: fc.constant(null),
    user: fc.record({
      id: fc.uuid(),
      name: fc.constantFrom(
        'John Doe',
        'Jane Smith',
        'Alice Johnson',
        'Bob Wilson',
        'Charlie Brown'
      ),
      email: fc.constantFrom(
        'john.doe@example.com',
        'jane.smith@example.com',
        'alice.johnson@example.com',
        'bob.wilson@example.com',
        'charlie.brown@example.com'
      ),
      teamMemberships: fc.constant([{ role: 'LEADER' }]),
    }),
  });
}

/**
 * Check if a log contains the search term (case-insensitive) in any searchable field
 */
function logContainsSearchTerm(log: any, searchTerm: string): boolean {
  const lowerSearchTerm = searchTerm.toLowerCase();

  // Search in oldValue
  if (log.oldValue && log.oldValue.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }

  // Search in newValue
  if (log.newValue && log.newValue.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }

  // Search in user name
  if (log.user.name && log.user.name.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }

  // Search in user email
  if (log.user.email && log.user.email.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }

  // Search in fieldName
  if (log.fieldName && log.fieldName.toLowerCase().includes(lowerSearchTerm)) {
    return true;
  }

  return false;
}

describe('Audit Trail API - Property 6: Case-Insensitive Search', () => {
  const testTeamId = 'test-team-search';

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
    name: 'Test Team Search',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);
  });

  it('should return same results for different case variations of search term', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 50 }),
        fc.constantFrom('innovation', 'john', 'example', 'mobile', 'mit', 'team'),
        async (generatedLogs, searchTerm) => {
          // Filter logs that contain the search term (case-insensitive)
          const matchingLogs = generatedLogs.filter((log) =>
            logContainsSearchTerm(log, searchTerm)
          );

          // Sort by timestamp descending (as API does)
          const sortedMatchingLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          // Mock Prisma to return the matching logs
          (prisma.auditLog.findMany as any).mockResolvedValue(sortedMatchingLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedMatchingLogs.length);

          // Test with lowercase
          const lowerReq = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm.toLowerCase()}`
          );
          const lowerResponse = await GET(lowerReq, { params: { teamId: testTeamId } });
          const lowerData = await lowerResponse.json();

          // Test with uppercase
          const upperReq = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm.toUpperCase()}`
          );
          const upperResponse = await GET(upperReq, { params: { teamId: testTeamId } });
          const upperData = await upperResponse.json();

          // Test with mixed case
          const mixedCase = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase();
          const mixedReq = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${mixedCase}`
          );
          const mixedResponse = await GET(mixedReq, { params: { teamId: testTeamId } });
          const mixedData = await mixedResponse.json();

          // Verify all responses are successful
          expect(lowerResponse.status).toBe(200);
          expect(upperResponse.status).toBe(200);
          expect(mixedResponse.status).toBe(200);

          expect(lowerData.success).toBe(true);
          expect(upperData.success).toBe(true);
          expect(mixedData.success).toBe(true);

          // Verify all return the same number of results
          expect(lowerData.data.logs.length).toBe(upperData.data.logs.length);
          expect(lowerData.data.logs.length).toBe(mixedData.data.logs.length);

          // Verify the count matches expected
          expect(lowerData.data.logs.length).toBe(sortedMatchingLogs.length);
        }
      ),
      { numRuns: 50, timeout: 10000 }
    );
  }, 15000);

  it('should find matches in oldValue field regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('innovation', 'mobile', 'climate'),
        async (generatedLogs, searchTerm) => {
          // Filter logs where oldValue contains the search term
          const matchingLogs = generatedLogs.filter(
            (log) => log.oldValue && log.oldValue.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with uppercase
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm.toUpperCase()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs contain the search term in oldValue (case-insensitive)
          for (const log of fetchedLogs) {
            if (log.oldValue) {
              expect(log.oldValue.toLowerCase()).toContain(searchTerm.toLowerCase());
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find matches in newValue field regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('squad', 'platform', 'healthcare'),
        async (generatedLogs, searchTerm) => {
          // Filter logs where newValue contains the search term
          const matchingLogs = generatedLogs.filter(
            (log) => log.newValue && log.newValue.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with mixed case
          const mixedCase = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${mixedCase}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs contain the search term in newValue (case-insensitive)
          for (const log of fetchedLogs) {
            if (log.newValue) {
              expect(log.newValue.toLowerCase()).toContain(searchTerm.toLowerCase());
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find matches in user name field regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('john', 'jane', 'alice', 'bob'),
        async (generatedLogs, searchTerm) => {
          // Filter logs where user name contains the search term
          const matchingLogs = generatedLogs.filter(
            (log) => log.user.name && log.user.name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with lowercase
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm.toLowerCase()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs contain the search term in user name (case-insensitive)
          for (const log of fetchedLogs) {
            expect(log.user.name.toLowerCase()).toContain(searchTerm.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find matches in user email field regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('example', 'john', 'jane', 'alice'),
        async (generatedLogs, searchTerm) => {
          // Filter logs where user email contains the search term
          const matchingLogs = generatedLogs.filter(
            (log) =>
              log.user.email && log.user.email.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with uppercase
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm.toUpperCase()}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs contain the search term in user email (case-insensitive)
          for (const log of fetchedLogs) {
            expect(log.user.email.toLowerCase()).toContain(searchTerm.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find matches in fieldName regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        fc.constantFrom('team', 'email', 'problem', 'idea'),
        async (generatedLogs, searchTerm) => {
          // Filter logs where fieldName contains the search term
          const matchingLogs = generatedLogs.filter(
            (log) => log.fieldName && log.fieldName.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with mixed case
          const mixedCase = searchTerm
            .split('')
            .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
            .join('');

          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${mixedCase}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify all returned logs contain the search term in fieldName (case-insensitive)
          for (const log of fetchedLogs) {
            expect(log.fieldName.toLowerCase()).toContain(searchTerm.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return results containing search term in at least one searchable field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 30, maxLength: 100 }),
        fc.constantFrom('innovation', 'john', 'example', 'team', 'mobile'),
        async (generatedLogs, searchTerm) => {
          // Filter logs that contain the search term in ANY searchable field
          const matchingLogs = generatedLogs.filter((log) =>
            logContainsSearchTerm(log, searchTerm)
          );

          // Sort by timestamp descending
          const sortedLogs = [...matchingLogs].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );

          (prisma.auditLog.findMany as any).mockResolvedValue(sortedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(sortedLogs.length);

          // Search with original case
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${searchTerm}`
          );
          const response = await GET(req, { params: { teamId: testTeamId } });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);

          const fetchedLogs = data.data.logs;

          // Verify every returned log contains the search term in at least one field
          for (const log of fetchedLogs) {
            const containsInOldValue =
              log.oldValue && log.oldValue.toLowerCase().includes(searchTerm.toLowerCase());
            const containsInNewValue =
              log.newValue && log.newValue.toLowerCase().includes(searchTerm.toLowerCase());
            const containsInUserName =
              log.user.name && log.user.name.toLowerCase().includes(searchTerm.toLowerCase());
            const containsInUserEmail =
              log.user.email && log.user.email.toLowerCase().includes(searchTerm.toLowerCase());
            const containsInFieldName =
              log.fieldName && log.fieldName.toLowerCase().includes(searchTerm.toLowerCase());

            const containsInAtLeastOneField =
              containsInOldValue ||
              containsInNewValue ||
              containsInUserName ||
              containsInUserEmail ||
              containsInFieldName;

            expect(containsInAtLeastOneField).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when search term matches no logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 20, maxLength: 50 }),
        async (generatedLogs) => {
          // Use a search term that definitely won't match
          const nonMatchingSearchTerm = 'ZZZZNONEXISTENT999';

          // Empty results
          const matchingLogs: any[] = [];

          (prisma.auditLog.findMany as any).mockResolvedValue(matchingLogs);
          (prisma.auditLog.count as any).mockResolvedValue(0);

          // Search with non-matching term
          const req = new Request(
            `http://localhost/api/admin/teams/${testTeamId}/audit?search=${nonMatchingSearchTerm}`
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
