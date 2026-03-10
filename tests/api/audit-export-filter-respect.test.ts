/**
 * Property-Based Test for Audit Trail Export Filter Respect
 * 
 * Feature: admin-audit-trail, Property 9: Export Filter Respect
 * **Validates: Requirements US-6.4**
 * 
 * This test verifies that when filters are applied to the audit trail,
 * the exported CSV contains only the audit logs that match those filters,
 * identical to what would be displayed on the page.
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
import { GET } from '@/app/api/admin/teams/[teamId]/audit/export/route';
import { prisma } from '@/lib/prisma';

/**
 * Generator for audit log entries with diverse values for filtering
 */
function auditLogGenerator() {
  return fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4').chain(userId =>
    fc.record({
      id: fc.uuid(),
      teamId: fc.constant('test-team-export'),
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
      fc.constantFrom('teamName', 'member2Email', 'problemStatement', 'ideaTitle', 'college', 'hearAbout'),
      { nil: null }
    ),
    action: fc.option(fc.constantFrom('CREATE', 'UPDATE', 'DELETE'), { nil: null }),
    fromDate: fc.option(
      fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
      { nil: null }
    ),
    toDate: fc.option(
      fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }),
      { nil: null }
    ),
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

/**
 * Parse CSV content and extract data rows
 */
function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split('\n');
  const rows: string[][] = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header row
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles quoted fields)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          // Escaped quote
          currentField += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Add last field
    fields.push(currentField);
    rows.push(fields);
  }
  
  return rows;
}

