"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Clock, FileText, Star, Bell, Users, Settings,
  ChevronLeft, LogOut, Droplets, X, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type UserRole } from "@/lib/AuthContext";

const iconMap: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Clock, FileText, Star, Bell, Users, Settings,
};

interface NavDef {
  label: string;
  href: string;
  icon: string;
  section: "main" | "admin";
  roles: UserRole[];
}

const allNavItems: NavDef[] = [
  { label: "Dashboard",  href: "/dashboard",            icon: "LayoutDashboard", section: "main",  roles: ["DEVELOPER", "ADMIN", "THERAPIST"] },
  { label: "Absensi",    href: "/dashboard/attendance",  icon: "Clock",           section: "main",  roles: ["ADMIN", "THERAPIST"] },
  { label: "Laporan",    href: "/dashboard/reports",     icon: "FileText",        section: "main",  roles: ["DEVELOPER", "ADMIN", "THERAPIST"] },
  { label: "Skoring",    href: "/dashboard/scoring",     icon: "Star",            section: "main",  roles: ["DEVELOPER", "ADMIN"] },
  { label: "Reminder",   href: "/dashboard/reminders",   icon: "Bell",            section: "main",  roles: ["DEVELOPER", "ADMIN"] },
  { label: "Karyawan",   href: "/dashboard/employees",   icon: "Users",           section: "admin", roles: ["DEVELOPER", "ADMIN"] },
  { label: "Pengaturan", href: "/dashboard/settings",    icon: "Settings",        section: "admin", roles: ["DEVELOPER", "ADMIN"] },
];

const roleLabels: Record<UserRole, string> = {
  DEVELOPER: "Developer",
  ADMIN: "Admin",
  THERAPIST: "Therapist",
};

const roleBadgeColors: Record<UserRole, string> = {
  DEVELOPER: "bg-blue-500/20 text-blue-300",
  ADMIN: "bg-kimaya-olive/30 text-kimaya-gold",
  THERAPIST: "bg-kimaya-cream/20 text-kimaya-cream/60",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userRole = user?.role || "THERAPIST";
  const filteredNav = allNavItems.filter((item) => item.roles.includes(userRole));
  const mainNav = filteredNav.filter((item) => item.section === "main");
  const adminNav = filteredNav.filter((item) => item.section === "admin");

  const sidebarWidth = collapsed ? "w-[72px]" : "w-[260px]";

  const userInitials = user?.fullName
    ?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

  const NavItem = ({ item }: { item: NavDef }) => {
    const isActive = pathname === item.href;
    const Icon = iconMap[item.icon] || LayoutDashboard;

    return (
      <Link href={item.href} onClick={onClose}
        className={cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
          isActive ? "bg-white/10 text-kimaya-cream shadow-sm" : "text-kimaya-cream/50 hover:text-kimaya-cream hover:bg-white/5"
        )}>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
          className={cn("flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors",
            isActive ? "bg-kimaya-olive text-kimaya-cream" : "text-kimaya-cream/50 group-hover:text-kimaya-cream"
          )}>
          <Icon size={18} strokeWidth={1.8} />
        </motion.div>
        {!collapsed && (
          <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="truncate">
            {item.label}
          </motion.span>
        )}
        {!collapsed && isActive && (
          <motion.div layoutId="active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-kimaya-gold" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-kimaya-brown transition-all duration-300",
        sidebarWidth, isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <div className={cn("flex items-center h-[72px] border-b border-white/10 px-4 flex-shrink-0", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <motion.div whileHover={{ rotate: 10 }} className="w-9 h-9 rounded-full bg-kimaya-olive/30 flex items-center justify-center">
                <Droplets size={18} className="text-kimaya-gold" />
              </motion.div>
              <div>
                <p className="text-[10px] text-kimaya-cream/30 tracking-widest uppercase">Kimaya Experience</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <motion.div whileHover={{ rotate: 10 }} className="w-9 h-9 rounded-full bg-kimaya-olive/30 flex items-center justify-center">
              <Droplets size={18} className="text-kimaya-gold" />
            </motion.div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-kimaya-cream/40 hover:text-kimaya-cream transition-colors">
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }}><ChevronLeft size={14} /></motion.div>
          </button>
          <button onClick={onClose} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-kimaya-cream/40">
            <X size={14} />
          </button>
        </div>

        {/* Role Badge */}
        {!collapsed && user && (
          <div className="px-4 pt-3 pb-1">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider", roleBadgeColors[userRole])}>
              <Shield size={10} />
              {roleLabels[userRole]}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-kimaya-cream/20 uppercase tracking-[0.15em]">Menu Utama</p>
          )}
          {mainNav.map((item) => <NavItem key={item.href} item={item} />)}

          {adminNav.length > 0 && (
            <>
              <div className="my-4 border-t border-white/5" />
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold text-kimaya-cream/20 uppercase tracking-[0.15em]">Administrasi</p>
              )}
              {adminNav.map((item) => <NavItem key={item.href} item={item} />)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 flex-shrink-0">
          <div className={cn("flex items-center gap-3 p-2 rounded-xl", collapsed ? "justify-center" : "")}>
            <div className="w-9 h-9 rounded-full bg-kimaya-olive flex items-center justify-center text-kimaya-cream text-xs font-semibold flex-shrink-0">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-kimaya-cream truncate">{user?.fullName || "Loading..."}</p>
                <p className="text-[10px] text-kimaya-cream/30 truncate">{user?.email || ""}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={logout}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-kimaya-cream/30 hover:text-kimaya-cream transition-colors"
                title="Keluar">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
