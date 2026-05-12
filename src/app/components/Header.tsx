"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, Calendar, ChevronDown, User, Settings, LogOut, Menu, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

const notifications: { id: number; text: string; time: string; type: "warning" | "info" | "success" }[] = [];

const dotColors = {
  warning: "bg-kimaya-gold",
  info: "bg-blue-400",
  success: "bg-kimaya-olive",
};

const roleLabels: Record<string, string> = {
  DEVELOPER: "Developer",
  MANAGER: "Manager",
  CS: "Customer Service",
  THERAPIST: "Therapist",
};

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, logout, isAdmin } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dropdownVariants = {
    hidden: { opacity: 0, y: -8, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: "easeOut" as const } },
    exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } },
  };

  const userInitials = user?.fullName
    ?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-kimaya-cream-dark/40 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-kimaya-cream transition-colors text-kimaya-brown-light">
          <Menu size={20} strokeWidth={1.5} />
        </motion.button>

        <div className="hidden sm:flex items-center gap-2.5 bg-kimaya-cream/50 rounded-xl px-4 py-2.5 w-80 border border-transparent focus-within:border-kimaya-olive/20 focus-within:bg-white focus-within:shadow-sm transition-all duration-200">
          <Search size={16} className="text-kimaya-brown-light/40 flex-shrink-0" />
          <input type="text" placeholder="Cari karyawan, laporan..."
            className="bg-transparent text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 outline-none w-full" />
          <kbd className="hidden md:inline-block text-[10px] text-kimaya-brown-light/30 bg-kimaya-cream-dark/30 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 text-sm text-kimaya-brown-light/60 mr-2">
          <Calendar size={14} />
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-kimaya-cream transition-colors text-kimaya-brown-light">
            <Bell size={19} strokeWidth={1.5} />
            {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-kimaya-gold rounded-full ring-2 ring-white" />}
          </motion.button>

          <AnimatePresence>
            {showNotif && (
              <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit"
                className="absolute right-0 top-13 w-80 sm:w-96 bg-white rounded-2xl shadow-xl shadow-black/8 border border-kimaya-cream-dark/30 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-kimaya-cream-dark/20 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-kimaya-brown">Notifikasi</h3>
                  <span className="text-xs bg-kimaya-olive/10 text-kimaya-olive px-2 py-0.5 rounded-full font-medium">{notifications.length} baru</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-kimaya-brown-light/40">Belum ada notifikasi</p>
                    </div>
                  ) : notifications.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="px-4 py-3 hover:bg-kimaya-cream/30 transition-colors border-b border-kimaya-cream-dark/10 last:border-0 cursor-pointer">
                      <div className="flex gap-3">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", dotColors[n.type])} />
                        <div>
                          <p className="text-sm text-kimaya-brown leading-snug">{n.text}</p>
                          <p className="text-xs text-kimaya-brown-light/40 mt-1">{n.time}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-kimaya-cream-dark/20 text-center">
                  <button className="text-xs text-kimaya-olive font-medium hover:text-kimaya-olive-dark transition-colors">Lihat semua notifikasi →</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-kimaya-cream transition-colors">
            <div className="w-8 h-8 rounded-full bg-kimaya-olive flex items-center justify-center text-kimaya-cream text-xs font-semibold overflow-hidden relative">
              {user?.avatarUrl || user?.facePhotoUrl ? (
                <Image
                  src={(user.avatarUrl || user.facePhotoUrl) as string}
                  alt={user?.fullName || "Profil"}
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                userInitials
              )}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-kimaya-brown">{user?.fullName?.split(" ")[0] || "User"}</span>
            <motion.div animate={{ rotate: showProfile ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} className="text-kimaya-brown-light/40" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {showProfile && (
              <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit"
                className="absolute right-0 top-13 w-64 bg-white rounded-2xl shadow-xl shadow-black/8 border border-kimaya-cream-dark/30 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-kimaya-cream-dark/20">
                  <p className="font-semibold text-sm text-kimaya-brown">{user?.fullName || "User"}</p>
                  <p className="text-xs text-kimaya-brown-light/50">{user?.email || ""}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Shield size={10} className="text-kimaya-olive" />
                    <span className="text-[10px] font-semibold text-kimaya-olive uppercase tracking-wider">
                      {roleLabels[user?.role || "THERAPIST"]}
                    </span>
                  </div>
                </div>
                <div className="py-1">
                  <Link href="/dashboard/settings/profile" onClick={() => setShowProfile(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-kimaya-brown hover:bg-kimaya-cream/50 transition-colors">
                    <User size={16} strokeWidth={1.5} /> Profil Saya
                  </Link>
                  {isAdmin && (
                    <Link href="/dashboard/settings" onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-kimaya-brown hover:bg-kimaya-cream/50 transition-colors">
                      <Settings size={16} strokeWidth={1.5} /> Pengaturan Sistem
                    </Link>
                  )}
                </div>
                <div className="border-t border-kimaya-cream-dark/20 py-1">
                  <button onClick={logout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={16} strokeWidth={1.5} /> Keluar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
