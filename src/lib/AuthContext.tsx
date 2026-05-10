"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserRole = "DEVELOPER" | "MANAGER" | "CS" | "THERAPIST";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  locationId?: string;
  avatarUrl?: string;
  facePhotoUrl?: string;
  phone?: string;
  address?: string;
  onboardingCompleted?: boolean;
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isDeveloper: boolean;
  isManager: boolean;
  isCS: boolean;
  isAdmin: boolean;
  isTherapist: boolean;
  canAccess: (path: string) => boolean;
}

const ROLE_PAGES: Record<string, UserRole[]> = {
  "/dashboard":            ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
  "/dashboard/attendance": ["MANAGER", "CS", "THERAPIST"],
  "/dashboard/attendance/calendar": ["MANAGER", "CS"],
  "/dashboard/reports":    ["MANAGER", "CS", "THERAPIST"],
  "/dashboard/scoring":    ["MANAGER", "CS"],
  // Reminder root accepts all roles. Sub-paths refine:
  //   /reminders          → admin landing (page auto-redirects THERAPIST to /my)
  //   /reminders/my       → therapist landing
  //   /reminders/calendar → admin only (longest match wins)
  //   /reminders/[id]/respond  → all (API enforces ownership)
  //   /reminders/[id]/responses → admin only
  "/dashboard/reminders":            ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
  "/dashboard/reminders/calendar":   ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/reminders/my":         ["THERAPIST"],
  "/dashboard/employees":  ["DEVELOPER", "MANAGER", "CS"],
  "/dashboard/settings":   ["DEVELOPER", "MANAGER"],
  "/dashboard/locations":  ["DEVELOPER", "MANAGER"],
  "/dashboard/monitoring": ["DEVELOPER", "MANAGER"],
  "/dashboard/leaves":     ["DEVELOPER", "MANAGER", "CS", "THERAPIST"],
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setNeedsOnboarding(data.needsOnboarding || false);
      } else {
        setUser(null);
        setNeedsOnboarding(false);
        if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/onboarding")) {
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

  // Guard: redirect to onboarding if needed
  useEffect(() => {
    if (loading || !user) return;

    // If onboarding not completed and user is on dashboard, redirect to onboarding
    if (needsOnboarding && pathname?.startsWith("/dashboard")) {
      router.replace("/onboarding");
      return;
    }

    // If onboarding completed and user is on onboarding page, redirect to dashboard
    if (!needsOnboarding && pathname === "/onboarding") {
      router.replace("/dashboard");
      return;
    }

    // Role-based access guard
    if (!pathname?.startsWith("/dashboard")) return;
    const matchedPath = Object.keys(ROLE_PAGES)
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedPath && !ROLE_PAGES[matchedPath].includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router, needsOnboarding]);

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
    setNeedsOnboarding(false);
    router.replace("/login");
  };

  const refreshUser = async () => {
    await fetchUser();
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
  const isManager = user?.role === "MANAGER";
  const isCS = user?.role === "CS";
  const isAdmin = isDeveloper || isManager; // admin-level access
  const isTherapist = user?.role === "THERAPIST";

  return (
    <AuthContext.Provider value={{ user, loading, needsOnboarding, login, logout, refreshUser, isDeveloper, isManager, isCS, isAdmin, isTherapist, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
