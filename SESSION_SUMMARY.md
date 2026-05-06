# 📋 Kimaya Management System — Session Summary
**Tanggal:** 6 Mei 2026  
**Scope:** Therapist Onboarding, CRUD Karyawan, Face Verification

---

## ✅ Masalah yang Diselesaikan

### 1. CRUD Karyawan Tidak Berfungsi

| Masalah | Root Cause | Solusi |
|---------|-----------|-------|
| Karyawan baru tidak muncul di list setelah ditambah | `handleSubmit` tidak mengecek response API — toast selalu "berhasil" walau error | Cek `res.ok`, tampilkan error asli dari API, clear search filter setelah sukses |
| Semua karyawan status TERMINATED | Bug di DELETE endpoint — set status `TERMINATED`, lalu seed/migrasi tidak reset | Reset manual via SQL + perbaikan flow |
| Delete tidak ada konfirmasi nama | `handleDelete` hanya tampilkan "Yakin ingin menonaktifkan?" generik | Pass nama karyawan ke `handleDelete`, konfirmasi spesifik |
| Error handling lemah di semua CRUD | `fetch()` tanpa `.then(res => ...)` — fire-and-forget | Semua operasi (POST/PUT/DELETE) sekarang cek response status |

**File yang dimodifikasi:**
- `src/app/dashboard/employees/page.tsx` — handleSubmit, handleDelete
- `src/app/api/employees/route.ts` — POST handler
- `src/app/api/employees/[id]/route.ts` — PUT/DELETE handler

---

### 2. Face Matching Tidak Akurat (Siapapun Bisa Lolos)

| Masalah | Root Cause | Solusi |
|---------|-----------|-------|
| Wajah orang lain tetap cocok saat verifikasi | `faceMatch.ts` hanya membandingkan **histogram warna grayscale** — bukan fitur wajah | Rewrite total menggunakan **MediaPipe Face Landmarker** |
| Threshold terlalu rendah (55%) | Histogram similarity tidak discriminative | Naikkan ke **70%** dengan cosine similarity |
| Fallback auto-accept saat error | `catch` block set `faceVerified = true` | Sekarang **reject** jika error |
| Tanpa face foto → tetap diterima | Tidak ada pengecekan `facePhotoUrl` | Sekarang **tolak** jika belum onboarding |

**Cara kerja baru (Landmark-based):**
```
1. MediaPipe Face Landmarker → ekstrak 478 titik 3D wajah
2. Normalisasi → scale/posisi independen (berdasar jarak mata & hidung)
3. 68 titik kunci dipilih (rahang, mata, hidung, pipi)
4. Cosine similarity antara 2 vektor fitur
5. Match hanya jika skor ≥ 70%
```

**File yang dimodifikasi:**
- `src/lib/faceMatch.ts` — Rewrite total

---

### 3. Face Detector Gagal Load (Camera & WASM Issues)

| Masalah | Root Cause | Solusi |
|---------|-----------|-------|
| "Gagal memuat face detector" | GPU delegate gagal tanpa fallback | Tambah **CPU fallback** otomatis |
| "Timeout starting video source" | Kamera dipakai app lain | Tambah timeout handling + pesan error spesifik |
| WASM 404 Not Found | Versi `@latest` tidak stabil, lalu `0.10.22` tidak ada | Pin ke versi terinstall: **`0.10.35`** |
| Stream kamera bocor | Tidak stop stream sebelum request baru | Stop existing stream sebelum `getUserMedia()` |

**File yang dimodifikasi:**
- `src/app/components/FaceDetector.tsx` — initialize function

---

### 4. Alur Verifikasi Wajah Manual → Otomatis

| Sebelum | Sesudah |
|---------|---------|
| Buka kamera → tunggu → capture → klik "Gunakan Foto" → bandingkan → klik Check-in | Buka kamera → auto-detect → auto-capture → **auto-compare** → **auto-check-in** |
| 4 klik manual | **0 klik** — fully automatic |

**Alur baru:**
```
Klik "Verifikasi Wajah"
    ↓
Kamera terbuka, deteksi otomatis (1.5s stabil)
    ↓
Auto-capture → Status "🔍 Membandingkan wajah..."
    ↓
├─ ✅ Cocok (≥70%) → "Wajah cocok!" → Auto-close → Auto GPS Check-in
└─ ❌ Tidak cocok → "Wajah tidak cocok" → Auto-retry setelah 2 detik
```

**File yang dimodifikasi:**
- `src/app/components/FaceDetector.tsx` — Props baru `registeredFaceUrl`, auto-compare di `capturePhoto`
- `src/app/dashboard/attendance/page.tsx` — Simplified `handleFaceVerified`, auto `handleCheckIn`

---

## ⚠️ Masalah yang Belum Terselesaikan

