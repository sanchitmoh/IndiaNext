/**
 * Unit Tests: ExportService
 * 
 * Tests the ExportService class to ensure it correctly:
 * - Converts audit logs to CSV format
 * - Includes all required headers
 * - Escapes CSV special characters (quotes, commas, newlines)
 * - Formats timestamps in readable format
 * - Handles null values appropriately
 * - Formats field names to be human-readable
 * 
 * Requirements: FR-4, US-6.2
 */

import { describe, it, expect } from 'vitest';
import { ExportService, AuditLogEntry } from '../../lib/export-service';

describe('ExportService', () => {
  const exportService = new ExportService();
  
  // Helper function to create a test audit log entry
  const createTestLog = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
    id: 'test-id-123',
    timestamp: new Date('2024-03-08T14:30:00.000Z'),
    action: 'UPDATE',
    fieldName: 'teamName',
    oldValue: 'Old Name',
    newValue: 'New Name',
    user: {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'LEADER',
    },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  });
  
  describe('toCSV', () => {
    it('should include all required CSV headers', () => {
      const logs = [createTestLog()];
      const csv = exportService.toCSV(logs);
      
      const lines = csv.split('\n');
      const headers = lines[0];
      
      expect(headers).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');
    });
    
    it('should convert single audit log to CSV row', () => {
      const logs = [createTestLog()];
      const csv = exportService.toCSV(logs);
      
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 data row
      
      const dataRow = lines[1];
      expect(dataRow).toContain('2024-03-08 14:30:00'); // Timestamp
      expect(dataRow).toContain('John Doe'); // User
      expect(dataRow).toContain('john@example.com'); // Email
      expect(dataRow).toContain('LEADER'); // Role
      expect(dataRow).toContain('UPDATE'); // Action
      expect(dataRow).toContain('Team Name'); // Field (formatted)
      expect(dataRow).toContain('Old Name'); // Old Value
      expect(dataRow).toContain('New Name'); // New Value
      expect(dataRow).toContain('192.168.1.1'); // IP Address
    });
    
    it('should convert multiple audit logs to CSV rows', () => {
      const logs = [
        createTestLog({ fieldName: 'teamName', oldValue: 'Old Name', newValue: 'New Name' }),
        createTestLog({ fieldName: 'member2Email', oldValue: 'old@test.com', newValue: 'new@test.com' }),
        createTestLog({ fieldName: 'problemStatement', oldValue: 'Old problem', newValue: 'New problem' }),
      ];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(4); // Header + 3 data rows
      expect(lines[1]).toContain('Team Name');
      expect(lines[2]).toContain('Member 2 Email');
      expect(lines[3]).toContain('Problem Statement');
    });
    
    it('should handle empty array', () => {
      const csv = exportService.toCSV([]);
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(1); // Only headers
      expect(lines[0]).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');
    });
  });
  
  describe('CSV escaping', () => {
    it('should escape values containing commas', () => {
      const logs = [createTestLog({
        oldValue: 'Value with, comma',
        newValue: 'Another, value, with, commas',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Values with commas should be wrapped in quotes
      expect(dataRow).toContain('"Value with, comma"');
      expect(dataRow).toContain('"Another, value, with, commas"');
    });
    
    it('should escape values containing quotes', () => {
      const logs = [createTestLog({
        oldValue: 'Value with "quotes"',
        newValue: 'She said "hello"',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Quotes should be doubled and value wrapped in quotes
      expect(dataRow).toContain('"Value with ""quotes"""');
      expect(dataRow).toContain('"She said ""hello"""');
    });
    
    it('should escape values containing newlines', () => {
      const logs = [createTestLog({
        oldValue: 'Line 1\nLine 2',
        newValue: 'Line A\nLine B\nLine C',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      
      // Values with newlines should be wrapped in quotes
      // Note: The CSV will have the newlines preserved inside quotes
      expect(csv).toContain('"Line 1\nLine 2"');
      expect(csv).toContain('"Line A\nLine B\nLine C"');
    });
    
    it('should escape values containing carriage returns', () => {
      const logs = [createTestLog({
        oldValue: 'Line 1\r\nLine 2',
        newValue: 'Windows\r\nLine\r\nBreaks',
      })];
      
      const csv = exportService.toCSV(logs);
      
      // Values with carriage returns should be wrapped in quotes
      expect(csv).toContain('"Line 1\r\nLine 2"');
      expect(csv).toContain('"Windows\r\nLine\r\nBreaks"');
    });
    
    it('should escape values with multiple special characters', () => {
      const logs = [createTestLog({
        oldValue: 'Complex, value with "quotes"\nand newlines',
        newValue: 'Another "complex", value\nwith, everything',
      })];
      
      const csv = exportService.toCSV(logs);
      
      // All special characters should be handled
      expect(csv).toContain('"Complex, value with ""quotes""\nand newlines"');
      expect(csv).toContain('"Another ""complex"", value\nwith, everything"');
    });
    
    it('should not escape simple values without special characters', () => {
      const logs = [createTestLog({
        oldValue: 'SimpleValue',
        newValue: 'AnotherSimpleValue',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Simple values should not be wrapped in quotes
      expect(dataRow).toContain('SimpleValue');
      expect(dataRow).toContain('AnotherSimpleValue');
      expect(dataRow).not.toContain('"SimpleValue"');
      expect(dataRow).not.toContain('"AnotherSimpleValue"');
    });
  });
  
  describe('null value handling', () => {
    it('should handle null oldValue', () => {
      const logs = [createTestLog({
        oldValue: null,
        newValue: 'New Value',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Null should be represented as empty string
      const columns = dataRow.split(',');
      expect(columns[6]).toBe(''); // Old Value column
      expect(columns[7]).toBe('New Value'); // New Value column
    });
    
    it('should handle null newValue', () => {
      const logs = [createTestLog({
        oldValue: 'Old Value',
        newValue: null,
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Null should be represented as empty string
      const columns = dataRow.split(',');
      expect(columns[6]).toBe('Old Value'); // Old Value column
      expect(columns[7]).toBe(''); // New Value column
    });
    
    it('should handle null ipAddress', () => {
      const logs = [createTestLog({
        ipAddress: null,
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      // Null IP should be represented as empty string (last column)
      const columns = dataRow.split(',');
      expect(columns[8]).toBe(''); // IP Address is the 9th column (index 8)
    });
    
    it('should handle all null values', () => {
      const logs = [createTestLog({
        oldValue: null,
        newValue: null,
        ipAddress: null,
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(2); // Should still produce valid CSV
      expect(lines[0]).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');
    });
  });
  
  describe('timestamp formatting', () => {
    it('should format timestamp as YYYY-MM-DD HH:mm:ss', () => {
      const logs = [createTestLog({
        timestamp: new Date('2024-03-08T14:30:45.123Z'),
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('2024-03-08 14:30:45');
    });
    
    it('should pad single-digit months and days with zeros', () => {
      const logs = [createTestLog({
        timestamp: new Date('2024-01-05T09:05:03.000Z'),
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('2024-01-05 09:05:03');
    });
    
    it('should handle midnight correctly', () => {
      const logs = [createTestLog({
        timestamp: new Date('2024-12-31T00:00:00.000Z'),
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('2024-12-31 00:00:00');
    });
    
    it('should handle end of day correctly', () => {
      const logs = [createTestLog({
        timestamp: new Date('2024-12-31T23:59:59.999Z'),
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('2024-12-31 23:59:59');
    });
  });
  
  describe('field name formatting', () => {
    it('should format camelCase field names to Title Case', () => {
      const testCases = [
        { input: 'teamName', expected: 'Team Name' },
        { input: 'problemStatement', expected: 'Problem Statement' },
        { input: 'proposedSolution', expected: 'Proposed Solution' },
        { input: 'hearAbout', expected: 'Hear About' },
        { input: 'additionalNotes', expected: 'Additional Notes' },
      ];
      
      for (const { input, expected } of testCases) {
        const logs = [createTestLog({ fieldName: input })];
        const csv = exportService.toCSV(logs);
        
        expect(csv).toContain(expected);
      }
    });
    
    it('should format field names with numbers correctly', () => {
      const testCases = [
        { input: 'member2Email', expected: 'Member 2 Email' },
        { input: 'member3Name', expected: 'Member 3 Name' },
        { input: 'member4College', expected: 'Member 4 College' },
      ];
      
      for (const { input, expected } of testCases) {
        const logs = [createTestLog({ fieldName: input })];
        const csv = exportService.toCSV(logs);
        
        expect(csv).toContain(expected);
      }
    });
    
    it('should handle single-word field names', () => {
      const logs = [createTestLog({ fieldName: 'track' })];
      const csv = exportService.toCSV(logs);
      
      expect(csv).toContain('Track');
    });
    
    it('should handle all-lowercase field names', () => {
      const logs = [createTestLog({ fieldName: 'email' })];
      const csv = exportService.toCSV(logs);
      
      expect(csv).toContain('Email');
    });
  });
  
  describe('action types', () => {
    it('should handle CREATE action', () => {
      const logs = [createTestLog({
        action: 'CREATE',
        oldValue: null,
        newValue: 'New Value',
      })];
      
      const csv = exportService.toCSV(logs);
      expect(csv).toContain('CREATE');
    });
    
    it('should handle UPDATE action', () => {
      const logs = [createTestLog({
        action: 'UPDATE',
        oldValue: 'Old Value',
        newValue: 'New Value',
      })];
      
      const csv = exportService.toCSV(logs);
      expect(csv).toContain('UPDATE');
    });
    
    it('should handle DELETE action', () => {
      const logs = [createTestLog({
        action: 'DELETE',
        oldValue: 'Old Value',
        newValue: null,
      })];
      
      const csv = exportService.toCSV(logs);
      expect(csv).toContain('DELETE');
    });
  });
  
  describe('user roles', () => {
    it('should include LEADER role', () => {
      const logs = [createTestLog({
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@test.com',
          role: 'LEADER',
        },
      })];
      
      const csv = exportService.toCSV(logs);
      expect(csv).toContain('LEADER');
    });
    
    it('should include MEMBER role', () => {
      const logs = [createTestLog({
        user: {
          id: 'user-2',
          name: 'Jane Smith',
          email: 'jane@test.com',
          role: 'MEMBER',
        },
      })];
      
      const csv = exportService.toCSV(logs);
      expect(csv).toContain('MEMBER');
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle realistic audit log with all fields populated', () => {
      const logs = [createTestLog({
        timestamp: new Date('2024-03-08T14:30:00.000Z'),
        action: 'UPDATE',
        fieldName: 'problemStatement',
        oldValue: 'Our team wants to solve the problem of inefficient task management in small teams.',
        newValue: 'Our team wants to solve the problem of inefficient task management in small teams. We will build a web application that helps teams collaborate better.',
        user: {
          id: 'user-123',
          name: 'Alice Johnson',
          email: 'alice.johnson@university.edu',
          role: 'LEADER',
        },
        ipAddress: '192.168.1.100',
      })];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('Timestamp,User,Email,Role,Action,Field,Old Value,New Value,IP Address');
      expect(lines[1]).toContain('2024-03-08 14:30:00');
      expect(lines[1]).toContain('Alice Johnson');
      expect(lines[1]).toContain('alice.johnson@university.edu');
      expect(lines[1]).toContain('LEADER');
      expect(lines[1]).toContain('UPDATE');
      expect(lines[1]).toContain('Problem Statement');
      expect(lines[1]).toContain('192.168.1.100');
    });
    
    it('should handle multiple logs from same submission', () => {
      const submissionId = 'sub-123';
      const timestamp = new Date('2024-03-08T14:30:00.000Z');
      const user = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'LEADER',
      };
      
      const logs = [
        createTestLog({ timestamp, user, fieldName: 'teamName', oldValue: 'Old Team', newValue: 'New Team' }),
        createTestLog({ timestamp, user, fieldName: 'member2Email', oldValue: 'old@test.com', newValue: 'new@test.com' }),
        createTestLog({ timestamp, user, fieldName: 'problemStatement', oldValue: 'Old problem', newValue: 'New problem' }),
      ];
      
      const csv = exportService.toCSV(logs);
      const lines = csv.split('\n');
      
      expect(lines).toHaveLength(4); // Header + 3 rows
      
      // All rows should have same timestamp and user
      for (let i = 1; i <= 3; i++) {
        expect(lines[i]).toContain('2024-03-08 14:30:00');
        expect(lines[i]).toContain('John Doe');
      }
    });
  });
});
