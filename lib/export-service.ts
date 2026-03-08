/**
 * ExportService - Converts audit logs to CSV format for export
 * Handles CSV escaping, formatting, and proper header generation
 */

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  ipAddress: string | null;
  userAgent: string | null;
}

export class ExportService {
  /**
   * Converts audit log entries to CSV format
   *
   * @param logs - Array of audit log entries to convert
   * @returns CSV string with headers and data rows
   *
   * CSV Format:
   * - Headers: Timestamp, User, Email, Role, Action, Field, Old Value, New Value, IP Address
   * - Timestamps formatted as YYYY-MM-DD HH:mm:ss
   * - Special characters (quotes, commas, newlines) are properly escaped
   * - Null values displayed as empty strings
   */
  toCSV(logs: AuditLogEntry[]): string {
    // Define CSV headers
    const headers = [
      'Timestamp',
      'User',
      'Email',
      'Role',
      'Action',
      'Field',
      'Old Value',
      'New Value',
      'IP Address',
    ];

    // Convert logs to CSV rows
    const rows = logs.map((log) => [
      this.formatTimestamp(log.timestamp),
      log.user.name,
      log.user.email,
      log.user.role,
      log.action,
      this.formatFieldName(log.fieldName),
      this.escapeCSV(log.oldValue),
      this.escapeCSV(log.newValue),
      log.ipAddress || '',
    ]);

    // Combine headers and rows
    const allRows = [headers, ...rows];

    // Join each row with commas and rows with newlines
    return allRows.map((row) => row.join(',')).join('\n');
  }

  /**
   * Formats a timestamp to readable format: YYYY-MM-DD HH:mm:ss
   * Uses UTC time to ensure consistency across timezones
   *
   * @param date - Date object to format
   * @returns Formatted timestamp string in UTC
   */
  private formatTimestamp(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Formats field names to be more human-readable
   * Converts camelCase to Title Case with spaces
   *
   * @param fieldName - Field name in camelCase
   * @returns Formatted field name
   *
   * Examples:
   * - teamName -> Team Name
   * - member2Email -> Member 2 Email
   * - problemStatement -> Problem Statement
   */
  private formatFieldName(fieldName: string): string {
    // Insert space before capital letters and numbers
    const withSpaces = fieldName.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1');

    // Capitalize first letter of each word
    return withSpaces
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Escapes CSV special characters (quotes, commas, newlines)
   *
   * @param value - Value to escape (can be null)
   * @returns Escaped CSV value
   *
   * Rules:
   * - Null values return empty string
   * - Values with quotes, commas, or newlines are wrapped in quotes
   * - Quotes inside values are doubled ("")
   */
  private escapeCSV(value: string | null): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert to string if not already
    const stringValue = String(value);

    // Check if value contains special characters that require escaping
    const needsEscaping =
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r');

    if (needsEscaping) {
      // Escape quotes by doubling them
      const escaped = stringValue.replace(/"/g, '""');
      // Wrap in quotes
      return `"${escaped}"`;
    }

    return stringValue;
  }
}

// Export singleton instance
export const exportService = new ExportService();