### 1. WASM CDN Dependency
> **Status:** Partially Fixed (versi di-pin ke 0.10.35)

**Masalah:** Aplikasi bergantung pada CDN `jsdelivr.net` untuk WASM runtime MediaPipe. Jika CDN down atau versi dihapus, face detection gagal total.

**Dampak:** Face verification tidak bisa berfungsi tanpa internet / CDN.

### 2. Face Landmarker CDN untuk Matching
> **Status:** Belum ditest sepenuhnya

**Masalah:** `faceMatch.ts` juga load model Face Landmarker dari CDN Google Storage. Ini memerlukan:
- Koneksi internet stabil
- CDN Google Storage accessible
- Browser mendukung WebAssembly

**Dampak:** Matching bisa gagal di jaringan lambat atau restricted.

### 3. Docker Rebuild Diperlukan Setiap Perubahan
> **Status:** By Design, tapi perlu improvement

**Masalah:** Setiap perubahan kode memerlukan `docker compose up --build` yang memakan waktu ~60-90 detik.

### 4. Database Status Masih Bisa TERMINATED
> **Status:** Belum ada guard

**Masalah:** Admin bisa hapus karyawan (set TERMINATED), tapi tidak ada cara untuk **mengaktifkan kembali** dari UI.

### 5. Password Default Tidak Dipaksa Ganti
> **Status:** Belum diimplementasi

**Masalah:** Karyawan baru mendapat password default `kimaya2026` tapi tidak ada mekanisme paksa ganti password saat login pertama.

---

## 💡 Rekomendasi

### Prioritas Tinggi

1. **Self-host WASM Files**
   - Copy WASM files MediaPipe ke `/public/wasm/` di project
   - Tidak bergantung pada CDN eksternal
   - Implementasi: Copy dari `node_modules/@mediapipe/tasks-vision/wasm/` ke `public/`

2. **Server-Side Face Embedding**
   - Pindahkan face matching ke backend (Python FastAPI + `face_recognition` library)
   - Simpan face embedding vector di database, bukan foto base64
   - Akurasi jauh lebih tinggi dengan dlib/InsightFace
   - Client hanya kirim foto, server yang bandingkan

3. **Tombol Reaktivasi Karyawan**
   - Tambah tombol "Aktifkan Kembali" di UI admin untuk karyawan TERMINATED
   - API: `PUT /api/employees/:id` dengan `{ status: "ACTIVE" }`

### Prioritas Sedang

4. **Force Password Change**
   - Tambah field `mustChangePassword: boolean` di User model
   - Setelah login pertama, redirect ke halaman ganti password
   - Set `false` setelah password diganti

5. **Audit Log**
   - Log setiap aktivitas: onboarding selesai, check-in, perubahan data
   - Tabel `AuditLog` dengan `userId, action, timestamp, details`

6. **Dev Mode (Hot Reload)**
   - Tambah `docker-compose.dev.yml` dengan volume mount untuk development
   - Tidak perlu rebuild setiap perubahan

### Prioritas Rendah

7. **Offline Support**
   - Service Worker untuk cache WASM files
   - Queue check-in data offline, sync saat online

8. **Face Anti-Spoofing**
   - Deteksi apakah wajah di kamera adalah foto/video (spoofing)
   - Bisa menggunakan liveness detection (blink/head movement)

9. **Multi-foto Registrasi**
   - Ambil 3-5 foto dari sudut berbeda saat onboarding
   - Meningkatkan akurasi matching

---

## 📁 File yang Dimodifikasi (Ringkasan)

| File | Perubahan |
|------|-----------|
| `src/lib/faceMatch.ts` | **Rewrite total** — histogram → landmark-based matching |
| `src/app/components/FaceDetector.tsx` | GPU fallback, camera timeout, auto-compare, auto-submit |
| `src/app/dashboard/attendance/page.tsx` | Simplified handler, auto check-in, pass registeredFaceUrl |
| `src/app/dashboard/employees/page.tsx` | Response checking, error display, clear search, delete with name |
| `src/app/api/employees/route.ts` | Bcrypt password, duplicate check |
| `src/app/api/employees/[id]/route.ts` | Error responses (sudah benar, tidak diubah) |

---

## 🔧 Perintah Penting

```bash
# Reset semua karyawan ke ACTIVE
docker exec siyap-postgres psql -U management_admin -d management_db \
  -c "UPDATE users SET status = 'ACTIVE' WHERE status = 'TERMINATED';"

# Cek status karyawan
docker exec siyap-postgres psql -U management_admin -d management_db \
  -c "SELECT email, full_name, role, status FROM users;"

# Rebuild & deploy
docker compose up -d --build siyap-app

# Cek logs
docker logs --tail 20 siyap-app
```
