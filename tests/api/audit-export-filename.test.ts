/**
 * Property-Based Test for Audit Trail Export Filename Format
 * 
 * Feature: admin-audit-trail, Property 8: Export Filename Format
 * **Validates: Requirements US-6.3**
 * 
 * This test verifies that export filenames follow the pattern:
 * audit_[sanitizedTeamName]_[YYYY-MM-DD].csv
 * where sanitizedTeamName contains only alphanumeric characters and underscores.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Prisma - must be defined before vi.mock
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

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue({ value: 'admin-token' }),
  })),
}));

// Mock session security
vi.mock('@/lib/session-security', () => ({
  hashSessionToken: vi.fn((token) => `hashed_${token}`),
}));

// Import after mocks are set up
import { GET } from '@/app/api/admin/teams/[teamId]/audit/export/route';
import { prisma } from '@/lib/prisma';

/**
 * Generator for team names with diverse characters
 * Includes special characters, spaces, unicode, etc. to test sanitization
 */
function teamNameGenerator() {
  return fc.oneof(
    // Normal names
    fc.string({ minLength: 3, maxLength: 50 }),
    // Names with special characters
    fc.constantFrom(
      'Team@Name!',
      'Team#123',
      'Team$Money',
      'Team%Percent',
      'Team&Co',
      'Team*Star',
      'Team(Parens)',
      'Team[Brackets]',
      'Team{Braces}',
      'Team<Angle>',
      'Team>Greater',
      'Team|Pipe',
      'Team\\Backslash',
      'Team/Slash',
      'Team:Colon',
      'Team;Semicolon',
      'Team"Quote',
      "Team'Apostrophe",
      'Team,Comma',
      'Team.Period',
      'Team?Question',
      'Team=Equals',
      'Team+Plus',
      'Team-Dash'
    ),
    // Names with spaces
    fc.constantFrom(
      'Team Name',
      'My Team Name',
      'Team   Multiple   Spaces',
      '  Leading Spaces',
      'Trailing Spaces  ',
      '  Both Sides  '
    ),
    // Names with unicode characters
    fc.constantFrom(
      'Team™',
      'Team©',
      'Team®',
      'Team€',
      'Team£',
      'Team¥',
      'Tëam Nämé',
      'Team 中文',
      'Team العربية',
      'Team 日本語'
    ),
    // Mixed alphanumeric
    fc.constantFrom(
      'Team123',
      '123Team',
      'Team_123',
      'Team-123',
      'TEAM_NAME_123',
      'team_name_123'
    ),
    // Edge cases
    fc.constantFrom(
      'A', // Very short
      'A'.repeat(100), // Very long
      '!!!', // Only special chars
      '   ', // Only spaces
      '123', // Only numbers
    )
  );
}

