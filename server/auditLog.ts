/**
 * Audit logging system for tracking user actions and security events
 * In-memory storage for simple auth, can be extended to use database
 */

export type AuditLogEntry = {
  id: number;
  timestamp: Date;
  action: string;
  userId?: number;
  username?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
};

// In-memory audit log storage
const AUDIT_LOGS: AuditLogEntry[] = [];
let nextLogId = 1;

/**
 * Add an audit log entry
 */
export function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const logEntry: AuditLogEntry = {
    id: nextLogId++,
    timestamp: new Date(),
    ...entry,
  };

  AUDIT_LOGS.push(logEntry);

  // Keep only last 1000 entries to prevent memory issues
  if (AUDIT_LOGS.length > 1000) {
    AUDIT_LOGS.shift();
  }

  // Log to console for debugging
  console.log(`[Audit] ${logEntry.action} - ${logEntry.details} (Success: ${logEntry.success})`);

  return logEntry;
}

/**
 * Get all audit logs
 */
export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  return AUDIT_LOGS.slice(-limit).reverse();
}

/**
 * Get audit logs for a specific user
 */
export function getUserAuditLogs(userId: number, limit: number = 50): AuditLogEntry[] {
  return AUDIT_LOGS
    .filter(log => log.userId === userId)
    .slice(-limit)
    .reverse();
}

/**
 * Get audit logs by action type
 */
export function getAuditLogsByAction(action: string, limit: number = 50): AuditLogEntry[] {
  return AUDIT_LOGS
    .filter(log => log.action === action)
    .slice(-limit)
    .reverse();
}

/**
 * Clear all audit logs (admin only, use with caution)
 */
export function clearAuditLogs(): void {
  AUDIT_LOGS.length = 0;
  nextLogId = 1;
  console.log('[Audit] All audit logs cleared');
}
