/**
 * Tests for GET /api/admin/teams/[teamId]/audit endpoint
 *
 * Validates:
 * - Admin authentication and authorization
 * - Query parameter parsing and validation
 * - Filtering (date range, user, field, action, search)
 * - Pagination
 * - Summary statistics calculation
 * - Error handling (unauthorized, team not found, invalid filters)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/admin/teams/[teamId]/audit/route';
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
    get: vi.fn(),
  })),
}));

describe('GET /api/admin/teams/[teamId]/audit', () => {
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

  const mockAuditLogs = [
    {
      id: 'log-1',
      teamId: 'team-123',
      userId: 'user-1',
      submissionId: 'sub-1',
      timestamp: new Date('2024-03-08T14:30:00Z'),
      action: 'UPDATE',
      fieldName: 'teamName',
      oldValue: 'Old Name',
      newValue: 'New Name',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        teamMemberships: [{ role: 'LEADER' }],
      },
    },
    {
      id: 'log-2',
      teamId: 'team-123',
      userId: 'user-1',
      submissionId: 'sub-1',
      timestamp: new Date('2024-03-08T14:30:00Z'),
      action: 'UPDATE',
      fieldName: 'member2Email',
      oldValue: 'old@example.com',
      newValue: 'new@example.com',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        teamMemberships: [{ role: 'LEADER' }],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 if no admin token provided', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 if admin session is expired', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue({
        ...mockAdminSession,
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      });

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 if admin does not have sufficient permissions', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue({
        ...mockAdminSession,
        admin: {
          ...mockAdminSession.admin,
          role: 'JUDGE', // Judge doesn't have permission
        },
      });

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    });
  });

  describe('Team Validation', () => {
    it('should return 404 if team does not exist', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(null);

      const req = new Request('http://localhost/api/admin/teams/nonexistent/audit');
      const response = await GET(req, { params: { teamId: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('TEAM_NOT_FOUND');
    });
  });

  describe('Query Parameter Validation', () => {
    it('should return 400 for invalid filter parameters', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit?page=invalid');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_FILTER');
    });

    it('should use default values for missing parameters', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      // Mock findMany to return logs for both the main query and summary calculation
      (prisma.auditLog.findMany as any).mockResolvedValue(mockAuditLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(20);
    });
  });

  describe('Successful Audit Log Retrieval', () => {
    it('should return audit logs with pagination and summary', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue(mockAuditLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toHaveLength(2);
      expect(data.data.pagination.total).toBe(2);
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.totalEdits).toBe(1); // 1 unique submissionId
    });

    it('should return empty array for team with no audit logs', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toEqual([]);
      expect(data.data.summary.totalEdits).toBe(0);
      expect(data.data.summary.lastEditDate).toBeNull();
      expect(data.data.summary.mostActiveUser).toBeNull();
    });

    it('should return empty array for pagination out of range', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      // Mock findMany to return empty array for out of range page
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      // Mock count to return total of 50 logs (3 pages with limit 20)
      (prisma.auditLog.count as any).mockResolvedValue(50);

      // Request page 999 which is beyond available pages
      const req = new Request('http://localhost/api/admin/teams/team-123/audit?page=999&limit=20');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.logs).toEqual([]);
      expect(data.data.pagination.page).toBe(999);
      expect(data.data.pagination.total).toBe(50);
      expect(data.data.pagination.totalPages).toBe(3);
    });
  });

  describe('Filtering', () => {
    it('should filter by date range', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue(mockAuditLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const req = new Request(
        'http://localhost/api/admin/teams/team-123/audit?fromDate=2024-03-01&toDate=2024-03-31'
      );
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by userId', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue([mockAuditLogs[0]]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit?userId=user-1');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('should filter by fieldName', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue([mockAuditLogs[0]]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit?fieldName=teamName');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fieldName: 'teamName',
          }),
        })
      );
    });

    it('should filter by action', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue(mockAuditLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit?action=UPDATE');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'UPDATE',
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue([mockAuditLogs[0]]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit?search=New%20Name');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ oldValue: expect.anything() }),
              expect.objectContaining({ newValue: expect.anything() }),
            ]),
          }),
        })
      );
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate summary statistics correctly', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockResolvedValue(mockAuditLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.summary.totalEdits).toBe(1); // 1 unique submissionId
      expect(data.data.summary.lastEditDate).toBeDefined();
      expect(data.data.summary.mostActiveUser).toBeDefined();
      expect(data.data.summary.mostActiveUser.id).toBe('user-1');
      expect(data.data.summary.mostActiveUser.count).toBe(2);
      expect(data.data.summary.topChangedFields).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should return 503 on database error', async () => {
      const { cookies } = await import('next/headers');
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'admin-token' }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession);
      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
      (prisma.auditLog.findMany as any).mockRejectedValue(new Error('Database connection failed'));

      const req = new Request('http://localhost/api/admin/teams/team-123/audit');
      const response = await GET(req, { params: { teamId: 'team-123' } });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DATABASE_ERROR');
    });
  });
});
