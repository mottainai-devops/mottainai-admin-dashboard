import { getUserById } from './db';

export interface LotAccessResult {
  hasAccess: boolean;
  error?: string;
}

/**
 * Validates whether a user has access to a specific lot.
 * 
 * Access rules:
 * - Admin and superadmin users have access to all lots
 * - Regular users can access any lot (field supervisors are assigned per session)
 * - If the user has a defaultLotCode, they are primarily associated with that lot,
 *   but can still access other lots (supervisor assignment is managed at session level)
 */
export async function validateLotAccess(
  userId: string,
  lotCode: string
): Promise<LotAccessResult> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return {
        hasAccess: false,
        error: 'User not found',
      };
    }

    // Admin and superadmin have access to all lots
    if (user.role === 'admin' || user.role === 'superadmin') {
      return { hasAccess: true };
    }

    // Field supervisors and regular users can access any lot
    // (Lot-level access control is managed at the company/assignment level)
    return { hasAccess: true };
  } catch (error) {
    console.error('[lotValidation] Error validating lot access:', error);
    return {
      hasAccess: false,
      error: 'Failed to validate lot access',
    };
  }
}
