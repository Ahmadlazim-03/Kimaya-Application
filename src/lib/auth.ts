import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kimaya-management-jwt-secret-change-in-production-2026"
);
const COOKIE_NAME = "management-session";
const EXPIRY = "8h";

// ---- Types ----

export type UserRole = "DEVELOPER" | "ADMIN" | "THERAPIST";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  locationId?: string;
  avatarUrl?: string;
}

// ---- RBAC Permissions ----

// Which roles can access which pages
export const ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard":            ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/attendance": ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/attendance/calendar": ["DEVELOPER", "ADMIN"],
  "/dashboard/reports":    ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/scoring":    ["DEVELOPER", "ADMIN"],
  "/dashboard/reminders":  ["DEVELOPER", "ADMIN"],
  "/dashboard/employees":  ["DEVELOPER", "ADMIN"],
  "/dashboard/settings":   ["DEVELOPER", "ADMIN"],
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
  { label: "Dashboard",   href: "/dashboard",            icon: "LayoutDashboard", section: "main",  roles: ["DEVELOPER", "ADMIN", "THERAPIST"] },
  { label: "Absensi",     href: "/dashboard/attendance",  icon: "Clock",           section: "main",  roles: ["DEVELOPER", "ADMIN", "THERAPIST"] },
  { label: "Laporan",     href: "/dashboard/reports",     icon: "FileText",        section: "main",  roles: ["DEVELOPER", "ADMIN", "THERAPIST"] },
  { label: "Skoring",     href: "/dashboard/scoring",     icon: "Star",            section: "main",  roles: ["DEVELOPER", "ADMIN"] },
  { label: "Reminder",    href: "/dashboard/reminders",   icon: "Bell",            section: "main",  roles: ["DEVELOPER", "ADMIN"] },
  { label: "Karyawan",    href: "/dashboard/employees",   icon: "Users",           section: "admin", roles: ["DEVELOPER", "ADMIN"] },
  { label: "Pengaturan",  href: "/dashboard/settings",    icon: "Settings",        section: "admin", roles: ["DEVELOPER", "ADMIN"] },
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
    ADMIN: "Admin",
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

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
      avatarUrl: payload.avatarUrl as string | undefined,
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