describe('Audit Trail Export API - Property 8: Export Filename Format', () => {
  const testTeamId = 'test-team-filename';

  // Mock admin session
  const mockAdminSession = {
    id: 'session-123',
    token: 'hashed_admin-token',
    expiresAt: new Date(Date.now() + 3600000),
    admin: {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (prisma.adminSession.findUnique as any).mockResolvedValue(mockAdminSession as any);
    (prisma.auditLog.findMany as any).mockResolvedValue([] as any);
  });

  it('should follow pattern audit_[sanitizedTeamName]_[YYYY-MM-DD].csv', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameGenerator(),
        async (teamName) => {
          // Mock team with generated name
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          expect(contentDisposition).toBeTruthy();
          
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          expect(filenameMatch).toBeTruthy();
          
          const filename = filenameMatch![1];

          // Verify filename matches pattern: audit_[sanitizedTeamName]_[YYYY-MM-DD].csv
          // Note: sanitizedTeamName can be empty if original name had no alphanumeric chars
          const filenamePattern = /^audit_([a-zA-Z0-9_]*)_(\d{4}-\d{2}-\d{2})\.csv$/;
          expect(filename).toMatch(filenamePattern);

          // Extract parts
          const match = filename.match(filenamePattern);
          expect(match).toBeTruthy();
          
          const sanitizedTeamName = match![1];
          const dateStr = match![2];

          // Verify sanitizedTeamName contains only alphanumeric and underscores (or is empty)
          if (sanitizedTeamName.length > 0) {
            expect(sanitizedTeamName).toMatch(/^[a-zA-Z0-9_]+$/);
          }
          // Verify date format is valid YYYY-MM-DD
          const datePattern = /^\d{4}-\d{2}-\d{2}$/;
          expect(dateStr).toMatch(datePattern);

          // Verify date is valid (can be parsed)
          const parsedDate = new Date(dateStr);
          expect(parsedDate.toString()).not.toBe('Invalid Date');

          // Verify date is today (since export uses current date)
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          expect(dateStr).toBe(todayStr);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize team names by removing special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameGenerator(),
        async (teamName) => {
          // Mock team with generated name
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          const filename = filenameMatch![1];

          // Extract sanitized team name
          const match = filename.match(/^audit_([a-zA-Z0-9_]*)_\d{4}-\d{2}-\d{2}\.csv$/);
          expect(match).toBeTruthy();
          
          const sanitizedTeamName = match![1];

          // Verify no special characters remain (only alphanumeric and underscores)
          expect(sanitizedTeamName).toMatch(/^[a-zA-Z0-9_]*$/);

          // Verify sanitized name is not empty (unless original was all special chars)
          // If original had any alphanumeric chars, sanitized should have them
          const hasAlphanumeric = /[a-zA-Z0-9]/.test(teamName);
          if (hasAlphanumeric) {
            expect(sanitizedTeamName.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should replace spaces with underscores in team names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Team Name',
          'My Team Name',
          'Team   Multiple   Spaces',
          '  Leading Spaces',
          'Trailing Spaces  ',
          '  Both Sides  ',
          'Single Space',
          'Multiple  Spaces  Here'
        ),
        async (teamName) => {
          // Mock team with name containing spaces
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          const filename = filenameMatch![1];

          // Extract sanitized team name
          const match = filename.match(/^audit_([a-zA-Z0-9_]+)_\d{4}-\d{2}-\d{2}\.csv$/);
          expect(match).toBeTruthy();
          
          const sanitizedTeamName = match![1];

          // Verify no spaces remain in sanitized name
          expect(sanitizedTeamName).not.toContain(' ');

          // Verify underscores are present (spaces should be replaced with underscores)
          // Count spaces in original name
          const spaceCount = (teamName.match(/\s+/g) || []).length;
          if (spaceCount > 0) {
            // Should have underscores (though consecutive spaces become single underscore)
            expect(sanitizedTeamName).toContain('_');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle team names with only special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '!!!',
          '@@@',
          '###',
          '$$$',
          '%%%',
          '&&&',
          '***',
          '(((',
          ')))',
          '---',
          '===',
          '+++',
          '...',
          ':::'
        ),
        async (teamName) => {
          // Mock team with name containing only special characters
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          const filename = filenameMatch![1];

          // Verify filename still follows pattern (even if sanitized name is empty)
          // Pattern should be: audit_[something]_[date].csv
          const filenamePattern = /^audit_([a-zA-Z0-9_]*)_(\d{4}-\d{2}-\d{2})\.csv$/;
          expect(filename).toMatch(filenamePattern);

          // Extract sanitized team name
          const match = filename.match(filenamePattern);
          const sanitizedTeamName = match![1];

          // Sanitized name should be empty or contain only underscores (from spaces)
          // since all special chars are removed
          expect(sanitizedTeamName).toMatch(/^[_]*$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should limit sanitized team name length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 51, maxLength: 200 }), // Generate long names
        async (teamName) => {
          // Mock team with long name
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          const filename = filenameMatch![1];

          // Extract sanitized team name
          const match = filename.match(/^audit_([a-zA-Z0-9_]*)_\d{4}-\d{2}-\d{2}\.csv$/);
          expect(match).toBeTruthy();
          
          const sanitizedTeamName = match![1];

          // Verify sanitized name is limited to 50 characters or less
          expect(sanitizedTeamName.length).toBeLessThanOrEqual(50);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve alphanumeric characters from original team name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Team123',
          'ABC_Team_XYZ',
          'Team@123#Name',
          'My-Team-2024',
          'Team_Name_v2',
          'ProjectAlpha',
          'TEAM_BETA_3'
        ),
        async (teamName) => {
          // Mock team with alphanumeric name
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export via API endpoint
          const req = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response = await GET(req, { params: { teamId: testTeamId } });

          // Verify response is successful
          expect(response.status).toBe(200);

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          const filenameMatch = contentDisposition!.match(/filename="(.+)"/);
          const filename = filenameMatch![1];

          // Extract sanitized team name
          const match = filename.match(/^audit_([a-zA-Z0-9_]+)_\d{4}-\d{2}-\d{2}\.csv$/);
          expect(match).toBeTruthy();
          
          const sanitizedTeamName = match![1];

          // Extract alphanumeric characters from original name
          const originalAlphanumeric = teamName.replace(/[^a-zA-Z0-9]/g, '');

          // Verify sanitized name contains the alphanumeric characters
          // (may have underscores added for spaces, but alphanumeric should be preserved)
          if (originalAlphanumeric.length > 0) {
            // Check that sanitized name contains alphanumeric chars from original
            // (order may differ due to space replacement, but chars should be present)
            const sanitizedAlphanumeric = sanitizedTeamName.replace(/_/g, '');
            
            // Verify sanitized has alphanumeric content
            expect(sanitizedAlphanumeric.length).toBeGreaterThan(0);
            
            // Verify all chars in sanitized are from original (or underscores)
            for (const char of sanitizedTeamName) {
              if (char !== '_') {
                expect(originalAlphanumeric).toContain(char);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate consistent filenames for same team on same day', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameGenerator(),
        async (teamName) => {
          // Mock team with generated name
          const mockTeam = {
            id: testTeamId,
            name: teamName,
          };
          (prisma.team.findUnique as any).mockResolvedValue(mockTeam as any);

          // Fetch export twice
          const req1 = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response1 = await GET(req1, { params: { teamId: testTeamId } });

          const req2 = new Request(`http://localhost/api/admin/teams/${testTeamId}/audit/export`);
          const response2 = await GET(req2, { params: { teamId: testTeamId } });

          // Extract filenames
          const contentDisposition1 = response1.headers.get('Content-Disposition');
          const filename1 = contentDisposition1!.match(/filename="(.+)"/)![1];

          const contentDisposition2 = response2.headers.get('Content-Disposition');
          const filename2 = contentDisposition2!.match(/filename="(.+)"/)![1];

          // Verify filenames are identical (same team, same day)
          expect(filename1).toBe(filename2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
