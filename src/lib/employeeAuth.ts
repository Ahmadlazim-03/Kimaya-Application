/**
 * Role hierarchy & location-scope helpers for employee management.
 *
 * Single source of truth for "who can create/edit/delete whom?" — used by
 * the employees API routes AND the employees UI (to decide which role/
 * location options to show in the form).
 *
 * Rules:
 *   DEVELOPER → any role, any location
 *   MANAGER   → any role, any location
 *   CS        → THERAPIST only, ONLY in the CS's own location
 *   THERAPIST → cannot manage employees at all
 */

import type { UserRole } from "@/lib/auth";

export const ALL_ROLES: UserRole[] = ["DEVELOPER", "MANAGER", "CS", "THERAPIST"];

/** Which target roles can `actorRole` create? */
export function rolesActorCanCreate(actorRole: UserRole): UserRole[] {
  if (actorRole === "DEVELOPER" || actorRole === "MANAGER") return ALL_ROLES;
  if (actorRole === "CS") return ["THERAPIST"];
  return [];
}

/** Boolean form of the above, for individual checks. */
export function canCreateRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return rolesActorCanCreate(actorRole).includes(targetRole);
}

/**
 * Can the actor edit/delete an existing employee given both sides'
 * (role, locationId)? CS is restricted to therapists in the same cabang.
 */
export function canManageEmployee(
  actor: { role: UserRole; locationId?: string | null },
  target: { role: UserRole; locationId?: string | null }
): boolean {
  if (actor.role === "DEVELOPER" || actor.role === "MANAGER") return true;
  if (actor.role === "CS") {
    if (target.role !== "THERAPIST") return false;
    if (!actor.locationId) return false;
    return target.locationId === actor.locationId;
  }
  return false;
}

/**
 * Whether the actor must be locked to a single location when creating /
 * editing an employee (true = lock the location picker to their own cabang).
 */
export function actorIsLocationLocked(actorRole: UserRole): boolean {
  return actorRole === "CS";
}
