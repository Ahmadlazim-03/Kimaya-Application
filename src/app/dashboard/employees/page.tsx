"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Filter, ChevronDown, X as XIcon, UserPlus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";


interface Employee {
  id: string; name: string; email: string; phone: string; role: string;
  location: string; status: string; joinDate: string; avatar: string;
}

const roles = [
  { value: "THERAPIST", label: "Therapist" },
  { value: "CS", label: "Customer Service" },
  { value: "DEVELOPER", label: "IT / Developer" },
];
const roleFilters = ["Semua Role", "THERAPIST", "CS", "DEVELOPER"];
const locations = ["Semua Lokasi", "Kimaya Spa Banda Aceh", "Kimaya Spa Surabaya", "Kimaya Spa Gading Serpong", "Kimaya Spa Bintaro"];

const roleBadges: Record<string, { label: string; cls: string }> = {
  THERAPIST: { label: "Therapist", cls: "bg-kimaya-olive/10 text-kimaya-olive" },
  CS: { label: "Customer Service", cls: "bg-blue-50 text-blue-600" },
  DEVELOPER: { label: "IT / Developer", cls: "bg-purple-50 text-purple-600" },
  MANAGER: { label: "Manager", cls: "bg-amber-50 text-amber-700" },
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
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  const [formRole, setFormRole] = useState("THERAPIST");
  const [formLoc, setFormLoc] = useState("Kimaya Spa Gading Serpong");

  const fetchEmployees = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter !== "Semua Role") params.set("role", roleFilter);
    fetch(`/api/employees?${params}`).then(r => r.json()).then(d => { setEmployees(d); setLoading(false); }).catch(() => setLoading(false));
  }, [search, roleFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const openCreate = () => {
    setEditingEmployee(null);
    setFormName(""); setFormEmail(""); setFormRole("THERAPIST"); setFormLoc("Kimaya Spa Gading Serpong");
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name); setFormEmail(emp.email);
    setFormRole(emp.role); setFormLoc(emp.location);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const body = { name: formName, email: formEmail, role: formRole, locationName: formLoc };
    if (editingEmployee) {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { showToast(`❌ ${data.error || "Gagal mengupdate"}`); setSaving(false); return; }
      showToast("✅ Karyawan berhasil diupdate");
    } else {
      const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { showToast(`❌ ${data.error || "Gagal menambahkan"}`); setSaving(false); return; }
      showToast(`✅ ${data.message || "Karyawan berhasil ditambahkan"}`);
      setSearch(""); // Clear search so new employee is visible
    }
    setSaving(false); setShowModal(false); fetchEmployees();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus "${name}"? Data karyawan akan dihapus permanen.`)) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showToast(`❌ ${data.error || "Gagal menghapus"}`); return; }
      showToast("✅ Karyawan berhasil dihapus");
      fetchEmployees();
    } catch {
      showToast("❌ Tidak dapat terhubung ke server");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  const filtered = employees.filter(e => e.status !== "terminated");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px] mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-kimaya-brown">Data Karyawan</h1>
          <p className="text-sm text-kimaya-brown-light/60 mt-1">{filtered.length} karyawan terdaftar</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="px-5 py-2.5 rounded-xl bg-kimaya-olive text-white text-sm font-medium hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 flex items-center gap-2 w-fit">
          <UserPlus size={16} /> Tambah Karyawan
        </motion.button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-kimaya-cream-dark/30 focus-within:border-kimaya-olive/30 transition-all">
          <Search size={16} className="text-kimaya-brown-light/40" />
          <input type="text" placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 outline-none w-full" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-2.5 rounded-xl border border-kimaya-cream-dark/30 bg-white text-sm text-kimaya-brown focus:outline-none cursor-pointer">
            {roleFilters.map(d => <option key={d} value={d}>{d === "Semua Role" ? d : roleBadges[d]?.label || d}</option>)}
          </select>
          <Filter size={14} className="absolute left-3.5 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-3 top-3.5 text-kimaya-brown-light/40 pointer-events-none" />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-kimaya-cream-dark/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-kimaya-cream-dark/30 bg-kimaya-cream/20">
                {["Karyawan", "Role", "Lokasi", "Status", "Aksi"].map(h => (
                  <th key={h} className={cn("px-5 py-3.5 text-xs font-semibold text-kimaya-brown-light/50 uppercase tracking-wider", h === "Aksi" ? "text-center" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const badge = statusBadges[emp.status] || statusBadges.active;
                const roleBadge = roleBadges[emp.role] || roleBadges.THERAPIST;
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
                    <td className="px-5 py-4"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", roleBadge.cls)}>{roleBadge.label}</span></td>
                    <td className="px-5 py-4 text-sm text-kimaya-brown-light/60">{emp.location}</td>
                    <td className="px-5 py-4"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span></td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(emp)}
                          className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                          <Pencil size={14} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(emp.id, emp.name)}
                          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-kimaya-brown-light/40 hover:text-red-500 transition-colors">
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
                <h2 className="text-xl font-serif text-kimaya-brown">{editingEmployee ? "Edit Karyawan" : "Tambah Karyawan Baru"}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Nama Lengkap</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Email</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="nama@kimayaexperience.com"
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown placeholder-kimaya-brown-light/40 focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Role</label>
                    <select value={formRole} onChange={e => setFormRole(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                      {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Lokasi</label>
                    <select value={formLoc} onChange={e => setFormLoc(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30">
                      {locations.filter(l => l !== "Semua Lokasi").map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Info: password & onboarding */}
                <div className="bg-kimaya-olive/5 border border-kimaya-olive/20 rounded-xl p-4 text-xs text-kimaya-brown-light/70 space-y-1.5">
                  <p>💡 Password default: <span className="font-semibold text-kimaya-brown">kimaya2026</span></p>
                  <p>📸 Foto wajah & nomor telepon akan dilengkapi oleh karyawan saat onboarding pertama kali.</p>
                  {formRole !== "THERAPIST" && <p>🔓 Role <strong>{roles.find(r => r.value === formRole)?.label}</strong> tidak memerlukan verifikasi wajah.</p>}
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
