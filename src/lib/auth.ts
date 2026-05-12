import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kimaya-management-jwt-secret-change-in-production-2026"
);
const COOKIE_NAME = "management-session";
const EXPIRY = "8h";

// ---- Types ----

export type UserRole = "DEVELOPER" | "MANAGER" | "CS" | "THERAPIST";

/**
 * Slim session payload — keep this SMALL.
 *
 * The whole object gets serialized into the JWT, signed, and stored in an
 * HTTP cookie. Browsers reject cookies whose name+value exceed 4 KB, so the
 * payload here must NOT include large fields like base64-encoded photos.
 * In particular: avatarUrl and facePhotoUrl are data URLs that can each be
 * 30–50 KB — adding them blew the cookie size limit, the browser silently
 * dropped Set-Cookie, and login appeared to fail. Photos belong in the DB,
 * fetched via /api/auth/me when needed.
 */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  locationId?: string;
}

// ---- RBAC Permissions ----

// Which roles can access which pages
export const ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard":            ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
  "/dashboard/attendance": ["MANAGER", "CS", "THERAPIST"],
  "/dashboard/attendance/calendar": ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/reports":    ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
  "/dashboard/scoring":    ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/reminders":  ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/employees":  ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/settings":   ["DEVELOPER", "MANAGER"],
  // Profile page is self-service and available to all roles. Note: this
  // entry must be MORE SPECIFIC than `/dashboard/settings` above so the
  // longest-prefix match in canAccess() picks it for therapists.
  "/dashboard/settings/profile": ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
};

// Menu items visible per role
export interface MenuItem {
  label: string;
  href: string;
  icon: string;
  section: "main" | "admin";
  roles: UserRole[];
}

export const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard",   href: "/dashboard",            icon: "LayoutDashboard", section: "main",  roles: ["DEVELOPER", "MANAGER", "CS", "THERAPIST"] },
  { label: "Absensi",     href: "/dashboard/attendance",  icon: "Clock",           section: "main",  roles: ["MANAGER", "CS", "THERAPIST"] },
  { label: "Laporan",     href: "/dashboard/reports",     icon: "FileText",        section: "main",  roles: ["DEVELOPER", "MANAGER", "CS", "THERAPIST"] },
  { label: "Skoring",     href: "/dashboard/scoring",     icon: "Star",            section: "main",  roles: ["DEVELOPER", "MANAGER", "CS"] },
  { label: "Pengingat",   href: "/dashboard/reminders",   icon: "Bell",            section: "main",  roles: ["DEVELOPER", "MANAGER", "CS"] },
  { label: "Karyawan",    href: "/dashboard/employees",   icon: "Users",           section: "admin", roles: ["DEVELOPER", "MANAGER", "CS"] },
  { label: "Pengaturan",  href: "/dashboard/settings",    icon: "Settings",        section: "admin", roles: ["DEVELOPER", "MANAGER"] },
];

export function getMenuForRole(role: UserRole): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccess(role: UserRole, path: string): boolean {
  const matchedPath = Object.keys(ROLE_PERMISSIONS)
    .filter((p) => path === p || path.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchedPath) return true;
  return ROLE_PERMISSIONS[matchedPath].includes(role);
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    DEVELOPER: "Developer",
    MANAGER: "Manager",
    CS: "Customer Service",
    THERAPIST: "Therapist",
  };
  return labels[role] || role;
}

// ---- JWT Token ----

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Whether the session cookie should be marked Secure.
 *
 * Production over HTTPS → must be true (default).
 * Production over plain HTTP (e.g. LAN testing on a phone via http://192.168.x.x):
 *   the browser will REJECT a Secure cookie on a non-secure origin, so login
 *   silently fails (cookie never stored → /api/auth/me returns 401 →
 *   AuthContext bounces to /login).
 *
 * Set COOKIE_SECURE=false in your env to opt out when serving over HTTP.
 * Set COOKIE_SECURE=true to force-on regardless of NODE_ENV.
 */
function shouldUseSecureCookie(): boolean {
  const explicit = process.env.COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as UserRole,
      departmentId: payload.departmentId as string | undefined,
      locationId: payload.locationId as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth(requiredRoles?: UserRole[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHORIZED");
  if (requiredRoles && !requiredRoles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
