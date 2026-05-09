"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, MapPin, Pencil, X as XIcon, Save, Loader2, Check } from "lucide-react";

const MapPicker = dynamic(() => import("@/app/components/MapPicker"), { 
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-kimaya-cream-light rounded-xl animate-pulse flex items-center justify-center text-xs text-kimaya-brown-light/30">Loading map...</div>
});

interface LocationData { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; geofenceRadiusM: number; _count: { users: number }; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [editLoc, setEditLoc] = useState<LocationData | null>(null);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => { if (Array.isArray(d)) setLocations(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSaveLocation = async () => {
    if (!editLoc) return;
    setSaving(true);
    const res = await fetch("/api/locations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editLoc) });
    if (res.ok) {
      setLocations(prev => prev.map(l => l.id === editLoc.id ? { ...editLoc, _count: l._count } : l));
      showToast("✅ Lokasi berhasil diperbarui");
      setEditLoc(null);
    } else { showToast("❌ Gagal menyimpan lokasi"); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-kimaya-olive" /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-[1400px]">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[60] bg-kimaya-olive text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
            <Check size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item}>
        <h1 className="text-2xl font-serif text-kimaya-brown">Lokasi & Geofence</h1>
        <p className="text-sm text-kimaya-brown-light/60 mt-1">Konfigurasi titik koordinat dan radius check-in per cabang</p>
      </motion.div>

      <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-kimaya-cream-dark/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Globe size={18} className="text-blue-600" /></div>
          <div><h3 className="text-sm font-medium text-kimaya-brown">Daftar Lokasi Cabang</h3><p className="text-xs text-kimaya-brown-light/50">{locations.length} lokasi terdaftar</p></div>
        </div>
        <div className="space-y-3">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between p-4 rounded-xl border border-kimaya-cream-dark/20 hover:border-kimaya-olive/30 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-medium text-kimaya-brown">{loc.name}</p>
                <p className="text-xs text-kimaya-brown-light/50 mt-0.5">{loc.address || "Alamat belum diisi"}</p>
                <div className="flex gap-4 mt-2 text-xs text-kimaya-brown-light/40">
                  <span>📍 {loc.latitude && loc.longitude ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}` : "Belum diset"}</span>
                  <span>📏 Radius: <span className="font-semibold text-kimaya-brown">{loc.geofenceRadiusM}m</span></span>
                  <span>👤 {loc._count.users} karyawan</span>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditLoc({ ...loc })}
                className="w-9 h-9 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 hover:text-kimaya-olive transition-colors">
                <Pencil size={14} />
              </motion.button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Edit Location Modal */}
      <AnimatePresence>
        {editLoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditLoc(null)}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-serif text-kimaya-brown">Edit Lokasi</h2>
                <button onClick={() => setEditLoc(null)} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40"><XIcon size={18} /></button>
                </div>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Map Section */}
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Pilih Lokasi di Peta</label>
                  <MapPicker 
                    lat={editLoc.latitude} 
                    lng={editLoc.longitude} 
                    radius={editLoc.geofenceRadiusM}
                    onChange={(lat, lng) => setEditLoc({ ...editLoc, latitude: lat, longitude: lng })} 
                  />
                  <p className="text-[10px] text-kimaya-brown-light/40 mt-1.5 flex items-center gap-1">
                    <MapPin size={10} /> Klik pada peta atau geser marker untuk menentukan koordinat
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Nama Lokasi</label>

                  <input type="text" value={editLoc.name} onChange={e => setEditLoc({ ...editLoc, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Alamat</label>
                  <input type="text" value={editLoc.address || ""} onChange={e => setEditLoc({ ...editLoc, address: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Latitude</label>
                    <input type="number" step="0.0001" value={editLoc.latitude ?? ""} onChange={e => setEditLoc({ ...editLoc, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Longitude</label>
                    <input type="number" step="0.0001" value={editLoc.longitude ?? ""} onChange={e => setEditLoc({ ...editLoc, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-kimaya-brown-light mb-2">Radius Geofence (meter)</label>
                  <input type="number" value={editLoc.geofenceRadiusM} onChange={e => setEditLoc({ ...editLoc, geofenceRadiusM: parseInt(e.target.value) || 100 })}
                    className="w-full px-4 py-3 rounded-xl border border-kimaya-cream-dark bg-kimaya-cream-light text-sm text-kimaya-brown focus:outline-none focus:ring-2 focus:ring-kimaya-olive/30" />
                  <p className="text-xs text-kimaya-brown-light/40 mt-1">Karyawan hanya bisa check-in dalam radius ini dari titik koordinat</p>
                </div>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveLocation} disabled={saving}
                  className="w-full py-3.5 rounded-xl bg-kimaya-olive text-white font-medium text-sm hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Lokasi
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
