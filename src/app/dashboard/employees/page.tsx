"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Pencil, Trash2, Filter, ChevronDown, X as XIcon, UserPlus, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  dept: string;
  location: string;
  status: string;
  joinDate: string;
  avatar: string;
}

const statusBadges: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  probation: { label: "Probasi", cls: "bg-amber-100 text-amber-700" },
  inactive: { label: "Nonaktif", cls: "bg-gray-100 text-gray-500" },
  terminated: { label: "Dihentikan", cls: "bg-red-100 text-red-600" },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("Semua Departemen");
  const [locFilter, setLocFilter] = useState("Semua Lokasi");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formLoc, setFormLoc] = useState("");

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/employees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [fetchEmployees]);

  // Get unique departments and locations from data
  const departments = ["Semua Departemen", ...Array.from(new Set(employees.map((e) => e.dept).filter((d) => d !== "-")))];
  const locations = ["Semua Lokasi", ...Array.from(new Set(employees.map((e) => e.location).filter((l) => l !== "-")))];

  const filtered = employees.filter((e) => {
    const matchDept = deptFilter === "Semua Departemen" || e.dept === deptFilter;
    const matchLoc = locFilter === "Semua Lokasi" || e.location === locFilter;
    return matchDept && matchLoc;
  });

  const handleSubmit = async () => {
    if (!formName || !formEmail) return;
    setSaving(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          phone: formPhone,
          departmentName: formDept || undefined,
          locationName: formLoc || undefined,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setFormName(""); setFormEmail(""); setFormPhone(""); setFormDept(""); setFormLoc("");
        fetchEmployees();
      }
    } catch (err) {
      console.error("Failed to add employee:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Data Karyawan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">Kelola seluruh karyawan Kimaya Experience</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={fetchEmployees} className="w-10 h-10 rounded-xl border border-kimaya-cream-dark/30 bg-white flex items-center justify-center text-kimaya-brown-light/50 hover:text-kimaya-olive hover:border-kimaya-olive/30 transition-all">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit">
            <UserPlus size={16} /> Tambah Karyawan
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-kimaya-cream-dark/30 focus-within:border-kimaya-olive/30 focus-within:shadow-sm transition-all">
          <Search size={16} className="text-kimaya-brown-light/40 flex-shrink-0" />
          <input type="text" placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 outline-none w-full" />
        </div>
        <div className="relative">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none focus:border-kimaya-olive/30 cursor-pointer">
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <Filter size={14} className="absolute left-3.5 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-3 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none focus:border-kimaya-olive/30 cursor-pointer">
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
          <Filter size={14} className="absolute left-3.5 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-3 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-kimaya-olive" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-kimaya-brown-light/40">
            <UserPlus size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Belum ada data karyawan</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-kimaya-cream-dark/30 bg-kimaya-cream/20">
                    {["Karyawan", "Departemen", "Lokasi", "Telepon", "Status", "Tgl Gabung", "Aksi"].map((h) => (
                      <th key={h} className={cn("px-5 py-3.5 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Aksi" ? "text-center" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const badge = statusBadges[emp.status] || statusBadges.active;
                    return (
                      <tr key={emp.id} className="border-b border-kimaya-cream-dark/10 last:border-0 hover:bg-kimaya-cream/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive flex-shrink-0">{emp.avatar}</div>
                            <div>
                              <p className="text-sm font-medium text-kimaya-brown">{emp.name}</p>
                              <p className="text-xs text-kimaya-brown-light/40">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-kimaya-brown-light/60">{emp.dept}</td>
                        <td className="px-5 py-4 text-sm text-kimaya-brown-light/60">{emp.location}</td>
                        <td className="px-5 py-4 text-sm text-kimaya-brown-light/60 font-mono text-xs">{emp.phone}</td>
                        <td className="px-5 py-4">
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-kimaya-brown-light/50">{emp.joinDate}</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                              <Pencil size={14} />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-kimaya-cream-dark/20 text-xs text-kimaya-brown-light/40">
              Menampilkan {filtered.length} dari {employees.length} karyawan
            </div>
          </>
        )}
      </motion.div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 25 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif text-kimaya-brown">Tambah Karyawan</h2>
                <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Nama Lengkap</label>
                  <input type="text" placeholder="Masukkan nama lengkap" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Email</label>
                  <input type="email" placeholder="nama@kimayaexperience.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Nomor Telepon</label>
                  <input type="tel" placeholder="+62 812-XXXX-XXXX" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Departemen</label>
                    <input type="text" placeholder="Contoh: Spa Therapist" value={formDept} onChange={(e) => setFormDept(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Lokasi</label>
                    <input type="text" placeholder="Contoh: Gading Serpong" value={formLoc} onChange={(e) => setFormLoc(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={saving || !formName || !formEmail}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : "Simpan Karyawan"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
