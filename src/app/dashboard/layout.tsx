"use client";

import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import Header from "@/app/components/Header";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-kimaya-cream-light">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive mx-auto mb-3" />
          <p className="text-sm text-kimaya-brown-light/50">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-kimaya-cream-light">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-kimaya-olive mx-auto mb-3" />
          <p className="text-sm text-kimaya-brown-light/50">Mengalihkan ke login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-kimaya-cream-light overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
