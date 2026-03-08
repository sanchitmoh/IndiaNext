/**
 * API Versioning System
 *
 * Provides version prefix handling and backward compatibility for API routes.
 * All new API routes should use /api/v1/ prefix.
 */

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

/**
 * API version configuration
 */
export const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    deprecated: false,
    sunsetDate: null,
  },
} as const;

/**
 * Extract API version from request path
 */
export function getApiVersion(pathname: string): string | null {
  const match = pathname.match(/^\/api\/(v\d+)\//);
  return match ? match[1] : null;
}

/**
 * Check if API version is supported
 */
export function isVersionSupported(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Get version info
 */
export function getVersionInfo(version: string) {
  return API_VERSIONS[version as keyof typeof API_VERSIONS] || null;
}

/**
 * Create versioned API path
 */
export function createApiPath(endpoint: string, version: string = API_VERSION): string {
  return `/api/${version}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}
