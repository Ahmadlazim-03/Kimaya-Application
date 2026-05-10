# AGENTS.md — Kimaya Application Agent Rules

## ⚠️ Next.js Version Notice
<!-- BEGIN:nextjs-agent-rules -->
This project uses **Next.js 15 with App Router**. APIs dan konvensi berbeda dari versi lama.
Gunakan `node_modules/next/dist/docs/` sebagai referensi jika ragu.
Perhatikan deprecation notice — Pages Router TIDAK digunakan di project ini.
<!-- END:nextjs-agent-rules -->

---

## 🤖 Aturan Wajib untuk Agent

### 1. Scope Baca File — KETAT
```
✅ BOLEH dibaca tanpa diminta:
  - File yang disebutkan eksplisit di prompt
  - prisma/schema.prisma (untuk context DB)
  - src/lib/prisma.ts (untuk Prisma client)
  - package.json (untuk cek dependencies)

❌ JANGAN dibaca kecuali diminta eksplisit:
  - node_modules/
  - .next/
  - prisma/migrations/     ← DILARANG, sangat banyak file
  - public/
  - docker/
  - *.lock files
  - .qodo/
  - tsconfig.tsbuildinfo
```

### 2. Sebelum Menulis Kode
- **JANGAN langsung tulis kode** untuk task kompleks
- Buat plan dulu: list file yang akan diubah
- Tunggu konfirmasi user sebelum eksekusi
- Untuk task sederhana (< 3 file), boleh langsung

### 3. Face Recognition — Protokol Khusus
Fitur ini **sedang dalam perbaikan aktif**. Saat menangani issue face recognition:
- Fokus ke threshold/confidence score komparasi wajah
- Cek apakah ada fallback yang terlalu permisif
- Cek validasi di endpoint sebelum menyimpan attendance
- **JANGAN** ubah struktur database Attendance tanpa diskusi dulu

### 4. Prisma — Aturan Penggunaan
```typescript
// ✅ BENAR — import dari lib yang sudah ada
import { prisma } from '@/lib/prisma'

// ❌ SALAH — jangan buat instance baru
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient() // JANGAN INI
```
- Selalu gunakan `prisma.$transaction()` untuk operasi multi-table
- Gunakan `select` atau `include` yang spesifik, hindari fetch semua field

### 5. API Routes — Format Response Konsisten
```typescript
// ✅ Success response
return NextResponse.json({ success: true, data: result }, { status: 200 })

// ✅ Error response  
return NextResponse.json({ success: false, error: 'Pesan error' }, { status: 400 })

// Selalu wrap dengan try/catch
try {
  // logika
} catch (error) {
  console.error('[ROUTE_NAME]', error)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}
```

### 6. TypeScript — Jangan Pakai `any`
```typescript
// ❌ SALAH
const data: any = await prisma.user.findMany()

// ✅ BENAR — gunakan tipe Prisma
import { User } from '@prisma/client'
const data: User[] = await prisma.user.findMany()
```

### 7. Attendance & Geolokasi
- Field koordinat menggunakan tipe `Decimal` di Prisma — convert ke `number` saat digunakan di JS
- `checkInMethod` default "WEB" — sebutkan jika ada method baru (MOBILE, FACE, dll)
- `@@unique([userId, date])` — satu user hanya bisa absen sekali per hari

### 8. Auth & Role
```
DEVELOPER  → akses penuh (admin)
MANAGER    → approve leave, lihat semua karyawan di departemennya
CS         → akses terbatas
THERAPIST  → hanya akses data sendiri
```
Selalu validasi role di API route sebelum melakukan operasi sensitif.

---

## 📝 Template Prompt Standar

### Fix Bug
```
Bug di: [path/file.ts] → [nama fungsi/komponen]
Gejala: [describe]
Expected: [describe]
Cek HANYA: [file1], [file2]
Model Prisma terkait: [ModelName]
```

### Tambah Fitur
```
Fitur: [nama fitur]
Lokasi: [src/app/... atau src/components/...]
Model Prisma: [model yang terlibat]
File yang boleh dibaca: [list]
Jangan explore di luar file yang disebutkan.
```

### Debug Face Recognition
```
Issue: [describe masalah spesifik]
File terkait: src/lib/face/[file], src/app/api/attendance/[file]
Jangan baca file lain.
```

---

## 🔄 Git Workflow
- Commit setelah setiap perubahan signifikan
- Pesan commit: `feat:`, `fix:`, `refactor:`, `chore:`
- Gunakan `/compact` di Claude Code setelah sesi panjang
- Mulai sesi baru untuk fitur/bug yang berbeda