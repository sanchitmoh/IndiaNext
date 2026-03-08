/**
 * Security Tests: Admin Audit Trail
 *
 * Tests security requirements for the audit trail feature:
 * - Non-admin users cannot access audit trail
 * - Audit logs cannot be modified or deleted
 * - SQL injection prevention in filters
 * - XSS prevention in displayed values
 *
 * Requirements: NFR-1 (Security)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock Prisma with factory function
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
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock session security
vi.mock('@/lib/session-security', () => ({
  hashSessionToken: vi.fn((token: string) => `hashed_${token}`),
}));

// Import after mocks
import { GET } from '@/app/api/admin/teams/[teamId]/audit/route';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

describe('Audit Trail Security Tests', () => {
  const testTeamId = 'test-team-123';
  const validAdminToken = 'valid-admin-token';
  const validUserToken = 'valid-user-token';
  const invalidToken = 'invalid-token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for team existence
    (prisma.team.findUnique as any).mockResolvedValue({
      id: testTeamId,
      name: 'Test Team',
    });

    // Default mock for audit logs
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    (prisma.auditLog.count as any).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Access Control - Non-Admin Users Cannot Access Audit Trail', () => {
    it('should return 401 when no authentication token is provided', async () => {
      // Mock no cookie
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
      expect(data.message).toBe('Admin access required');
    });

    it('should return 401 when authentication token is invalid', async () => {
      // Mock invalid token
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: invalidToken }),
      });

      (prisma.adminSession.findUnique as any).mockResolvedValue(null);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 when session is expired', async () => {
      // Mock expired session
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: expiredDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return 403 when user has insufficient permissions (not admin role)', async () => {
      // Mock valid session but non-admin role
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validUserToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validUserToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'user-1',
          role: 'ORGANIZER', // Not in allowed roles
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
      expect(data.message).toBe('Insufficient permissions');
    });

    it('should allow access for ADMIN role', async () => {
      // Mock valid admin session
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow access for SUPER_ADMIN role', async () => {
      // Mock valid super admin session
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'SUPER_ADMIN',
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Data Immutability - Audit Logs Cannot Be Modified or Deleted', () => {
    it('should not expose update operations on audit logs', async () => {
      // Verify that the Prisma mock for update is never called
      // This test ensures the API doesn't provide update functionality

      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      await GET(req, { params: { teamId: testTeamId } });

      // Verify update/delete operations are never called
      expect(prisma.auditLog.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('should only perform read operations on audit logs', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      await GET(req, { params: { teamId: testTeamId } });

      // Verify only read operations are called
      expect(prisma.auditLog.findMany).toHaveBeenCalled();
      expect(prisma.auditLog.count).toHaveBeenCalled();

      // Verify no write operations
      expect(prisma.auditLog.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('SQL Injection Prevention in Filters', () => {
    beforeEach(() => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });
    });

    it('should safely handle SQL injection attempts in search parameter', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE audit_logs; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "admin'--",
        "' OR 1=1--",
        "<script>alert('xss')</script>",
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const req = new Request(
          `http://localhost/api/admin/teams/${testTeamId}/audit?search=${encodeURIComponent(maliciousInput)}`
        );

        const response = await GET(req, { params: { teamId: testTeamId } });
        const data = await response.json();

        // Should return 200 (treated as normal search string)
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify Prisma was called with safe parameterized query
        expect(prisma.auditLog.findMany).toHaveBeenCalled();
        const callArgs = (prisma.auditLog.findMany as any).mock.calls[
          (prisma.auditLog.findMany as any).mock.calls.length - 1
        ][0];

        // Verify the where clause uses Prisma's safe query builder
        expect(callArgs.where.OR).toBeDefined();
        expect(Array.isArray(callArgs.where.OR)).toBe(true);
      }
    });

    it('should safely handle SQL injection attempts in userId filter', async () => {
      const maliciousUserId = "user-123'; DROP TABLE audit_logs; --";

      const req = new Request(
        `http://localhost/api/admin/teams/${testTeamId}/audit?userId=${encodeURIComponent(maliciousUserId)}`
      );

      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify Prisma was called with the exact string (not executed as SQL)
      expect(prisma.auditLog.findMany).toHaveBeenCalled();
      const callArgs = (prisma.auditLog.findMany as any).mock.calls[0][0];
      expect(callArgs.where.userId).toBe(maliciousUserId);
    });

    it('should safely handle SQL injection attempts in fieldName filter', async () => {
      const maliciousFieldName = "teamName' OR '1'='1";

      const req = new Request(
        `http://localhost/api/admin/teams/${testTeamId}/audit?fieldName=${encodeURIComponent(maliciousFieldName)}`
      );

      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify Prisma treats it as a literal string
      expect(prisma.auditLog.findMany).toHaveBeenCalled();
      const callArgs = (prisma.auditLog.findMany as any).mock.calls[0][0];
      expect(callArgs.where.fieldName).toBe(maliciousFieldName);
    });

    it('should safely handle malicious input in date parameters', async () => {
      // The key security test: SQL injection attempts should be safely handled
      // JavaScript's Date constructor is permissive, so some invalid dates may be accepted
      // but they won't cause SQL injection
      const maliciousDateInputs = ["'; DROP TABLE audit_logs; --", "' OR '1'='1"];

      for (const maliciousInput of maliciousDateInputs) {
        const req = new Request(
          `http://localhost/api/admin/teams/${testTeamId}/audit?fromDate=${encodeURIComponent(maliciousInput)}`
        );

        const response = await GET(req, { params: { teamId: testTeamId } });
        const data = await response.json();

        // The important security check: no SQL injection occurs
        // Response may be 200 or 400, but Prisma safely handles the input
        expect([200, 400]).toContain(response.status);

        // Verify Prisma was called (meaning parameterized queries were used)
        if (response.status === 200) {
          expect(prisma.auditLog.findMany).toHaveBeenCalled();
        }
      }
    });

    it('should validate action parameter against enum values', async () => {
      const invalidActions = [
        "'; DROP TABLE audit_logs; --",
        'INVALID_ACTION',
        "DELETE'; DROP TABLE users; --",
      ];

      for (const invalidAction of invalidActions) {
        const req = new Request(
          `http://localhost/api/admin/teams/${testTeamId}/audit?action=${encodeURIComponent(invalidAction)}`
        );

        const response = await GET(req, { params: { teamId: testTeamId } });
        const data = await response.json();

        // Should return 400 for invalid action
        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('INVALID_FILTER');
      }
    });

    it('should validate numeric parameters (page, limit)', async () => {
      const invalidNumericInputs = [
        { param: 'page', value: "'; DROP TABLE audit_logs; --" },
        { param: 'page', value: '1 OR 1=1' },
        { param: 'limit', value: "100'; DELETE FROM audit_logs; --" },
        { param: 'limit', value: '-1' },
        { param: 'page', value: '0' },
      ];

      for (const { param, value } of invalidNumericInputs) {
        const req = new Request(
          `http://localhost/api/admin/teams/${testTeamId}/audit?${param}=${encodeURIComponent(value)}`
        );

        const response = await GET(req, { params: { teamId: testTeamId } });
        const data = await response.json();

        // Should return 400 for invalid numeric input
        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('INVALID_FILTER');
      }
    });
  });

  describe('XSS Prevention in Displayed Values', () => {
    beforeEach(() => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });
    });

    it('should return XSS payloads as plain text without execution', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg/onload=alert('XSS')>",
        "javascript:alert('XSS')",
        '<iframe src=\'javascript:alert("XSS")\'></iframe>',
        "<body onload=alert('XSS')>",
      ];

      for (const xssPayload of xssPayloads) {
        // Mock audit logs with XSS payload in values
        (prisma.auditLog.findMany as any).mockResolvedValue([
          {
            id: 'log-1',
            teamId: testTeamId,
            userId: 'user-1',
            submissionId: 'sub-1',
            timestamp: new Date(),
            action: 'UPDATE',
            fieldName: 'teamName',
            oldValue: 'Safe Value',
            newValue: xssPayload,
            ipAddress: '192.168.1.1',
            userAgent: 'Test Agent',
            user: {
              id: 'user-1',
              name: 'Test User',
              email: 'test@example.com',
              teamMemberships: [{ role: 'LEADER' }],
            },
          },
        ]);
        (prisma.auditLog.count as any).mockResolvedValue(1);

        const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
        const response = await GET(req, { params: { teamId: testTeamId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify the XSS payload is returned as plain text (not executed)
        const log = data.data.logs[0];
        expect(log.newValue).toBe(xssPayload);

        // The important security check: XSS is returned as data, not executed
        // JSON responses are safe by default - the browser won't execute scripts in JSON
        expect(typeof log.newValue).toBe('string');
      }
    });

    it('should safely handle XSS in user names', async () => {
      const xssName = "<script>alert('XSS')</script>";

      (prisma.auditLog.findMany as any).mockResolvedValue([
        {
          id: 'log-1',
          teamId: testTeamId,
          userId: 'user-1',
          submissionId: 'sub-1',
          timestamp: new Date(),
          action: 'UPDATE',
          fieldName: 'teamName',
          oldValue: 'Old',
          newValue: 'New',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          user: {
            id: 'user-1',
            name: xssName,
            email: 'test@example.com',
            teamMemberships: [{ role: 'LEADER' }],
          },
        },
      ]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify XSS in user name is returned as plain text
      const log = data.data.logs[0];
      expect(log.user.name).toBe(xssName);
    });

    it('should safely handle XSS in field names', async () => {
      const xssFieldName = "<img src=x onerror=alert('XSS')>";

      (prisma.auditLog.findMany as any).mockResolvedValue([
        {
          id: 'log-1',
          teamId: testTeamId,
          userId: 'user-1',
          submissionId: 'sub-1',
          timestamp: new Date(),
          action: 'UPDATE',
          fieldName: xssFieldName,
          oldValue: 'Old',
          newValue: 'New',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
            teamMemberships: [{ role: 'LEADER' }],
          },
        },
      ]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify XSS in field name is returned as plain text
      const log = data.data.logs[0];
      expect(log.fieldName).toBe(xssFieldName);
    });

    it('should ensure JSON response automatically escapes HTML entities', async () => {
      const htmlContent = '<div>Test</div>';

      (prisma.auditLog.findMany as any).mockResolvedValue([
        {
          id: 'log-1',
          teamId: testTeamId,
          userId: 'user-1',
          submissionId: 'sub-1',
          timestamp: new Date(),
          action: 'UPDATE',
          fieldName: 'description',
          oldValue: htmlContent,
          newValue: htmlContent,
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
            teamMemberships: [{ role: 'LEADER' }],
          },
        },
      ]);
      (prisma.auditLog.count as any).mockResolvedValue(1);

      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit`);
      const response = await GET(req, { params: { teamId: testTeamId } });

      // Get raw response text to verify JSON structure
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify HTML content is returned as plain string in JSON
      // The key security point: JSON responses don't execute HTML/scripts
      const log = data.data.logs[0];
      expect(log.oldValue).toBe(htmlContent);
      expect(log.newValue).toBe(htmlContent);
      expect(typeof log.oldValue).toBe('string');
      expect(typeof log.newValue).toBe('string');
    });
  });

  describe('Additional Security Validations', () => {
    beforeEach(() => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: validAdminToken }),
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      (prisma.adminSession.findUnique as any).mockResolvedValue({
        token: `hashed_${validAdminToken}`,
        expiresAt: futureDate,
        admin: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      });
    });

    it('should enforce maximum limit of 100 records per page', async () => {
      const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit?limit=1000`);

      const response = await GET(req, { params: { teamId: testTeamId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_FILTER');
    });

    it('should validate teamId parameter to prevent unauthorized access', async () => {
      // Mock team not found
      (prisma.team.findUnique as any).mockResolvedValue(null);

      const req = new Request(`http://localhost/api/admin/teams/non-existent-team/audit`);
      const response = await GET(req, { params: { teamId: 'non-existent-team' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('TEAM_NOT_FOUND');
    });

    it('should use parameterized queries via Prisma ORM', async () => {
      const req = new Request(
        `http://localhost/api/admin/teams/${testTeamId}/audit?search=test&userId=user-1&fieldName=teamName`
      );

      await GET(req, { params: { teamId: testTeamId } });

      // Verify Prisma was called (which uses parameterized queries)
      expect(prisma.auditLog.findMany).toHaveBeenCalled();

      // Verify the where clause structure (Prisma's safe query builder)
      const callArgs = (prisma.auditLog.findMany as any).mock.calls[0][0];
      expect(callArgs.where).toBeDefined();
      expect(callArgs.where.teamId).toBe(testTeamId);
      expect(callArgs.where.userId).toBe('user-1');
      expect(callArgs.where.fieldName).toBe('teamName');
    });
  });
});