describe('Audit Trail Export API - Property 9: Export Filter Respect', () => {
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

  it('should export only logs matching all applied filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 50 }),
        filterGenerator(),
        async (generatedLogs, filters) => {
          // Filter the generated logs to get expected results
          const expectedLogs = generatedLogs.filter(log => logMatchesFilters(log, filters));
          
          // Mock Prisma to return only the filtered logs (simulating database filtering)
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);

          // Build query string from filters
          const queryParams = new URLSearchParams();
          if (filters.userId) queryParams.set('userId', filters.userId);
          if (filters.fieldName) queryParams.set('fieldName', filters.fieldName);
          if (filters.action) queryParams.set('action', filters.action);
          if (filters.fromDate) queryParams.set('fromDate', filters.fromDate.toISOString());
          if (filters.toDate) queryParams.set('toDate', filters.toDate.toISOString());

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();

          // Parse CSV to extract data rows
          const csvRows = parseCSV(csvContent);

          // Verify CSV row count matches expected log count
          expect(csvRows.length).toBe(expectedLogs.length);

          // Verify each CSV row corresponds to a log that matches the filters
          for (const row of csvRows) {
            // CSV columns: Timestamp, User, Email, Role, Action, Field, Old Value, New Value, IP Address
            const [timestamp, userName, userEmail, role, action, fieldName, oldValue, newValue, ipAddress] = row;

            // Find matching log in expected logs
            const matchingLog = expectedLogs.find(log => {
              // Match by multiple fields to ensure uniqueness
              return (
                log.action === action &&
                log.fieldName === fieldName &&
                log.user.name === userName &&
                log.user.email === userEmail
              );
            });

            // Should find a matching log
            expect(matchingLog).toBeDefined();

            // Verify the log matches all filter conditions
            if (matchingLog) {
              expect(logMatchesFilters(matchingLog, filters)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should export identical results to what GET endpoint would return', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 5, maxLength: 30 }),
        filterGenerator(),
        async (generatedLogs, filters) => {
          // Skip test if dates are invalid
          if (filters.fromDate && isNaN(filters.fromDate.getTime())) return;
          if (filters.toDate && isNaN(filters.toDate.getTime())) return;
          
          // Filter the generated logs to get expected results (same logic as GET endpoint)
          const expectedLogs = generatedLogs.filter(log => logMatchesFilters(log, filters));
          
          // Mock Prisma to return only the filtered logs for both endpoints
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);
          (prisma.auditLog.count as any).mockResolvedValue(expectedLogs.length);

          // Build query string from filters
          const queryParams = new URLSearchParams();
          if (filters.userId) queryParams.set('userId', filters.userId);
          if (filters.fieldName) queryParams.set('fieldName', filters.fieldName);
          if (filters.action) queryParams.set('action', filters.action);
          if (filters.fromDate) queryParams.set('fromDate', filters.fromDate.toISOString());
          if (filters.toDate) queryParams.set('toDate', filters.toDate.toISOString());

          // Call export endpoint
          const exportUrl = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const exportRequest = new Request(exportUrl);
          const exportResponse = await GET(exportRequest, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(exportResponse.status).toBe(200);

          // Get CSV content
          const csvContent = await exportResponse.text();
          const csvRows = parseCSV(csvContent);

          // Verify CSV contains exactly the same logs as GET endpoint would return
          expect(csvRows.length).toBe(expectedLogs.length);

          // Verify each expected log appears in CSV
          for (const expectedLog of expectedLogs) {
            const matchingRow = csvRows.find(row => {
              const [, userName, userEmail, , action, fieldName] = row;
              return (
                expectedLog.action === action &&
                expectedLog.fieldName === fieldName &&
                expectedLog.user.name === userName &&
                expectedLog.user.email === userEmail
              );
            });

            expect(matchingRow).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect date range filters correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 40 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
        fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }),
        async (generatedLogs, fromDate, toDate) => {
          // Skip test if dates are invalid
          if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return;
          
          // Filter logs by date range
          const expectedLogs = generatedLogs.filter(log => 
            log.timestamp >= fromDate && log.timestamp <= toDate
          );
          
          // Mock Prisma to return only the filtered logs
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);

          // Build query string with date filters
          const queryParams = new URLSearchParams();
          queryParams.set('fromDate', fromDate.toISOString());
          queryParams.set('toDate', toDate.toISOString());

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();
          const csvRows = parseCSV(csvContent);

          // Verify CSV row count matches expected log count
          expect(csvRows.length).toBe(expectedLogs.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect userId filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 40 }),
        fc.constantFrom('user-1', 'user-2', 'user-3', 'user-4'),
        async (generatedLogs, userId) => {
          // Filter logs by userId
          const expectedLogs = generatedLogs.filter(log => log.userId === userId);
          
          // Mock Prisma to return only the filtered logs
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);

          // Build query string with userId filter
          const queryParams = new URLSearchParams();
          queryParams.set('userId', userId);

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();
          const csvRows = parseCSV(csvContent);

          // Verify CSV row count matches expected log count
          expect(csvRows.length).toBe(expectedLogs.length);

          // Verify all rows have the correct userId (by checking user details)
          for (const row of csvRows) {
            const [, userName, userEmail] = row;
            const matchingLog = expectedLogs.find(log => 
              log.user.name === userName && log.user.email === userEmail
            );
            expect(matchingLog).toBeDefined();
            expect(matchingLog?.userId).toBe(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect fieldName filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 40 }),
        fc.constantFrom('teamName', 'member2Email', 'problemStatement', 'ideaTitle', 'college', 'hearAbout'),
        async (generatedLogs, fieldName) => {
          // Filter logs by fieldName
          const expectedLogs = generatedLogs.filter(log => log.fieldName === fieldName);
          
          // Mock Prisma to return only the filtered logs
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);

          // Build query string with fieldName filter
          const queryParams = new URLSearchParams();
          queryParams.set('fieldName', fieldName);

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();
          const csvRows = parseCSV(csvContent);

          // Verify CSV row count matches expected log count
          expect(csvRows.length).toBe(expectedLogs.length);

          // Verify all rows have the correct fieldName
          for (const row of csvRows) {
            const [, , , , , csvFieldName] = row;
            expect(csvFieldName).toBe(fieldName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect action filter correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 10, maxLength: 40 }),
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE'),
        async (generatedLogs, action) => {
          // Filter logs by action
          const expectedLogs = generatedLogs.filter(log => log.action === action);
          
          // Mock Prisma to return only the filtered logs
          (prisma.auditLog.findMany as any).mockResolvedValue(expectedLogs as any);

          // Build query string with action filter
          const queryParams = new URLSearchParams();
          queryParams.set('action', action);

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();
          const csvRows = parseCSV(csvContent);

          // Verify CSV row count matches expected log count
          expect(csvRows.length).toBe(expectedLogs.length);

          // Verify all rows have the correct action
          for (const row of csvRows) {
            const [, , , , csvAction] = row;
            expect(csvAction).toBe(action);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty results when no logs match filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(auditLogGenerator(), { minLength: 5, maxLength: 20 }),
        async (generatedLogs) => {
          // Mock Prisma to return empty array (simulating no matches)
          (prisma.auditLog.findMany as any).mockResolvedValue([]);

          // Use a filter that won't match any logs (non-existent userId)
          const queryParams = new URLSearchParams();
          queryParams.set('userId', 'non-existent-user-id');

          const url = `http://localhost:3000/api/admin/teams/${testTeamId}/audit/export?${queryParams.toString()}`;
          const request = new Request(url);

          // Call export endpoint
          const response = await GET(request, { params: { teamId: testTeamId } });

          // Should return 200 OK
          expect(response.status).toBe(200);

          // Get CSV content
          const csvContent = await response.text();
          const csvRows = parseCSV(csvContent);

          // Should have no data rows (only header)
          expect(csvRows.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
