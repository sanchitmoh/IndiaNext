/**
 * Unit tests for AuditService
 * Tests audit log creation with various scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from '../lib/audit-service';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    auditLog: {
      createMany: vi.fn(),
    },
  },
}));

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
    vi.clearAllMocks();
  });

  describe('captureChanges', () => {
    it('should create audit log entries for single field change', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { teamName: 'Old Name', college: 'MIT' },
        newData: { teamName: 'New Name', college: 'MIT' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const submissionId = await auditService.captureChanges(params);

      // Verify submissionId is returned
      expect(submissionId).toBeDefined();
      expect(typeof submissionId).toBe('string');

      // Verify createMany was called with correct data
      expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            teamId: 'team-123',
            userId: 'user-456',
            sessionId: 'session-789',
            submissionId,
            action: 'UPDATE',
            fieldName: 'teamName',
            oldValue: 'Old Name',
            newValue: 'New Name',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
        ],
      });
    });

    it('should create audit log entries for multiple field changes', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: {
          teamName: 'Old Name',
          member2Email: 'old@example.com',
          problemStatement: 'Old problem',
        },
        newData: {
          teamName: 'New Name',
          member2Email: 'new@example.com',
          problemStatement: 'New problem',
        },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const submissionId = await auditService.captureChanges(params);

      // Verify submissionId is returned
      expect(submissionId).toBeDefined();

      // Verify createMany was called with 3 entries
      expect(prisma.auditLog.createMany).toHaveBeenCalledOnce();
      const callArgs = (prisma.auditLog.createMany as any).mock.calls[0][0];
      expect(callArgs.data).toHaveLength(3);

      // Verify all entries share same submissionId
      const submissionIds = callArgs.data.map((entry: any) => entry.submissionId);
      expect(new Set(submissionIds).size).toBe(1);
      expect(submissionIds[0]).toBe(submissionId);
    });

    it('should handle CREATE action for new fields', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { teamName: 'Name' },
        newData: { teamName: 'Name', additionalNotes: 'Some notes' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await auditService.captureChanges(params);

      const callArgs = (prisma.auditLog.createMany as any).mock.calls[0][0];
      expect(callArgs.data[0].action).toBe('CREATE');
      expect(callArgs.data[0].fieldName).toBe('additionalNotes');
      expect(callArgs.data[0].oldValue).toBeNull();
      expect(callArgs.data[0].newValue).toBe('Some notes');
    });

    it('should handle DELETE action for removed fields', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { teamName: 'Name', additionalNotes: 'Some notes' },
        newData: { teamName: 'Name', additionalNotes: null },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await auditService.captureChanges(params);

      const callArgs = (prisma.auditLog.createMany as any).mock.calls[0][0];
      expect(callArgs.data[0].action).toBe('DELETE');
      expect(callArgs.data[0].fieldName).toBe('additionalNotes');
      expect(callArgs.data[0].oldValue).toBe('Some notes');
      expect(callArgs.data[0].newValue).toBeNull();
    });

    it('should serialize complex values to JSON strings', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { metadata: { key: 'old' } },
        newData: { metadata: { key: 'new' } },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await auditService.captureChanges(params);

      const callArgs = (prisma.auditLog.createMany as any).mock.calls[0][0];
      expect(callArgs.data[0].oldValue).toBe('{"key":"old"}');
      expect(callArgs.data[0].newValue).toBe('{"key":"new"}');
    });

    it('should not create audit logs when no changes detected', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { teamName: 'Name', college: 'MIT' },
        newData: { teamName: 'Name', college: 'MIT' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const submissionId = await auditService.captureChanges(params);

      // Verify submissionId is still returned
      expect(submissionId).toBeDefined();

      // Verify createMany was not called (no changes)
      expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
    });

    it('should capture IP address and user agent correctly', async () => {
      const params = {
        teamId: 'team-123',
        userId: 'user-456',
        sessionId: 'session-789',
        oldData: { teamName: 'Old' },
        newData: { teamName: 'New' },
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/91.0',
      };

      await auditService.captureChanges(params);

      const callArgs = (prisma.auditLog.createMany as any).mock.calls[0][0];
      expect(callArgs.data[0].ipAddress).toBe('10.0.0.1');
      expect(callArgs.data[0].userAgent).toBe('Chrome/91.0');
    });
  });
});
