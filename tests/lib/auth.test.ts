import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factories run
const { mockSessionFindUnique, mockSessionDelete, mockAdminSessionFindUnique, mockAdminSessionDelete, mockCookieGet } = vi.hoisted(() => ({
  mockSessionFindUnique: vi.fn(),
  mockSessionDelete: vi.fn().mockResolvedValue({}),
  mockAdminSessionFindUnique: vi.fn(),
  mockAdminSessionDelete: vi.fn().mockResolvedValue({}),
  mockCookieGet: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      findUnique: mockSessionFindUnique,
      delete: mockSessionDelete,
    },
    adminSession: {
      findUnique: mockAdminSessionFindUnique,
      delete: mockAdminSessionDelete,
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: mockCookieGet,
  })),
}));

import { getSession, checkAdminAuth } from '@/lib/auth';

describe('Auth Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return null when no session token cookie exists', async () => {
      mockCookieGet.mockReturnValue(undefined);
      const result = await getSession();
      expect(result).toBeNull();
    });

    it('should return null when session is not found in database', async () => {
      mockCookieGet.mockReturnValue({ value: 'invalid-token' });
      mockSessionFindUnique.mockResolvedValue(null);
      const result = await getSession();
      expect(result).toBeNull();
    });

    it('should return null when session has expired', async () => {
      mockCookieGet.mockReturnValue({ value: 'expired-token' });
      mockSessionFindUnique.mockResolvedValue({
        token: 'expired-token',
        expiresAt: new Date('2020-01-01'), // past date
        user: { id: '1', email: 'test@test.com', role: 'PARTICIPANT' },
      });
      const result = await getSession();
      expect(result).toBeNull();
    });

    it('should return session when token is valid and not expired', async () => {
      mockCookieGet.mockReturnValue({ value: 'valid-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockUser = { id: '1', email: 'test@test.com', role: 'PARTICIPANT' };
      mockSessionFindUnique.mockResolvedValue({
        token: 'valid-token',
        expiresAt: futureDate,
        user: mockUser,
      });

      const result = await getSession();
      expect(result).toEqual({
        user: mockUser,
        token: 'valid-token',
      });
    });
  });

  describe('checkAdminAuth', () => {
    it('should return null when no session exists', async () => {
      mockCookieGet.mockReturnValue(undefined);
      const result = await checkAdminAuth();
      expect(result).toBeNull();
    });

    it('should return null for non-admin users', async () => {
      mockCookieGet.mockReturnValue({ value: 'user-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // adminSession not found — user only has a participant session
      mockAdminSessionFindUnique.mockResolvedValue(null);

      const result = await checkAdminAuth();
      expect(result).toBeNull();
    });

    it('should return user for ADMIN role', async () => {
      mockCookieGet.mockReturnValue({ value: 'admin-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const adminUser = { id: '1', email: 'admin@test.com', role: 'ADMIN', isActive: true };
      mockAdminSessionFindUnique.mockResolvedValue({
        token: 'admin-token',
        expiresAt: futureDate,
        admin: adminUser,
      });

      const result = await checkAdminAuth();
      expect(result).toEqual(adminUser);
    });

    it('should return user for SUPER_ADMIN role', async () => {
      mockCookieGet.mockReturnValue({ value: 'super-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const superAdmin = { id: '2', email: 'super@test.com', role: 'SUPER_ADMIN', isActive: true };
      mockAdminSessionFindUnique.mockResolvedValue({
        token: 'super-token',
        expiresAt: futureDate,
        admin: superAdmin,
      });

      const result = await checkAdminAuth();
      expect(result).toEqual(superAdmin);
    });

    it('should return user for ORGANIZER role', async () => {
      mockCookieGet.mockReturnValue({ value: 'org-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const organizer = { id: '3', email: 'org@test.com', role: 'ORGANIZER', isActive: true };
      mockAdminSessionFindUnique.mockResolvedValue({
        token: 'org-token',
        expiresAt: futureDate,
        admin: organizer,
      });

      const result = await checkAdminAuth();
      expect(result).toEqual(organizer);
    });

    it('should return null for inactive admin', async () => {
      mockCookieGet.mockReturnValue({ value: 'inactive-token' });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockAdminSessionFindUnique.mockResolvedValue({
        token: 'inactive-token',
        expiresAt: futureDate,
        admin: { id: '4', email: 'inactive@test.com', role: 'ADMIN', isActive: false },
      });

      const result = await checkAdminAuth();
      expect(result).toBeNull();
    });
  });
});
