/**
 * Integration Tests: Audit Export Endpoint
 * 
 * Tests the GET /api/admin/teams/[teamId]/audit/export endpoint:
 * - Admin authentication and authorization
 * - CSV format generation
 * - Filename format (audit_[sanitizedTeamName]_[YYYY-MM-DD].csv)
 * - Filter respect (export respects query parameters)
 * - Safety limit (10,000 records max)
 * - CSV escaping for special characters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/admin/teams/[teamId]/audit/export/route';
import { prisma } from '@/lib/prisma';

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
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'admin_token') {
        return { value: 'valid_admin_token' };
      }
      return undefined;
    }),
  })),
}));

vi.mock('@/lib/session-security', () => ({
  hashSessionToken: vi.fn((token: string) => `hashed_${token}`),
}));

describe('Audit Export Endpoint', () => {
  const mockTeamId = 'team-123';
  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const mockTeam = {
    id: mockTeamId,
    name: 'Test Team',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock admin session
    (prisma.adminSession.findUnique as any).mockResolvedValue({
      token: 'hashed_valid_admin_token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      admin: mockAdmin,
    });

    // Mock team
    (prisma.team.findUnique as any).mockResolvedValue(mockTeam);
  });

  it('should return 401 for unauthenticated requests', async () => {
    (prisma.adminSession.findUnique as any).mockResolvedValue(null);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 403 for non-admin users', async () => {
    (prisma.adminSession.findUnique as any).mockResolvedValue({
      token: 'hashed_valid_admin_token',
      expiresAt: new Date(Date.now() + 3600000),
      admin: { ...mockAdmin, role: 'JUDGE' }, // Not admin
    });

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('should return 404 for non-existent team', async () => {
    (prisma.team.findUnique as any).mockResolvedValue(null);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('TEAM_NOT_FOUND');
  });

  it('should generate CSV with correct headers and format', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2024-03-08T14:30:00Z'),
        action: 'UPDATE',
        fieldName: 'teamName',
        oldValue: 'Old Name',
        newValue: 'New Name',
        ipAddress: '192.168.1.1',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          teamMemberships: [{ role: 'LEADER' }],
        },
      },
      {
        id: 'log-2',
        timestamp: new Date('2024-03-08T14:30:00Z'),
        action: 'UPDATE',
        fieldName: 'member2Email',
        oldValue: 'old@example.com',
        newValue: 'new@example.com',
        ipAddress: '192.168.1.1',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          teamMemberships: [{ role: 'LEADER' }],
        },
      },
    ];

    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');

    const csv = await response.text();
    const lines = csv.split('\n');

    // Check headers
    expect(lines[0]).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');

    // Check data rows
    expect(lines[1]).toContain('John Doe');
    expect(lines[1]).toContain('john@example.com');
    expect(lines[1]).toContain('LEADER');
    expect(lines[1]).toContain('UPDATE');
    expect(lines[1]).toContain('teamName');
    expect(lines[1]).toContain('Old Name');
    expect(lines[1]).toContain('New Name');
    expect(lines[1]).toContain('192.168.1.1');

    expect(lines[2]).toContain('member2Email');
    expect(lines[2]).toContain('old@example.com');
    expect(lines[2]).toContain('new@example.com');
  });

  it('should generate filename with correct format: audit_[sanitizedTeamName]_[YYYY-MM-DD].csv', async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    const contentDisposition = response.headers.get('Content-Disposition');
    expect(contentDisposition).toMatch(/^attachment; filename="audit_Test_Team_\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it('should sanitize team name in filename (remove special characters)', async () => {
    (prisma.team.findUnique as any).mockResolvedValue({
      id: mockTeamId,
      name: 'Test@Team#123!',
    });
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    const contentDisposition = response.headers.get('Content-Disposition');
    // Special characters should be removed, spaces replaced with underscores
    expect(contentDisposition).toMatch(/filename="audit_TestTeam123_\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it('should respect filters (date range)', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2024-03-08T14:30:00Z'),
        action: 'UPDATE',
        fieldName: 'teamName',
        oldValue: 'Old',
        newValue: 'New',
        ipAddress: '192.168.1.1',
        user: {
          id: 'user-1',
          name: 'John',
          email: 'john@example.com',
          teamMemberships: [{ role: 'LEADER' }],
        },
      },
    ];

    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const req = new Request(
      `http://localhost/api/admin/teams/${mockTeamId}/audit/export?fromDate=2024-03-01&toDate=2024-03-31`
    );
    await GET(req, { params: { teamId: mockTeamId } });

    // Verify that findMany was called with date filters
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: mockTeamId,
          timestamp: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should respect filters (userId, fieldName, action)', async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(
      `http://localhost/api/admin/teams/${mockTeamId}/audit/export?userId=user-1&fieldName=teamName&action=UPDATE`
    );
    await GET(req, { params: { teamId: mockTeamId } });

    // Verify that findMany was called with all filters
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: mockTeamId,
          userId: 'user-1',
          fieldName: 'teamName',
          action: 'UPDATE',
        }),
      })
    );
  });

  it('should respect search filter', async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(
      `http://localhost/api/admin/teams/${mockTeamId}/audit/export?search=test`
    );
    await GET(req, { params: { teamId: mockTeamId } });

    // Verify that findMany was called with OR search conditions
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: mockTeamId,
          OR: expect.arrayContaining([
            expect.objectContaining({ oldValue: expect.any(Object) }),
            expect.objectContaining({ newValue: expect.any(Object) }),
          ]),
        }),
      })
    );
  });

  it('should return 413 when export exceeds 10,000 records', async () => {
    // Mock exactly 10,000 logs
    const mockLogs = Array.from({ length: 10000 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(),
      action: 'UPDATE',
      fieldName: 'teamName',
      oldValue: 'Old',
      newValue: 'New',
      ipAddress: '192.168.1.1',
      user: {
        id: 'user-1',
        name: 'John',
        email: 'john@example.com',
        teamMemberships: [{ role: 'LEADER' }],
      },
    }));

    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error).toBe('EXPORT_TOO_LARGE');
  });

  it('should escape CSV special characters (commas, quotes, newlines)', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2024-03-08T14:30:00Z'),
        action: 'UPDATE',
        fieldName: 'problemStatement',
        oldValue: 'Problem with "quotes" and, commas',
        newValue: 'New problem\nwith newlines',
        ipAddress: '192.168.1.1',
        user: {
          id: 'user-1',
          name: 'John, Doe',
          email: 'john@example.com',
          teamMemberships: [{ role: 'LEADER' }],
        },
      },
    ];

    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    const csv = await response.text();
    const lines = csv.split('\n');

    // Check that values with special characters are properly escaped
    expect(lines[1]).toContain('"John, Doe"'); // Comma in name
    expect(lines[1]).toContain('"Problem with ""quotes"" and, commas"'); // Quotes and comma
    // For newlines, the CSV will actually have a real newline character in the quoted field
    // So we need to check the full CSV text, not individual lines
    expect(csv).toContain('"New problem\nwith newlines"'); // Newline
  });

  it('should handle null values in CSV', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date('2024-03-08T14:30:00Z'),
        action: 'CREATE',
        fieldName: 'additionalNotes',
        oldValue: null,
        newValue: 'Some notes',
        ipAddress: null,
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
          teamMemberships: [{ role: 'LEADER' }],
        },
      },
    ];

    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    const csv = await response.text();
    const lines = csv.split('\n');

    // Null oldValue should be empty, null ipAddress should be N/A
    expect(lines[1]).toContain(',,'); // Empty oldValue
    expect(lines[1]).toContain('N/A'); // Null ipAddress
  });

  it('should return empty CSV with headers when no logs exist', async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    const response = await GET(req, { params: { teamId: mockTeamId } });

    const csv = await response.text();
    const lines = csv.split('\n');

    // Should have headers but no data rows
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');
  });

  it('should return 400 for invalid date format', async () => {
    const req = new Request(
      `http://localhost/api/admin/teams/${mockTeamId}/audit/export?fromDate=invalid-date`
    );
    const response = await GET(req, { params: { teamId: mockTeamId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_FILTER');
  });

  it('should order logs by timestamp descending', async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const req = new Request(`http://localhost/api/admin/teams/${mockTeamId}/audit/export`);
    await GET(req, { params: { teamId: mockTeamId } });

    // Verify that findMany was called with correct orderBy
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { timestamp: 'desc' },
      })
    );
  });
});
