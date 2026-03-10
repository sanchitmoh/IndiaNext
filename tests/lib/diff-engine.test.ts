/**
 * Property-Based Tests for DiffEngine
 * 
 * These tests use fast-check to verify universal properties across
 * randomized inputs, ensuring the diff engine behaves correctly for
 * all possible registration data combinations.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DiffEngine, type FieldChange } from '../../lib/diff-engine';

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

describe('DiffEngine - Property-Based Tests', () => {
  const diffEngine = new DiffEngine();

  // Feature: admin-audit-trail, Property 4: Diff Engine Accuracy
  describe('Property 4: Diff Engine Accuracy', () => {
    it('should only return fields where values differ', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Verify every returned change has different values
            for (const change of changes) {
              const oldVal = oldData[change.fieldName];
              const newVal = newData[change.fieldName];
              
              // Values should be different (using JSON.stringify for deep comparison)
              expect(JSON.stringify(oldVal)).not.toBe(JSON.stringify(newVal));
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not return unchanged fields', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            const changedFieldNames = new Set(changes.map(c => c.fieldName));
            
            // Get all keys from both objects
            const allKeys = new Set([
              ...Object.keys(oldData),
              ...Object.keys(newData),
            ]);
            
            // For each field, if values are identical, it should NOT be in changes
            for (const key of allKeys) {
              const oldVal = oldData[key];
              const newVal = newData[key];
              
              if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
                // Unchanged field should not appear in results
                expect(changedFieldNames.has(key)).toBe(false);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly identify CREATE actions', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Verify CREATE actions are correct
            const createChanges = changes.filter(c => c.action === 'CREATE');
            for (const change of createChanges) {
              const oldVal = oldData[change.fieldName];
              const newVal = newData[change.fieldName];
              
              // CREATE means old value was null/undefined and new value exists
              expect(oldVal === null || oldVal === undefined).toBe(true);
              expect(newVal !== null && newVal !== undefined).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly identify DELETE actions', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Verify DELETE actions are correct
            const deleteChanges = changes.filter(c => c.action === 'DELETE');
            for (const change of deleteChanges) {
              const oldVal = oldData[change.fieldName];
              const newVal = newData[change.fieldName];
              
              // DELETE means old value existed and new value is null/undefined
              expect(oldVal !== null && oldVal !== undefined).toBe(true);
              expect(newVal === null || newVal === undefined).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly identify UPDATE actions', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Verify UPDATE actions are correct
            const updateChanges = changes.filter(c => c.action === 'UPDATE');
            for (const change of updateChanges) {
              const oldVal = oldData[change.fieldName];
              const newVal = newData[change.fieldName];
              
              // UPDATE means both values exist and are different
              expect(oldVal !== null && oldVal !== undefined).toBe(true);
              expect(newVal !== null && newVal !== undefined).toBe(true);
              expect(JSON.stringify(oldVal)).not.toBe(JSON.stringify(newVal));
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return empty array for identical objects', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          (data) => {
            // Compare object with itself
            const changes = diffEngine.diff(data, data);
            
            // Should return no changes
            expect(changes).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle empty objects', () => {
      fc.assert(
        fc.property(
          fc.constantFrom({}, {}),
          fc.constantFrom({}, {}),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Empty objects should produce no changes
            expect(changes).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should detect all changed fields', () => {
      fc.assert(
        fc.property(
          registrationDataGenerator(),
          registrationDataGenerator(),
          (oldData, newData) => {
            const changes = diffEngine.diff(oldData, newData);
            
            // Count expected changes manually
            const allKeys = new Set([
              ...Object.keys(oldData),
              ...Object.keys(newData),
            ]);
            
            let expectedChangeCount = 0;
            for (const key of allKeys) {
              const oldVal = oldData[key];
              const newVal = newData[key];
              
              if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                expectedChangeCount++;
              }
            }
            
            // Number of changes should match expected count
            expect(changes.length).toBe(expectedChangeCount);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

/**
 * Unit Tests for DiffEngine Edge Cases
 * 
 * These tests verify specific examples and edge cases to ensure
 * the diff engine handles all scenarios correctly.
 */
