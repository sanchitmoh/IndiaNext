/**
 * Property-Based Test: Performance Constraint
 *
 * Feature: admin-audit-trail, Property 16: Performance Constraint
 * Validates: Requirements US-8.5
 *
 * This test verifies that the audit logging overhead (diff calculation + audit log creation)
 * adds less than 50ms to the registration update process, ensuring the feature doesn't
 * negatively impact user experience.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { AuditService } from '../../lib/audit-service';
import { diffEngine } from '../../lib/diff-engine';
import { prisma } from '../../lib/prisma';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      createMany: vi.fn(),
    },
  },
}));

/**
 * Generator for registration data objects with various sizes
 * Tests performance across different data complexities
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

describe('Audit Performance - Property-Based Tests', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
    vi.clearAllMocks();

    // Mock prisma.auditLog.createMany to simulate database write
    (prisma.auditLog.createMany as any).mockImplementation(async (args: any) => {
      // Simulate minimal database latency (1-2ms)
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { count: args.data.length };
    });
  });

  // Feature: admin-audit-trail, Property 16: Performance Constraint
  // Validates: Requirements US-8.5
  describe('Property 16: Performance Constraint', () => {
    it('should complete diff calculation and audit log creation in less than 50ms', async () => {
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
            // Measure time for diff calculation
            const diffStartTime = performance.now();
            const changes = diffEngine.diff(oldData, newData);
            const diffEndTime = performance.now();
            const diffTime = diffEndTime - diffStartTime;

            // Measure time for audit log creation
            const auditStartTime = performance.now();
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });
            const auditEndTime = performance.now();
            const auditTime = auditEndTime - auditStartTime;

            // Total time should be less than 50ms
            const totalTime = diffTime + auditTime;

            // Log performance metrics for debugging (only if test fails)
            if (totalTime >= 50) {
              console.log('Performance test failed:');
              console.log(`  Diff time: ${diffTime.toFixed(2)}ms`);
              console.log(`  Audit time: ${auditTime.toFixed(2)}ms`);
              console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
              console.log(`  Number of changes: ${changes.length}`);
              console.log(`  Old data keys: ${Object.keys(oldData).length}`);
              console.log(`  New data keys: ${Object.keys(newData).length}`);
            }

            expect(totalTime).toBeLessThan(50);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain performance with maximum field changes', async () => {
      // Test worst-case scenario: all fields changed
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (teamId, userId, sessionId, ipAddress, userAgent) => {
            // Create two completely different registration objects (maximum changes)
            const oldData = {
              teamName: 'Old Team Name',
              hearAbout: 'Old source',
              additionalNotes: 'Old notes',
              leaderName: 'Old Leader',
              leaderEmail: 'old@example.com',
              leaderCollege: 'Old College',
              leaderDegree: 'Old Degree',
              leaderGender: 'Male',
              member2Email: 'oldmember2@example.com',
              member2Name: 'Old Member 2',
              member2College: 'Old College 2',
              member2Degree: 'Old Degree 2',
              member2Gender: 'Female',
              member3Email: 'oldmember3@example.com',
              member3Name: 'Old Member 3',
              member3College: 'Old College 3',
              member3Degree: 'Old Degree 3',
              member3Gender: 'Other',
              member4Email: 'oldmember4@example.com',
              member4Name: 'Old Member 4',
              member4College: 'Old College 4',
              member4Degree: 'Old Degree 4',
              member4Gender: 'Prefer not to say',
              track: 'IDEA_SPRINT',
              ideaTitle: 'Old Idea Title',
              problemStatement:
                'Old problem statement with lots of text to simulate real-world usage',
              proposedSolution:
                'Old proposed solution with lots of text to simulate real-world usage',
              targetUsers: 'Old target users',
              expectedImpact: 'Old expected impact',
              techStack: 'Old tech stack',
              docLink: 'https://old.example.com',
            };

            const newData = {
              teamName: 'New Team Name',
              hearAbout: 'New source',
              additionalNotes: 'New notes',
              leaderName: 'New Leader',
              leaderEmail: 'new@example.com',
              leaderCollege: 'New College',
              leaderDegree: 'New Degree',
              leaderGender: 'Female',
              member2Email: 'newmember2@example.com',
              member2Name: 'New Member 2',
              member2College: 'New College 2',
              member2Degree: 'New Degree 2',
              member2Gender: 'Male',
              member3Email: 'newmember3@example.com',
              member3Name: 'New Member 3',
              member3College: 'New College 3',
              member3Degree: 'New Degree 3',
              member3Gender: 'Female',
              member4Email: 'newmember4@example.com',
              member4Name: 'New Member 4',
              member4College: 'New College 4',
              member4Degree: 'New Degree 4',
              member4Gender: 'Male',
              track: 'BUILD_STORM',
              problemDesc: 'New problem description with lots of text to simulate real-world usage',
              githubLink: 'https://github.com/new/repo',
            };

            // Measure total time
            const startTime = performance.now();

            // Perform diff and audit log creation
            const changes = diffEngine.diff(oldData, newData);
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Log performance metrics for debugging
            if (totalTime >= 50) {
              console.log('Maximum changes performance test failed:');
              console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
              console.log(`  Number of changes: ${changes.length}`);
            }

            expect(totalTime).toBeLessThan(50);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain performance with large text fields', async () => {
      // Test with very large text fields (problem statements, solutions, etc.)
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (teamId, userId, sessionId, ipAddress, userAgent) => {
            // Create registration data with large text fields
            const largeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
              20
            ); // ~1000 chars

            const oldData = {
              teamName: 'Team Name',
              problemStatement: largeText,
              proposedSolution: largeText,
              targetUsers: largeText,
              expectedImpact: largeText,
              additionalNotes: largeText,
            };

            const newData = {
              teamName: 'Team Name',
              problemStatement: largeText + ' Updated',
              proposedSolution: largeText + ' Updated',
              targetUsers: largeText + ' Updated',
              expectedImpact: largeText + ' Updated',
              additionalNotes: largeText + ' Updated',
            };

            // Measure total time
            const startTime = performance.now();

            // Perform diff and audit log creation
            const changes = diffEngine.diff(oldData, newData);
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData,
              newData,
              ipAddress,
              userAgent,
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Log performance metrics for debugging
            if (totalTime >= 50) {
              console.log('Large text fields performance test failed:');
              console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
              console.log(`  Number of changes: ${changes.length}`);
              console.log(`  Text field size: ~${largeText.length} chars`);
            }

            expect(totalTime).toBeLessThan(50);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have minimal overhead for no changes (identical data)', async () => {
      // Test performance when no changes are detected
      await fc.assert(
        fc.asyncProperty(
          registrationDataGenerator(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 200 }),
          async (data, teamId, userId, sessionId, ipAddress, userAgent) => {
            // Measure total time with identical data
            const startTime = performance.now();

            // Perform diff and audit log creation with identical data
            const changes = diffEngine.diff(data, data);
            await auditService.captureChanges({
              teamId,
              userId,
              sessionId,
              oldData: data,
              newData: data,
              ipAddress,
              userAgent,
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Should be very fast (no changes to process)
            // Even more strict requirement for no-change case
            expect(totalTime).toBeLessThan(10);
            expect(changes.length).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
