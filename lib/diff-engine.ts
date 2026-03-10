/**
 * DiffEngine - Compares two objects and identifies field-level changes
 * Used by the audit trail system to track registration modifications
 */

export interface FieldChange {
  fieldName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValue: any;
  newValue: any;
}

export class DiffEngine {
  /**
   * Compares two objects and returns an array of field-level changes
   * 
   * @param oldData - The original object state
   * @param newData - The new object state
   * @returns Array of FieldChange objects representing differences
   * 
   * Rules:
   * - CREATE: Field exists in newData but not in oldData (or oldData value is null/undefined)
   * - DELETE: Field exists in oldData but not in newData (or newData value is null/undefined)
   * - UPDATE: Field exists in both with different values
   * - Identical fields are skipped (not included in results)
   * - Uses JSON.stringify for deep comparison of complex values
   */
  diff(
    oldData: Record<string, any>,
    newData: Record<string, any>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    
    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(oldData),
      ...Object.keys(newData),
    ]);
    
    for (const key of allKeys) {
      const oldVal = oldData[key];
      const newVal = newData[key];
      
      // Skip if values are identical (deep comparison)
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
        continue;
      }
      
      // Determine action type based on old/new value presence
      let action: 'CREATE' | 'UPDATE' | 'DELETE';
      
      if (oldVal === undefined || oldVal === null) {
        // Field didn't exist or was null -> CREATE
        action = 'CREATE';
      } else if (newVal === undefined || newVal === null) {
        // Field existed but now doesn't or is null -> DELETE
        action = 'DELETE';
      } else {
        // Both exist but values differ -> UPDATE
        action = 'UPDATE';
      }
      
      changes.push({
        fieldName: key,
        action,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
    
    return changes;
  }
}

// Export singleton instance
export const diffEngine = new DiffEngine();
