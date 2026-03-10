/**
 * Property-Based Tests for AuditService
 * 
 * These tests use fast-check to verify universal properties across
 * randomized inputs, ensuring the audit service behaves correctly for
 * all possible registration data combinations.
 * 
 * Feature: admin-audit-trail
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { AuditService } from '../../lib/audit-service';
import { prisma } from '../../lib/prisma';
import { diffEngine } from '../../lib/diff-engine';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      createMany: vi.fn(),
    },
  },
}));

/**
 * Generator for registration data objects
 * Mirrors the structure of actual registration data with all possible fields
 */
function registrationDataGenerator() {
  return fc.record({
    // Team fields
    teamName: fc.option(fc.string({ minLength: 3, maxLength: 50 })),
    hearAbout: fc.option(fc.string({ maxLength: 100 })),
    additionalNotes: fc.option(fc.string({ maxLength: 500 })),
    
    // Leader fields
    leaderName: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
    leaderEmail: fc.option(fc.emailAddress()),
    leaderCollege: fc.option(fc.string({ minLength: 3, maxLength: 100 })),
    leaderDegree: fc.option(fc.string({ maxLength: 50 })),
    leaderGender: fc.option(fc.constantFrom('Male', 'Female', 'Other', 'Prefer not to say')),
    
    // Member 2 fields
    member2Email: fc.option(fc.emailAddress()),
    member2Name: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
    member2College: fc.option(fc.string({ minLength: 3, maxLength: 100 })),
    member2Degree: fc.option(fc.string({ maxLength: 50 })),
    member2Gender: fc.option(fc.constantFrom('Male', 'Female', 'Other', 'Prefer not to say')),
    
    // Member 3 fields
    member3Email: fc.option(fc.emailAddress()),
    member3Name: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
    member3College: fc.option(fc.string({ minLength: 3, maxLength: 100 })),
    member3Degree: fc.option(fc.string({ maxLength: 50 })),
    member3Gender: fc.option(fc.constantFrom('Male', 'Female', 'Other', 'Prefer not to say')),
    
    // Member 4 fields
    member4Email: fc.option(fc.emailAddress()),
    member4Name: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
    member4College: fc.option(fc.string({ minLength: 3, maxLength: 100 })),
    member4Degree: fc.option(fc.string({ maxLength: 50 })),
    member4Gender: fc.option(fc.constantFrom('Male', 'Female', 'Other', 'Prefer not to say')),
    
    // Track-specific fields
    track: fc.option(fc.constantFrom('IDEA_SPRINT', 'BUILD_STORM')),
    
    // IdeaSprint fields
    ideaTitle: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
    problemStatement: fc.option(fc.string({ minLength: 10, maxLength: 1000 })),
    proposedSolution: fc.option(fc.string({ minLength: 10, maxLength: 1000 })),
    targetUsers: fc.option(fc.string({ maxLength: 500 })),
    expectedImpact: fc.option(fc.string({ maxLength: 500 })),
    techStack: fc.option(fc.string({ maxLength: 200 })),
    docLink: fc.option(fc.webUrl()),
    
    // BuildStorm fields
    problemDesc: fc.option(fc.string({ minLength: 10, maxLength: 1000 })),
    githubLink: fc.option(fc.webUrl()),
  });
}

describe('AuditService - Property-Based Tests', () => {
  let auditService: AuditService;
  
  beforeEach(() => {
    auditService = new AuditService();
    vi.clearAllMocks();
  });

  // Feature: admin-audit-trail, Property 14: Complete Change Capture
  // Validates: Requirements US-8.1, US-3.3, US-3.4
  describe('Property 14: Complete Change Capture', () => {
    it('should create exactly N audit log entries for N changed fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Calculate expected number of changes using DiffEngine
            const expectedChanges = diffEngine.diff(oldData, newData);
            const expectedChangeCount = expectedChanges.length;
            
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            const submissionId = await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Verify exactly N audit log entries were created for N changed fields
            expect(capturedData.length).toBe(expectedChangeCount);
            
            // Verify submissionId is returned
            expect(submissionId).toBeDefined();
            expect(typeof submissionId).toBe('string');
            expect(submissionId.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should ensure all audit log entries share the same submissionId', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            const submissionId = await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Skip if no changes (empty array)
            if (capturedData.length === 0) {
              return;
            }
            
            // Verify all entries share the same submissionId
            const submissionIds = new Set(capturedData.map((entry: any) => entry.submissionId));
            expect(submissionIds.size).toBe(1);
            
            // Verify the submissionId matches the returned value
            expect(submissionIds.has(submissionId)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should capture all required metadata (ipAddress, userAgent) in each entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Verify each entry has required metadata
            for (const entry of capturedData) {
              expect(entry.ipAddress).toBe(ipAddress);
              expect(entry.userAgent).toBe(userAgent);
              expect(entry.teamId).toBe(teamId);
              expect(entry.userId).toBe(userId);
              expect(entry.sessionId).toBe(sessionId);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should create audit logs with correct field names matching the changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Calculate expected changes
            const expectedChanges = diffEngine.diff(oldData, newData);
            const expectedFieldNames = new Set(expectedChanges.map(c => c.fieldName));
            
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Verify field names match
            const actualFieldNames = new Set(capturedData.map((entry: any) => entry.fieldName));
            expect(actualFieldNames).toEqual(expectedFieldNames);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should create audit logs with correct actions (CREATE, UPDATE, DELETE)', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Calculate expected changes
            const expectedChanges = diffEngine.diff(oldData, newData);
            
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Verify each entry has the correct action
            for (const entry of capturedData) {
              const expectedChange = expectedChanges.find(c => c.fieldName === entry.fieldName);
              expect(expectedChange).toBeDefined();
              expect(entry.action).toBe(expectedChange!.action);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should serialize old and new values correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (oldData, newData, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Calculate expected changes
            const expectedChanges = diffEngine.diff(oldData, newData);
            
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            
            // Verify values are serialized correctly
            for (const entry of capturedData) {
              const expectedChange = expectedChanges.find(c => c.fieldName === entry.fieldName);
              expect(expectedChange).toBeDefined();
              
              // Check oldValue serialization
              if (expectedChange!.oldValue === null || expectedChange!.oldValue === undefined) {
                expect(entry.oldValue).toBeNull();
              } else if (typeof expectedChange!.oldValue === 'string') {
                expect(entry.oldValue).toBe(expectedChange!.oldValue);
              } else {
                expect(entry.oldValue).toBe(JSON.stringify(expectedChange!.oldValue));
              }
              
              // Check newValue serialization
              if (expectedChange!.newValue === null || expectedChange!.newValue === undefined) {
                expect(entry.newValue).toBeNull();
              } else if (typeof expectedChange!.newValue === 'string') {
                expect(entry.newValue).toBe(expectedChange!.newValue);
              } else {
                expect(entry.newValue).toBe(JSON.stringify(expectedChange!.newValue));
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle case with no changes (identical data)', async () => {
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (data, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Mock prisma.auditLog.createMany to capture the data
            let capturedData: any[] = [];
            (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
              capturedData = args.data;
              return { count: args.data.length };
            });
            
            // Call captureChanges with identical data
            const submissionId = await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData: data,
              newData: data,
              ipAddress,
              userAgent,
            });
            
            // Should create no audit log entries
            expect(capturedData.length).toBe(0);
            
            // Should still return a submissionId
            expect(submissionId).toBeDefined();
            expect(typeof submissionId).toBe('string');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
