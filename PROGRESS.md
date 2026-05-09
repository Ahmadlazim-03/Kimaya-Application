# 🚀 Project Handover: Kimaya Management System

Dokumen ini dibuat agar AI Agent selanjutnya dapat memahami arsitektur, progres, dan status terkini dari project **Kimaya Management System** untuk melanjutkan pengembangan tanpa kehilangan konteks.

---

## 1. Ikhtisar Proyek (Project Overview)
Aplikasi web internal untuk manajemen operasional, kehadiran, dan pelaporan karyawan **Kimaya Spa**. Sistem ini berfokus pada otomatisasi penilaian performa (skoring), pelacakan kehadiran berbasis geofencing & pengenalan wajah (face recognition), serta pengingat operasional via WhatsApp.

---

## 2. Tech Stack & Infrastruktur
- **Frontend/Backend:** Next.js 16 (App Router) + Turbopack, React, TypeScript
- **Styling & UI:** Tailwind CSS, Framer Motion (untuk animasi UI), Lucide React (icons)
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Cache/Session:** Redis
- **Integrasi Pihak Ketiga:**
  - **WhatsApp API:** WAHA (WhatsApp HTTP API)
  - **Face Detection:** MediaPipe & face-api.js
- **Deployment:** Docker & Docker Compose (`docker-compose.yml`), berjalan di Coolify.

---

## 3. Sistem RBAC (Role-Based Access Control)
Sistem menggunakan 4 tingkatan akses (Role). Baru-baru ini, konsep `Department` telah dihapus dan sepenuhnya digantikan oleh `Role`.

1. **DEVELOPER (IT)**: Fokus pada infrastruktur.
   - Hak Akses: Dashboard, Karyawan, Lokasi, Monitoring.
2. **MANAGER**: Pemilik bisnis / Supervisor tingkat atas.
   - Hak Akses: Semua fitur (Dashboard, Absensi, Laporan, Skoring, Reminder, Karyawan, Pengaturan, dll).
3. **CS (Customer Service)**: Supervisor lantai / admin operasional.
   - Hak Akses: Dashboard, Absensi, Laporan, Skoring, Reminder, Karyawan.
4. **THERAPIST**: Staf lini depan.
   - Hak Akses: Dashboard, Absensi (Check-in Face Scan + GPS), Laporan.

---

## 4. Progres Terkini (Recent Accomplishments)
- **Database Clean-up:** Menghapus seluruh data *dummy* dari `init.sql` dan `seed.js`. Database sekarang dalam status *production-ready* (hanya berisi data konfigurasi dasar dan 1 akun DEVELOPER utama: `developer@kimayaexperience.com` / `kimaya2026`).
- **Pembaruan Form Karyawan:** Menghapus input "Departemen" dan menggantinya dengan "Role". Input "Nomor Telepon" dihapus dari form pendaftaran karena karyawan akan mengisinya sendiri saat tahap *onboarding* (bersamaan dengan verifikasi wajah).
- **Pemisahan Pengaturan (Settings Refactor):**
  - Halaman `Pengaturan` sebelumnya terlalu penuh.
  - Konfigurasi **Lokasi & Geofence** telah diekstrak ke `/dashboard/locations`.
  - **Monitoring Server (PostgreSQL, Redis, WAHA)** telah diekstrak ke `/dashboard/monitoring`.

---

## 5. Tugas Tertunda (Pending Tasks for Next Agent)
User terakhir kali meminta instruksi berikut yang **BELUM SELESAI** secara penuh dan harus dilanjutkan oleh Agent berikutnya:
> *"pada role IT tolong hilangkan configurasi tab umum, kemudian pada ketiga tab lainnya jadikan menu di sidebar"*

### Langkah yang perlu dieksekusi:
1. **Update `src/app/dashboard/settings/page.tsx`**:
   - Hapus komponen "Tab Umum" (Waktu Kerja & Toleransi Keterlambatan). Jika konfigurasi ini masih dibutuhkan oleh sistem, pertimbangkan untuk menyembunyikannya dari UI atau memindahkannya ke tempat lain. (Atau hapus sepenuhnya sesuai instruksi user).
   - Karena Lokasi & Monitoring sudah dibuatkan halamannya sendiri (`/locations` dan `/monitoring`), halaman `/settings` ini sekarang sebaiknya **hanya berisi konfigurasi Skoring** tanpa menggunakan sistem *tabs* lagi.
2. **Update `src/app/components/Sidebar.tsx`**:
   - Tambahkan menu **Lokasi** dan **Monitoring** ke dalam `allNavItems` agar muncul di sidebar.
   - Atur `roles: ["DEVELOPER", "MANAGER"]` untuk kedua menu tersebut.
3. **Update `src/lib/AuthContext.tsx` (`ROLE_PAGES`)**:
   - Tambahkan *routing guards* untuk path yang baru dibuat:
     - `"/dashboard/locations": ["DEVELOPER", "MANAGER"]`
     - `"/dashboard/monitoring": ["DEVELOPER", "MANAGER"]`

---

## 6. Struktur Direktori Kunci
- `src/app/api/`: Semua endpoint API.
- `src/app/dashboard/`: Semua halaman dashboard.
- `src/app/components/`: Komponen UI (terutama `Sidebar.tsx` dan `Header.tsx`).
- `src/lib/AuthContext.tsx`: Jantung dari autentikasi dan otorisasi menu/halaman.
- `prisma/schema.prisma`: Skema database yang mendefinisikan tabel-tabel.
- `docker/postgres/init.sql`: Inisialisasi awal database (saat ini sudah bersih).

**Catatan untuk AI Agent:** Mulailah dengan mereview file `Sidebar.tsx` dan `AuthContext.tsx` untuk menyelesaikan *Pending Tasks* di atas. Semua dependensi dan *tools* sudah disiapkan dalam bentuk *Docker Compose*.
