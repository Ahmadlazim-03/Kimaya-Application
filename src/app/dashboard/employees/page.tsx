"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Pencil, Trash2, Filter, ChevronDown, X as XIcon, UserPlus, Loader2, Check, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { rolesActorCanCreate, actorIsLocationLocked } from "@/lib/employeeAuth";
import type { UserRole } from "@/lib/auth";

interface Employee {
  id: string; name: string; email: string; phone: string; role: UserRole;
  location: string; locationId: string | null; status: string; joinDate: string; avatar: string;
}
interface Location { id: string; name: string; }

const ALL_ROLE_LABELS: Record<UserRole, string> = {
  DEVELOPER: "Developer",
  MANAGER: "Manager",
  CS: "Customer Service",
  THERAPIST: "Therapist",
};
const ROLE_BADGES: Record<UserRole, string> = {
  DEVELOPER: "bg-purple-50 text-purple-600",
  MANAGER: "bg-amber-50 text-amber-700",
  CS: "bg-blue-50 text-blue-600",
  THERAPIST: "bg-kimaya-olive/10 text-kimaya-olive",
};

const statusBadges: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  probation: { label: "Probasi", cls: "bg-amber-100 text-amber-700" },
  inactive: { label: "Nonaktif", cls: "bg-gray-100 text-gray-500" },
  terminated: { label: "Dihapus", cls: "bg-red-100 text-red-500" },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function EmployeesPage() {
  const { user: me } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua Role");
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("THERAPIST");
  const [formLocId, setFormLocId] = useState<string>("");

  // ── Derived: role-based UI flags ─────────────────────────────────────
  const myRole = me?.role as UserRole | undefined;
  const myLocationId = me?.locationId || null;
  const allowedRoles = myRole ? rolesActorCanCreate(myRole) : [];
  const isLocationLocked = myRole ? actorIsLocationLocked(myRole) : false;
  const canCreate = allowedRoles.length > 0;

  // Locations available in the form: CS sees only their own; admins see all.
  const formLocations = isLocationLocked && myLocationId
    ? locations.filter((l) => l.id === myLocationId)
    : locations;

  // Role filter dropdown: CS sees only THERAPIST (server enforces too)
  const filterRoleOptions = myRole === "CS"
    ? ["THERAPIST"]
    : ["DEVELOPER", "MANAGER", "CS", "THERAPIST"];

  // ── Data ─────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter !== "Semua Role") params.set("role", roleFilter);
    fetch(`/api/employees?${params}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setEmployees(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [search, roleFilter]);

  const fetchLocations = useCallback(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLocations(d.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const openCreate = () => {
    if (!canCreate || !myRole) return;
    setEditingEmployee(null);
    setFormName(""); setFormEmail("");
    // Default role = first allowed (CS→THERAPIST, admins→DEVELOPER etc)
    setFormRole(allowedRoles[0] || "THERAPIST");
    // Default location: locked-to-self for CS, else empty for explicit pick
    setFormLocId(isLocationLocked && myLocationId ? myLocationId : "");
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name); setFormEmail(emp.email);
    setFormRole(emp.role);
    setFormLocId(emp.locationId || "");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      showToast("Nama dan email wajib diisi");
      return;
    }
    setSaving(true);
    const locName = formLocations.find((l) => l.id === formLocId)?.name || null;
    const body = { name: formName.trim(), email: formEmail.trim(), role: formRole, locationName: locName };
    try {
      if (editingEmployee) {
        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Gagal mengubah data"); setSaving(false); return; }
        showToast("Karyawan berhasil diperbarui");
      } else {
        const res = await fetch("/api/employees", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Gagal menambahkan"); setSaving(false); return; }
        showToast(data.message || "Karyawan berhasil ditambahkan");
        setSearch("");
      }
    } catch {
      showToast("Tidak dapat terhubung ke server");
    }
    setSaving(false); setShowModal(false); fetchEmployees();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus "${name}"? Data karyawan akan hilang permanen.`)) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Gagal menghapus"); return; }
      showToast("Karyawan berhasil dihapus");
      fetchEmployees();
    } catch {
      showToast("Tidak dapat terhubung ke server");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  const filtered = employees.filter(e => e.status !== "terminated");
  const myLocationName = myLocationId ? locations.find((l) => l.id === myLocationId)?.name : null;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm max-w-md">
            <Check size={16} className="flex-shrink-0" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Data Karyawan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">
            {filtered.length} karyawan terdaftar
            {myRole === "CS" && myLocationName && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                <MapPin size={10} /> {myLocationName}
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
            className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit">
            <UserPlus size={16} /> Tambah Karyawan
          </motion.button>
        )}
      </motion.div>

      {/* CS info banner */}
      {myRole === "CS" && (
        <motion.div variants={item}
          className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-[12px] text-blue-700">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            Sebagai Customer Service, Anda hanya bisa menambah <strong>Therapist</strong> di cabang{" "}
            <strong>{myLocationName || "Anda"}</strong>. Untuk role lain, hubungi Manager.
          </p>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-kimaya-cream-dark/30 focus-within:border-kimaya-olive/30 transition-all">
          <Search size={16} className="text-kimaya-brown-light/40" />
          <input type="text" placeholder="Cari nama atau email…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 outline-none w-full" />
        </div>
        {myRole !== "CS" && (
          <div className="relative">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none cursor-pointer">
              <option value="Semua Role">Semua Role</option>
              {filterRoleOptions.map(r => <option key={r} value={r}>{ALL_ROLE_LABELS[r as UserRole]}</option>)}
            </select>
            <Filter size={14} className="absolute left-3.5 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-kimaya-cream-dark/30 bg-kimaya-cream/20">
                {["Karyawan", "Role", "Cabang", "Status", "Aksi"].map(h => (
                  <th key={h} className={cn("px-5 py-3.5 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Aksi" ? "text-center" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const badge = statusBadges[emp.status] || statusBadges.active;
                return (
                  <tr key={emp.id} className="border-b border-kimaya-cream-dark/10 last:border-0 hover:bg-kimaya-cream/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-kimaya-olive/10 flex items-center justify-center text-xs font-semibold text-kimaya-olive">{emp.avatar}</div>
                        <div>
                          <p className="text-sm font-medium text-kimaya-brown">{emp.name}</p>
                          <p className="text-xs text-kimaya-brown-light/40">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", ROLE_BADGES[emp.role] || "bg-gray-50 text-gray-500")}>
                        {ALL_ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-kimaya-brown-light/60">{emp.location}</td>
                    <td className="px-5 py-4"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span></td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(emp)}
                          title="Ubah"
                          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                          <Pencil size={14} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(emp.id, emp.name)}
                          title="Hapus"
                          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-sm text-kimaya-brown-light/40">Belum ada karyawan</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-kimaya-cream-dark/20 text-xs text-kimaya-brown-light/40">
          Menampilkan {filtered.length} karyawan
        </div>
      </motion.div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif text-kimaya-brown">{editingEmployee ? "Ubah Karyawan" : "Tambah Karyawan Baru"}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Nama Lengkap <span className="text-red-400">*</span></label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Email <span className="text-red-400">*</span></label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="nama@kimayaexperience.com"
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Role</label>
                    {allowedRoles.length === 1 ? (
                      <div className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream/30 text-sm text-kimaya-brown flex items-center justify-between">
                        <span>{ALL_ROLE_LABELS[allowedRoles[0]]}</span>
                        <span className="text-[10px] text-kimaya-brown-light/50">Terkunci</span>
                      </div>
                    ) : (
                      <select value={formRole} onChange={e => setFormRole(e.target.value as UserRole)}
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                        {allowedRoles.map(r => <option key={r} value={r}>{ALL_ROLE_LABELS[r]}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Cabang</label>
                    {isLocationLocked ? (
                      <div className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream/30 text-sm text-kimaya-brown flex items-center justify-between">
                        <span>{myLocationName || "(belum di-set)"}</span>
                        <span className="text-[10px] text-kimaya-brown-light/50">Terkunci</span>
                      </div>
                    ) : (
                      <select value={formLocId} onChange={e => setFormLocId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                        <option value="">— Pilih cabang —</option>
                        {formLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div className="bg-kimaya-olive/5 border border-kimaya-olive/20 rounded-xl p-4 text-xs text-kimaya-brown-light/70 space-y-1.5">
                  <p>🔑 Kata sandi awal: <span className="font-semibold text-kimaya-brown">kimaya2026</span></p>
                  {formRole === "THERAPIST" && (
                    <p>📸 Foto wajah & nomor HP dilengkapi oleh karyawan saat masuk pertama kali.</p>
                  )}
                  {formRole !== "THERAPIST" && (
                    <p>🔓 Role <strong>{ALL_ROLE_LABELS[formRole]}</strong> tidak memerlukan verifikasi wajah.</p>
                  )}
                </div>

                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={saving || !formName || !formEmail}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingEmployee ? "Simpan Perubahan" : "Tambah Karyawan"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
