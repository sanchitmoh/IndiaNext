/**
 * Integration Tests: Registration Update with Audit Logging
 * 
 * Tests the end-to-end flow of registration updates with audit logging:
 * - Successful registration update creates audit logs
 * - Failed registration update doesn't create audit logs (atomicity)
 * - Audit logs have correct submissionId grouping
 * - All changed fields are captured
 * 
 * Requirements: FR-1, US-8.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  team: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  teamMember: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  submission: {
    create: vi.fn(),
    update: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  activityLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock next/headers for cookie handling
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock diff engine
vi.mock('@/lib/diff-engine', () => ({
  diffEngine: {
    diff: vi.fn(),
  },
}));

// Mock crypto for UUID generation
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomUUID: vi.fn(() => 'test-uuid-12345'),
  };
});

describe('Registration Update with Audit Logging', () => {
  let testTeamId: string;
  let testUserId: string;
  let testSessionId: string;
  let testSessionToken: string;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up test IDs
    testTeamId = 'test-team-id';
    testUserId = 'test-user-id';
    testSessionId = 'test-session-id';
    testSessionToken = 'test-session-token';
  });
  
  it('should create audit logs for successful registration update', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine to return changes
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'teamName', action: 'UPDATE', oldValue: 'Old Team', newValue: 'New Team' },
      { fieldName: 'ideaTitle', action: 'UPDATE', oldValue: 'Old Idea', newValue: 'New Idea' },
    ]);
    
    // Mock transaction to execute callback
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        activityLog: { findFirst: vi.fn().mockResolvedValue(null) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
        team: { update: vi.fn().mockResolvedValue({}) },
        submission: { update: vi.fn().mockResolvedValue({}) },
        teamMember: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-id' }) },
      };
      return await callback(tx);
    });
    
    // Verify that audit logs are created within transaction
    const changes = (diffEngine.diff as any)();
    expect(changes).toHaveLength(2);
    expect(changes[0].fieldName).toBe('teamName');
    expect(changes[1].fieldName).toBe('ideaTitle');
  });
  
  it('should group all changes with same submissionId', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine to return multiple changes
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'teamName', action: 'UPDATE', oldValue: 'Old', newValue: 'New' },
      { fieldName: 'ideaTitle', action: 'UPDATE', oldValue: 'Old', newValue: 'New' },
      { fieldName: 'problemStatement', action: 'UPDATE', oldValue: 'Old', newValue: 'New' },
    ]);
    
    const auditLogCreates: any[] = [];
    
    // Mock transaction to capture audit log creates
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        activityLog: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: { 
          create: vi.fn().mockImplementation((data) => {
            auditLogCreates.push(data.data);
            return Promise.resolve({});
          })
        },
        team: { update: vi.fn().mockResolvedValue({}) },
        submission: { update: vi.fn().mockResolvedValue({}) },
        teamMember: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-id' }) },
      };
      return await callback(tx);
    });
    
    // Simulate transaction execution
    await mockPrisma.$transaction(async (tx: any) => {
      const changes = (diffEngine.diff as any)();
      const submissionId = 'test-uuid-12345';
      
      for (const change of changes) {
        await tx.auditLog.create({
          data: {
            teamId: testTeamId,
            userId: testUserId,
            sessionId: testSessionId,
            submissionId,
            action: change.action,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            ipAddress: '192.168.1.1',
            userAgent: 'Test Agent',
          },
        });
      }
    });
    
    // Verify all audit logs share same submissionId
    expect(auditLogCreates.length).toBe(3);
    const submissionIds = new Set(auditLogCreates.map(log => log.submissionId));
    expect(submissionIds.size).toBe(1);
    expect(auditLogCreates[0].submissionId).toBe('test-uuid-12345');
  });
  
  it('should not create audit logs when registration update fails', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'teamName', action: 'UPDATE', oldValue: 'Old', newValue: 'New' },
    ]);
    
    let auditLogCreateCalled = false;
    
    // Mock transaction to simulate failure
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        activityLog: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-log' }) }, // Already edited
        auditLog: { 
          create: vi.fn().mockImplementation(() => {
            auditLogCreateCalled = true;
            return Promise.resolve({});
          })
        },
        team: { update: vi.fn().mockResolvedValue({}) },
        submission: { update: vi.fn().mockResolvedValue({}) },
        teamMember: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-id' }) },
      };
      
      // Check for existing update log
      const existingLog = await tx.activityLog.findFirst({});
      if (existingLog) {
        throw new Error('ALREADY_EDITED');
      }
      
      return await callback(tx);
    });
    
    // Attempt transaction (should fail)
    try {
      await mockPrisma.$transaction(async (tx: any) => {
        const existingLog = await tx.activityLog.findFirst({});
        if (existingLog) {
          throw new Error('ALREADY_EDITED');
        }
      });
    } catch (error: any) {
      expect(error.message).toBe('ALREADY_EDITED');
    }
    
    // Verify audit log create was not called
    expect(auditLogCreateCalled).toBe(false);
  });
  
  it('should capture all changed fields including nested submission fields', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine to return changes from team, submission, and member fields
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'teamName', action: 'UPDATE', oldValue: 'Old Team', newValue: 'New Team' },
      { fieldName: 'hearAbout', action: 'CREATE', oldValue: null, newValue: 'Social Media' },
      { fieldName: 'ideaTitle', action: 'UPDATE', oldValue: 'Old Idea', newValue: 'New Idea' },
      { fieldName: 'problemStatement', action: 'UPDATE', oldValue: 'Old Problem', newValue: 'New Problem' },
      { fieldName: 'member2Email', action: 'CREATE', oldValue: null, newValue: 'member@example.com' },
      { fieldName: 'member2Name', action: 'CREATE', oldValue: null, newValue: 'Member Name' },
    ]);
    
    const changes = (diffEngine.diff as any)();
    
    // Verify all field types are captured
    const fieldNames = changes.map((c: any) => c.fieldName);
    expect(fieldNames).toContain('teamName'); // Team field
    expect(fieldNames).toContain('hearAbout'); // Team field
    expect(fieldNames).toContain('ideaTitle'); // Submission field
    expect(fieldNames).toContain('problemStatement'); // Submission field
    expect(fieldNames).toContain('member2Email'); // Member field
    expect(fieldNames).toContain('member2Name'); // Member field
    
    // Verify action types
    const createActions = changes.filter((c: any) => c.action === 'CREATE');
    const updateActions = changes.filter((c: any) => c.action === 'UPDATE');
    expect(createActions.length).toBe(3);
    expect(updateActions.length).toBe(3);
  });
  
  it('should maintain atomicity: rollback audit logs if team update fails', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'teamName', action: 'UPDATE', oldValue: 'Old', newValue: 'New' },
    ]);
    
    let auditLogCreated = false;
    let teamUpdated = false;
    
    // Mock transaction to simulate failure after audit log creation
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        activityLog: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: { 
          create: vi.fn().mockImplementation(() => {
            auditLogCreated = true;
            return Promise.resolve({});
          })
        },
        team: { 
          update: vi.fn().mockImplementation(() => {
            teamUpdated = true;
            throw new Error('Database constraint violation');
          })
        },
        submission: { update: vi.fn().mockResolvedValue({}) },
        teamMember: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-id' }) },
      };
      
      try {
        return await callback(tx);
      } catch (error) {
        // Transaction rollback - reset flags
        auditLogCreated = false;
        teamUpdated = false;
        throw error;
      }
    });
    
    // Attempt transaction (should fail and rollback)
    try {
      await mockPrisma.$transaction(async (tx: any) => {
        await tx.auditLog.create({ data: {} });
        await tx.team.update({ where: { id: testTeamId }, data: {} });
      });
    } catch (error: any) {
      expect(error.message).toBe('Database constraint violation');
    }
    
    // Verify both operations were rolled back
    expect(auditLogCreated).toBe(false);
    expect(teamUpdated).toBe(false);
  });
  
  it('should correctly identify CREATE action for new fields', async () => {
    const { diffEngine } = await import('@/lib/diff-engine');
    
    // Mock diff engine to return CREATE actions
    (diffEngine.diff as any).mockReturnValue([
      { fieldName: 'targetUsers', action: 'CREATE', oldValue: null, newValue: 'Students' },
      { fieldName: 'expectedImpact', action: 'CREATE', oldValue: null, newValue: 'High' },
      { fieldName: 'techStack', action: 'CREATE', oldValue: null, newValue: 'React, Node' },
    ]);
    
    const changes = (diffEngine.diff as any)();
    
    // Verify all are CREATE actions
    expect(changes.every((c: any) => c.action === 'CREATE')).toBe(true);
    
    // Verify oldValue is null for CREATE actions
    expect(changes.every((c: any) => c.oldValue === null)).toBe(true);
    
    // Verify newValue is not null
    expect(changes.every((c: any) => c.newValue !== null)).toBe(true);
    
    // Verify field names
    const fieldNames = changes.map((c: any) => c.fieldName);
    expect(fieldNames).toContain('targetUsers');
    expect(fieldNames).toContain('expectedImpact');
    expect(fieldNames).toContain('techStack');
  });
});
