/**
 * AuditService - Captures and manages audit trail for registration changes
 * Used to track field-level modifications with full attribution
 */

import { prisma } from './prisma';
import { diffEngine, FieldChange } from './diff-engine';
import { randomUUID } from 'crypto';

export interface CaptureChangesParams {
  teamId: string;
  userId: string;
  sessionId: string;
  oldData: Record<string, any>;
  newData: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Serializes a value to a JSON string for storage in the database
 * Handles null/undefined values and complex objects
 */
function serializeValue(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's already a string, return as-is
  if (typeof value === 'string') {
    return value;
  }
  
  // For complex values (objects, arrays), serialize to JSON
  return JSON.stringify(value);
}

export class AuditService {
  /**
   * Captures changes between old and new registration data
   * Creates audit log entries for each changed field
   * 
   * @param params - Parameters including teamId, userId, sessionId, oldData, newData, ipAddress, userAgent
   * @returns submissionId - Unique identifier grouping all changes from this edit session
   * 
   * Process:
   * 1. Generate unique submissionId for grouping changes
   * 2. Use DiffEngine to identify changed fields
   * 3. Create AuditLog entry for each change with shared submissionId
   * 4. Serialize complex values to JSON strings for storage
   * 5. Return submissionId for transaction coordination
   */
  async captureChanges(params: CaptureChangesParams): Promise<string> {
    const {
      teamId,
      userId,
      sessionId,
      oldData,
      newData,
      ipAddress,
      userAgent,
    } = params;
    
    // Generate unique submissionId for grouping all changes from this edit session
    const submissionId = randomUUID();
    
    // Use DiffEngine to identify changed fields
    const changes: FieldChange[] = diffEngine.diff(oldData, newData);
    
    // Create audit log entry for each change
    const auditLogEntries = changes.map((change) => ({
      teamId,
      userId,
      sessionId,
      submissionId,
      action: change.action,
      fieldName: change.fieldName,
      oldValue: serializeValue(change.oldValue),
      newValue: serializeValue(change.newValue),
      ipAddress,
      userAgent,
    }));
    
    // Batch create all audit log entries
    if (auditLogEntries.length > 0) {
      await prisma.auditLog.createMany({
        data: auditLogEntries,
      });
    }
    
    // Return submissionId for transaction coordination
    return submissionId;
  }
}

// Export singleton instance
export const auditService = new AuditService();
