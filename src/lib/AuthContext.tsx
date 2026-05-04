"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserRole = "DEVELOPER" | "ADMIN" | "THERAPIST";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  locationId?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isDeveloper: boolean;
  isAdmin: boolean;
  isTherapist: boolean;
  canAccess: (path: string) => boolean;
}

const ROLE_PAGES: Record<string, UserRole[]> = {
  "/dashboard":            ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/attendance": ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/attendance/calendar": ["DEVELOPER", "ADMIN"],
  "/dashboard/reports":    ["DEVELOPER", "ADMIN", "THERAPIST"],
  "/dashboard/scoring":    ["DEVELOPER", "ADMIN"],
  "/dashboard/reminders":  ["DEVELOPER", "ADMIN"],
  "/dashboard/employees":  ["DEVELOPER", "ADMIN"],
  "/dashboard/settings":   ["DEVELOPER", "ADMIN"],
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
        if (pathname?.startsWith("/dashboard")) {
          router.replace("/login");
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Guard: redirect if no access
  useEffect(() => {
    if (loading || !user) return;
    if (!pathname?.startsWith("/dashboard")) return;

    const matchedPath = Object.keys(ROLE_PAGES)
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedPath && !ROLE_PAGES[matchedPath].includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchUser();
      return { success: true };
    }
    return { success: false, error: data.error || "Login gagal" };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    const matched = Object.keys(ROLE_PAGES)
      .filter((p) => path === p || path.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    if (!matched) return true;
    return ROLE_PAGES[matched].includes(user.role);
  };

  const isDeveloper = user?.role === "DEVELOPER";
  const isAdmin = user?.role === "ADMIN" || isDeveloper;
  const isTherapist = user?.role === "THERAPIST";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDeveloper, isAdmin, isTherapist, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