describe('DiffEngine - Unit Tests for Edge Cases', () => {
  const diffEngine = new DiffEngine();

  describe('Single field change', () => {
    it('should detect when only one field changes', () => {
      const oldData = {
        teamName: 'Old Team Name',
        college: 'MIT',
        member2Email: 'test@example.com',
      };
      const newData = {
        teamName: 'New Team Name',
        college: 'MIT',
        member2Email: 'test@example.com',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'teamName',
        action: 'UPDATE',
        oldValue: 'Old Team Name',
        newValue: 'New Team Name',
      });
    });
  });

  describe('Multiple field changes', () => {
    it('should detect when multiple fields change', () => {
      const oldData = {
        teamName: 'Old Team Name',
        college: 'MIT',
        member2Email: 'old@example.com',
        problemStatement: 'Old problem',
      };
      const newData = {
        teamName: 'New Team Name',
        college: 'Stanford',
        member2Email: 'new@example.com',
        problemStatement: 'Old problem',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(3);
      
      const fieldNames = changes.map(c => c.fieldName).sort();
      expect(fieldNames).toEqual(['college', 'member2Email', 'teamName']);
      
      const teamNameChange = changes.find(c => c.fieldName === 'teamName');
      expect(teamNameChange?.action).toBe('UPDATE');
      expect(teamNameChange?.oldValue).toBe('Old Team Name');
      expect(teamNameChange?.newValue).toBe('New Team Name');
      
      const collegeChange = changes.find(c => c.fieldName === 'college');
      expect(collegeChange?.action).toBe('UPDATE');
      expect(collegeChange?.oldValue).toBe('MIT');
      expect(collegeChange?.newValue).toBe('Stanford');
      
      const emailChange = changes.find(c => c.fieldName === 'member2Email');
      expect(emailChange?.action).toBe('UPDATE');
      expect(emailChange?.oldValue).toBe('old@example.com');
      expect(emailChange?.newValue).toBe('new@example.com');
    });
  });

  describe('Null to value (CREATE action)', () => {
    it('should detect CREATE when field goes from null to value', () => {
      const oldData = {
        teamName: 'Team Name',
        additionalNotes: null,
      };
      const newData = {
        teamName: 'Team Name',
        additionalNotes: 'Some notes added',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'additionalNotes',
        action: 'CREATE',
        oldValue: null,
        newValue: 'Some notes added',
      });
    });

    it('should detect CREATE when field goes from undefined to value', () => {
      const oldData = {
        teamName: 'Team Name',
      };
      const newData = {
        teamName: 'Team Name',
        member2Email: 'new@example.com',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'member2Email',
        action: 'CREATE',
        oldValue: undefined,
        newValue: 'new@example.com',
      });
    });
  });

  describe('Value to null (DELETE action)', () => {
    it('should detect DELETE when field goes from value to null', () => {
      const oldData = {
        teamName: 'Team Name',
        additionalNotes: 'Some notes',
      };
      const newData = {
        teamName: 'Team Name',
        additionalNotes: null,
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'additionalNotes',
        action: 'DELETE',
        oldValue: 'Some notes',
        newValue: null,
      });
    });

    it('should detect DELETE when field goes from value to undefined', () => {
      const oldData = {
        teamName: 'Team Name',
        member2Email: 'test@example.com',
      };
      const newData = {
        teamName: 'Team Name',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'member2Email',
        action: 'DELETE',
        oldValue: 'test@example.com',
        newValue: undefined,
      });
    });
  });

  describe('Empty objects', () => {
    it('should return empty array when both objects are empty', () => {
      const oldData = {};
      const newData = {};

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(0);
      expect(changes).toEqual([]);
    });

    it('should detect all fields as CREATE when old object is empty', () => {
      const oldData = {};
      const newData = {
        teamName: 'New Team',
        college: 'MIT',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(2);
      expect(changes.every(c => c.action === 'CREATE')).toBe(true);
      
      const teamNameChange = changes.find(c => c.fieldName === 'teamName');
      expect(teamNameChange?.oldValue).toBeUndefined();
      expect(teamNameChange?.newValue).toBe('New Team');
    });

    it('should detect all fields as DELETE when new object is empty', () => {
      const oldData = {
        teamName: 'Old Team',
        college: 'MIT',
      };
      const newData = {};

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(2);
      expect(changes.every(c => c.action === 'DELETE')).toBe(true);
      
      const teamNameChange = changes.find(c => c.fieldName === 'teamName');
      expect(teamNameChange?.oldValue).toBe('Old Team');
      expect(teamNameChange?.newValue).toBeUndefined();
    });
  });

  describe('Identical objects', () => {
    it('should return empty array when objects are identical', () => {
      const data = {
        teamName: 'Team Name',
        college: 'MIT',
        member2Email: 'test@example.com',
        problemStatement: 'A complex problem statement',
      };

      const changes = diffEngine.diff(data, data);

      expect(changes).toHaveLength(0);
      expect(changes).toEqual([]);
    });

    it('should return empty array when objects have same values but different references', () => {
      const oldData = {
        teamName: 'Team Name',
        college: 'MIT',
      };
      const newData = {
        teamName: 'Team Name',
        college: 'MIT',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(0);
      expect(changes).toEqual([]);
    });
  });

  describe('Nested objects (JSON stringified)', () => {
    it('should detect changes in nested objects using JSON comparison', () => {
      const oldData = {
        teamName: 'Team Name',
        metadata: { version: 1, tags: ['tag1'] },
      };
      const newData = {
        teamName: 'Team Name',
        metadata: { version: 2, tags: ['tag1', 'tag2'] },
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'metadata',
        action: 'UPDATE',
        oldValue: { version: 1, tags: ['tag1'] },
        newValue: { version: 2, tags: ['tag1', 'tag2'] },
      });
    });

    it('should not detect changes when nested objects are identical', () => {
      const oldData = {
        teamName: 'Team Name',
        metadata: { version: 1, tags: ['tag1', 'tag2'] },
      };
      const newData = {
        teamName: 'Team Name',
        metadata: { version: 1, tags: ['tag1', 'tag2'] },
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(0);
    });

    it('should handle arrays as nested values', () => {
      const oldData = {
        teamName: 'Team Name',
        skills: ['JavaScript', 'Python'],
      };
      const newData = {
        teamName: 'Team Name',
        skills: ['JavaScript', 'Python', 'Go'],
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'skills',
        action: 'UPDATE',
        oldValue: ['JavaScript', 'Python'],
        newValue: ['JavaScript', 'Python', 'Go'],
      });
    });

    it('should detect when nested object is added (CREATE)', () => {
      const oldData = {
        teamName: 'Team Name',
      };
      const newData = {
        teamName: 'Team Name',
        metadata: { version: 1 },
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'metadata',
        action: 'CREATE',
        oldValue: undefined,
        newValue: { version: 1 },
      });
    });

    it('should detect when nested object is removed (DELETE)', () => {
      const oldData = {
        teamName: 'Team Name',
        metadata: { version: 1 },
      };
      const newData = {
        teamName: 'Team Name',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'metadata',
        action: 'DELETE',
        oldValue: { version: 1 },
        newValue: undefined,
      });
    });
  });

  describe('Edge cases with special values', () => {
    it('should handle empty strings correctly', () => {
      const oldData = {
        teamName: 'Team Name',
        notes: '',
      };
      const newData = {
        teamName: 'Team Name',
        notes: 'Some notes',
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'notes',
        action: 'UPDATE',
        oldValue: '',
        newValue: 'Some notes',
      });
    });

    it('should handle zero values correctly', () => {
      const oldData = {
        teamName: 'Team Name',
        score: 0,
      };
      const newData = {
        teamName: 'Team Name',
        score: 100,
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'score',
        action: 'UPDATE',
        oldValue: 0,
        newValue: 100,
      });
    });

    it('should handle boolean values correctly', () => {
      const oldData = {
        teamName: 'Team Name',
        isActive: false,
      };
      const newData = {
        teamName: 'Team Name',
        isActive: true,
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'isActive',
        action: 'UPDATE',
        oldValue: false,
        newValue: true,
      });
    });

    it('should not confuse empty string with null', () => {
      const oldData = {
        teamName: 'Team Name',
        notes: '',
      };
      const newData = {
        teamName: 'Team Name',
        notes: null,
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'notes',
        action: 'DELETE',
        oldValue: '',
        newValue: null,
      });
    });

    it('should not confuse zero with null', () => {
      const oldData = {
        teamName: 'Team Name',
        score: 0,
      };
      const newData = {
        teamName: 'Team Name',
        score: null,
      };

      const changes = diffEngine.diff(oldData, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        fieldName: 'score',
        action: 'DELETE',
        oldValue: 0,
        newValue: null,
      });
    });
  });
});
