/**
 * Input Sanitization Utilities
 * 
 * Prevents XSS and injection attacks by sanitizing user input.
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes all HTML tags and dangerous characters
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  // Only escape angle brackets (XSS vectors). Quotes don't need escaping
  // because React's JSX auto-escapes text content, and Prisma parameterizes queries.
  // Escaping quotes causes &#x27; / &quot; to appear as literal text in the UI.
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitize text input (basic cleaning)
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w.@+-]/g, ''); // Only allow valid email characters
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize phone number (keep only digits)
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  
  return phone.replace(/\D/g, '');
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    sanitizeHtml?: boolean;
    sanitizeUrls?: boolean;
  } = {}
): T {
  const { sanitizeHtml: shouldSanitizeHtml = true, sanitizeUrls = true } = options;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Check if it's a URL field
      if (sanitizeUrls && (key.toLowerCase().includes('url') || key.toLowerCase().includes('link'))) {
        sanitized[key] = sanitizeUrl(value);
      }
      // Check if it's an email field
      else if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeEmail(value);
      }
      // Check if it's a phone field
      else if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile')) {
        sanitized[key] = sanitizePhone(value);
      }
      // Default text sanitization
      else {
        sanitized[key] = shouldSanitizeHtml ? sanitizeHtml(value) : sanitizeText(value);
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>, options)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Validate and sanitize SQL-like input (prevent SQL injection)
 */
export function sanitizeSqlInput(input: string): string {
  if (!input) return '';
  
  // Remove common SQL injection patterns
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment start
    .replace(/\*\//g, '') // Remove multi-line comment end
    .replace(/xp_/gi, '') // Remove extended stored procedures
    .replace(/sp_/gi, '') // Remove system stored procedures
    .trim();
}

/**
 * Sanitize filename (prevent directory traversal)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
    .replace(/\.{2,}/g, '.') // Remove multiple dots
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Check if string contains potential XSS
 */
export function containsXss(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if string contains potential SQL injection
 */
export function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(;|--|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /('|")\s*(OR|AND)\s*('|")/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}
