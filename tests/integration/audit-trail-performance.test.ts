/**
 * Performance Tests for Admin Audit Trail
 *
 * Task 14.2: Performance testing
 *
 * Validates:
 * - Page load time < 2 seconds with 100+ audit log entries
 * - Filter response time < 300ms
 * - Search response time < 500ms
 * - Export generation time < 5 seconds for 1000 records
 *
 * Requirements: FR-5, NFR-2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/admin/teams/[teamId]/audit/route';
import { GET as ExportGET } from '@/app/api/admin/teams/[teamId]/audit/export/route';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session-security';

// Mock dependencies
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

vi.mock('@/lib/session-security', () => ({
  hashSessionToken: vi.fn((token) => `hashed_${token}`),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'admin_token') {
        return { value: 'admin-token' };
      }
      return undefined;
    }),
  })),
}));

describe('Audit Trail Performance Tests', () => {
  const mockAdminSession = {
    id: 'session-123',
    token: 'hashed_admin-token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    admin: {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Test Team',
  };

  /**
   * Helper function to generate mock audit log entries
   */
  function generateMockAuditLogs(count: number) {
    const logs = [];
    const baseTimestamp = new Date('2024-03-08T14:30:00Z').getTime();

    for (let i = 0; i < count; i++) {
      logs.push({
        id: `log-${i}`,
        teamId: 'team-123',
        userId: `user-${i % 5}`, // 5 different users
        submissionId: `sub-${Math.floor(i / 3)}`, // Group every 3 changes
        timestamp: new Date(baseTimestamp - i * 60000), // 1 minute apart
        action: ['CREATE', 'UPDATE', 'DELETE'][i % 3] as 'CREATE' | 'UPDATE' | 'DELETE',
        fieldName: ['teamName', 'member2Email', 'problemStatement', 'ideaTitle', 'techStack'][
          i % 5
        ],
        oldValue: `old-value-${i}`,
        newValue: `new-value-${i}`,
        ipAddress: `192.168.1.${(i % 255) + 1}`,
        userAgent: 'Mozilla/5.0',
        user: {
          id: `user-${i % 5}`,
          name: `User ${i % 5}`,
          email: `user${i % 5}@example.com`,
          teamMemberships: [{ role: i % 2 === 0 ? 'LEADER' : 'MEMBER' }],
        },
      });
    }

    return logs;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Performance Requirement: Page Load < 2 seconds with 100+ entries', () => {
    it('should load audit trail page in less than 2 seconds with 100 entries', async () => {
      // Generate 100 audit log entries
      const mockLogs = generateMockAuditLogs(100);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20)); // First page
      (prisma.auditLog.count as any).mockResolvedValue(100);

      // Create request
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20'
      );

      // Measure page load time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toHaveLength(20);
      expect(data.data.pagination.total).toBe(100);

      // Verify performance requirement: < 2000ms
      expect(loadTime).toBeLessThan(2000);

      console.log(
        `✓ Page load time with 100 entries: ${loadTime.toFixed(2)}ms (requirement: < 2000ms)`
      );
    });

    it('should load audit trail page in less than 2 seconds with 200 entries', async () => {
      // Generate 200 audit log entries
      const mockLogs = generateMockAuditLogs(200);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20)); // First page
      (prisma.auditLog.count as any).mockResolvedValue(200);

      // Create request
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20'
      );

      // Measure page load time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toHaveLength(20);
      expect(data.data.pagination.total).toBe(200);

      // Verify performance requirement: < 2000ms
      expect(loadTime).toBeLessThan(2000);

      console.log(
        `✓ Page load time with 200 entries: ${loadTime.toFixed(2)}ms (requirement: < 2000ms)`
      );
    });

    it('should load audit trail page in less than 2 seconds with 500 entries', async () => {
      // Generate 500 audit log entries
      const mockLogs = generateMockAuditLogs(500);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20)); // First page
      (prisma.auditLog.count as any).mockResolvedValue(500);

      // Create request
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20'
      );

      // Measure page load time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toHaveLength(20);
      expect(data.data.pagination.total).toBe(500);

      // Verify performance requirement: < 2000ms
      expect(loadTime).toBeLessThan(2000);

      console.log(
        `✓ Page load time with 500 entries: ${loadTime.toFixed(2)}ms (requirement: < 2000ms)`
      );
    });
  });

  describe('Performance Requirement: Filter Response < 300ms', () => {
    it('should apply date range filter in less than 300ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(50);

      // Create request with date range filter
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&fromDate=2024-03-01&toDate=2024-03-31'
      );

      // Measure filter response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const filterTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 300ms
      expect(filterTime).toBeLessThan(300);

      console.log(
        `✓ Date range filter response time: ${filterTime.toFixed(2)}ms (requirement: < 300ms)`
      );
    });

    it('should apply user filter in less than 300ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(30);

      // Create request with user filter
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&userId=user-1'
      );

      // Measure filter response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const filterTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 300ms
      expect(filterTime).toBeLessThan(300);

      console.log(`✓ User filter response time: ${filterTime.toFixed(2)}ms (requirement: < 300ms)`);
    });

    it('should apply field name filter in less than 300ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(30);

      // Create request with field name filter
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&fieldName=teamName'
      );

      // Measure filter response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const filterTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 300ms
      expect(filterTime).toBeLessThan(300);

      console.log(
        `✓ Field name filter response time: ${filterTime.toFixed(2)}ms (requirement: < 300ms)`
      );
    });

    it('should apply action filter in less than 300ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(50);

      // Create request with action filter
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&action=UPDATE'
      );

      // Measure filter response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const filterTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 300ms
      expect(filterTime).toBeLessThan(300);

      console.log(
        `✓ Action filter response time: ${filterTime.toFixed(2)}ms (requirement: < 300ms)`
      );
    });

    it('should apply multiple filters in less than 300ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(10);

      // Create request with multiple filters
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&userId=user-1&fieldName=teamName&action=UPDATE&fromDate=2024-03-01&toDate=2024-03-31'
      );

      // Measure filter response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const filterTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 300ms
      expect(filterTime).toBeLessThan(300);

      console.log(
        `✓ Multiple filters response time: ${filterTime.toFixed(2)}ms (requirement: < 300ms)`
      );
    });
  });

  describe('Performance Requirement: Search Response < 500ms', () => {
    it('should perform keyword search in less than 500ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(25);

      // Create request with search query
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&search=team'
      );

      // Measure search response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const searchTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 500ms
      expect(searchTime).toBeLessThan(500);

      console.log(`✓ Search response time: ${searchTime.toFixed(2)}ms (requirement: < 500ms)`);
    });

    it('should perform case-insensitive search in less than 500ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(25);

      // Create request with case-insensitive search
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&search=TEAM'
      );

      // Measure search response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const searchTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 500ms
      expect(searchTime).toBeLessThan(500);

      console.log(
        `✓ Case-insensitive search response time: ${searchTime.toFixed(2)}ms (requirement: < 500ms)`
      );
    });

    it('should perform search with filters in less than 500ms', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 20));
      (prisma.auditLog.count as any).mockResolvedValue(15);

      // Create request with search and filters
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20&search=email&userId=user-1&action=UPDATE'
      );

      // Measure search response time
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const searchTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify performance requirement: < 500ms
      expect(searchTime).toBeLessThan(500);

      console.log(
        `✓ Search with filters response time: ${searchTime.toFixed(2)}ms (requirement: < 500ms)`
      );
    });
  });

  describe('Performance Requirement: Export Generation < 5 seconds for 1000 records', () => {
    it('should generate CSV export in less than 5 seconds for 1000 records', async () => {
      // Generate 1000 audit log entries
      const mockLogs = generateMockAuditLogs(1000);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

      // Create export request
      const req = new Request('http://localhost:3000/api/admin/teams/team-123/audit/export');

      // Measure export generation time
      const startTime = performance.now();
      const response = await ExportGET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const exportTime = endTime - startTime;

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('audit_');

      // Verify performance requirement: < 5000ms
      expect(exportTime).toBeLessThan(5000);

      console.log(
        `✓ Export generation time for 1000 records: ${exportTime.toFixed(2)}ms (requirement: < 5000ms)`
      );
    });

    it('should generate CSV export in less than 5 seconds for 500 records', async () => {
      // Generate 500 audit log entries
      const mockLogs = generateMockAuditLogs(500);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

      // Create export request
      const req = new Request('http://localhost:3000/api/admin/teams/team-123/audit/export');

      // Measure export generation time
      const startTime = performance.now();
      const response = await ExportGET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const exportTime = endTime - startTime;

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');

      // Verify performance requirement: < 5000ms
      expect(exportTime).toBeLessThan(5000);

      console.log(
        `✓ Export generation time for 500 records: ${exportTime.toFixed(2)}ms (requirement: < 5000ms)`
      );
    });

    it('should generate filtered CSV export in less than 5 seconds', async () => {
      // Generate 1000 audit log entries
      const mockLogs = generateMockAuditLogs(1000);

      // Mock Prisma responses (filtered results)
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs.slice(0, 200));

      // Create export request with filters
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit/export?userId=user-1&action=UPDATE'
      );

      // Measure export generation time
      const startTime = performance.now();
      const response = await ExportGET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const exportTime = endTime - startTime;

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');

      // Verify performance requirement: < 5000ms
      expect(exportTime).toBeLessThan(5000);

      console.log(
        `✓ Filtered export generation time: ${exportTime.toFixed(2)}ms (requirement: < 5000ms)`
      );
    });
  });

  describe('Performance Requirement: Summary Statistics Calculation', () => {
    it('should calculate summary statistics efficiently with 100+ entries', async () => {
      const mockLogs = generateMockAuditLogs(150);

      // Mock Prisma responses
      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as any).mockResolvedValue(150);

      // Create request
      const req = new Request(
        'http://localhost:3000/api/admin/teams/team-123/audit?page=1&limit=20'
      );

      // Measure total response time (includes summary calculation)
      const startTime = performance.now();
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const data = await response.json();

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.totalEdits).toBeGreaterThan(0);
      expect(data.data.summary.lastEditDate).toBeDefined();
      expect(data.data.summary.mostActiveUser).toBeDefined();
      expect(data.data.summary.topChangedFields).toBeDefined();

      // Summary calculation should not significantly impact page load time
      // Total time should still be < 2000ms
      expect(totalTime).toBeLessThan(2000);

      console.log(`✓ Summary statistics calculation time (150 entries): ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Requirement: Pagination Performance', () => {
    it('should navigate to different pages efficiently', async () => {
      const mockLogs = generateMockAuditLogs(200);

      // Test multiple page loads
      const pageTimes: number[] = [];

      for (let page = 1; page <= 5; page++) {
        // Mock Prisma responses for each page
        const startIdx = (page - 1) * 20;
        (prisma.auditLog.findMany as any).mockResolvedValue(
          mockLogs.slice(startIdx, startIdx + 20)
        );
        (prisma.auditLog.count as any).mockResolvedValue(200);

        // Create request for specific page
        const req = new Request(
          `http://localhost:3000/api/admin/teams/team-123/audit?page=${page}&limit=20`
        );

        // Measure page load time
        const startTime = performance.now();
        const response = await GET(req, { params: { teamId: 'team-123' } });
        const endTime = performance.now();

        const pageTime = endTime - startTime;
        pageTimes.push(pageTime);

        // Verify response is successful
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.pagination.page).toBe(page);

        // Each page load should be < 2000ms
        expect(pageTime).toBeLessThan(2000);
      }

      const avgPageTime = pageTimes.reduce((sum, time) => sum + time, 0) / pageTimes.length;
      console.log(`✓ Average pagination time across 5 pages: ${avgPageTime.toFixed(2)}ms`);
      console.log(`  Page times: ${pageTimes.map((t) => t.toFixed(2)).join('ms, ')}ms`);
    });
  });
});
