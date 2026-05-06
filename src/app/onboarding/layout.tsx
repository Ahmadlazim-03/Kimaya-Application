"use client";

import { AuthProvider } from "@/lib/AuthContext";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
