const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "kimaya2026";

async function main() {
  // Check if already seeded
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("✅ Database already seeded, skipping...");
    return;
  }

  console.log("🌱 Seeding database...");

  // System Config
  const configs = [
    { key: "default_check_in_time", value: "08:00", description: "Jam masuk default" },
    { key: "default_check_out_time", value: "17:00", description: "Jam pulang default" },
    { key: "late_tolerance_minutes", value: "10", description: "Toleransi keterlambatan (menit)" },
    { key: "geofence_radius_meters", value: "100", description: "Radius geolokasi check-in (meter)" },
    { key: "max_upload_size_mb", value: "25", description: "Ukuran maksimal upload file (MB)" },
  ];
  for (const c of configs) {
    await prisma.systemConfig.upsert({ where: { key: c.key }, update: {}, create: c });
  }

  // Departments
  const deptNames = ["Spa Therapist", "Beauty Expert", "Front Desk", "Operations", "Marketing", "IT Support", "HR & Admin"];
  const depts = {};
  for (const name of deptNames) {
    depts[name] = await prisma.department.create({ data: { name, description: `Tim ${name}` } });
  }

  // Locations
  const locData = [
    { name: "Kimaya Spa Banda Aceh", address: "Kota Banda Aceh, Aceh 24415", latitude: 5.5483, longitude: 95.3238 },
    { name: "Kimaya Spa Surabaya", address: "Jl. Doktor Wahidin No.12, Surabaya 60264", latitude: -7.2575, longitude: 112.7521 },
    { name: "Kimaya Spa Gading Serpong", address: "Unity Building, Gading Serpong, Tangerang 15810", latitude: -6.2246, longitude: 106.6311 },
    { name: "Kimaya Spa Bintaro", address: "Jl. Maleo Raya, Pondok Pucung, Tangerang Selatan", latitude: -6.2783, longitude: 106.7156 },
  ];
  const locs = {};
  for (const l of locData) {
    const loc = await prisma.location.create({ data: l });
    locs[l.name] = loc;
  }

  // Score Config
  await prisma.scoreConfig.create({
    data: { attendanceWeight: 30, reportCompletenessWeight: 25, reportQualityWeight: 20, responseSpeedWeight: 15, initiativeWeight: 10, thresholdAlert: 70 },
  });

  // Users
  // Hash default password for all seed users
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log(`🔑 Default password for all seed users: ${DEFAULT_PASSWORD}`);

  const admin = await prisma.user.create({
    data: { email: "admin@kimayaexperience.com", fullName: "Admin HR", phone: "+6281200000000", role: "ADMIN", status: "ACTIVE", departmentId: depts["HR & Admin"].id, locationId: locs["Kimaya Spa Gading Serpong"].id, passwordHash: hashedPassword, onboardingCompleted: true },
  });

  const usersData = [
    { email: "rina@kimayaexperience.com", fullName: "Rina Amelia", phone: "+6281234567890", dept: "Spa Therapist", loc: "Kimaya Spa Banda Aceh", status: "ACTIVE", role: "THERAPIST" },
    { email: "dewi@kimayaexperience.com", fullName: "Dewi Kartika", phone: "+6281345678901", dept: "Front Desk", loc: "Kimaya Spa Surabaya", status: "ACTIVE", role: "THERAPIST" },
    { email: "siti@kimayaexperience.com", fullName: "Siti Nurhaliza", phone: "+6281456789012", dept: "Beauty Expert", loc: "Kimaya Spa Gading Serpong", status: "ACTIVE", role: "THERAPIST" },
    { email: "ahmad@kimayaexperience.com", fullName: "Ahmad Fauzi", phone: "+6281567890123", dept: "Operations", loc: "Kimaya Spa Bintaro", status: "ACTIVE", role: "THERAPIST" },
    { email: "farhan@kimayaexperience.com", fullName: "Farhan Malik", phone: "+6281678901234", dept: "Operations", loc: "Kimaya Spa Surabaya", status: "ACTIVE", role: "THERAPIST" },
    { email: "budi@kimayaexperience.com", fullName: "Budi Santoso", phone: "+6281789012345", dept: "Marketing", loc: "Kimaya Spa Gading Serpong", status: "PROBATION", role: "THERAPIST" },
    { email: "nadia@kimayaexperience.com", fullName: "Nadia Putri", phone: "+6281890123456", dept: "Spa Therapist", loc: "Kimaya Spa Banda Aceh", status: "ACTIVE", role: "THERAPIST" },
    { email: "rizky@kimayaexperience.com", fullName: "Rizky Pratama", phone: "+6281901234567", dept: "IT Support", loc: "Kimaya Spa Gading Serpong", status: "ACTIVE", role: "DEVELOPER" },
  ];
  const users = {};
  for (const u of usersData) {
    users[u.fullName] = await prisma.user.create({
      data: { email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, status: u.status, departmentId: depts[u.dept].id, locationId: locs[u.loc].id, passwordHash: hashedPassword, onboardingCompleted: u.role !== "THERAPIST" },
    });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Attendance — last 4 days + today
  const attData = [
    // Day -3
    ...[["Rina Amelia","07:55","17:05","ON_TIME"],["Dewi Kartika","08:02","17:10","ON_TIME"],["Siti Nurhaliza","08:00","17:00","ON_TIME"],["Ahmad Fauzi","08:15","17:00","LATE"],["Farhan Malik","07:50","17:02","ON_TIME"],["Budi Santoso","08:05","17:00","ON_TIME"],["Nadia Putri","08:00","17:00","ON_TIME"]].map(a => ({ name: a[0], day: -3, cin: a[1], cout: a[2], status: a[3] })),
    // Day -2
    ...[["Rina Amelia","07:58","17:03","ON_TIME"],["Dewi Kartika","08:00","17:00","ON_TIME"],["Siti Nurhaliza","07:55","17:05","ON_TIME"],["Ahmad Fauzi","08:08","17:00","ON_TIME"],["Farhan Malik","07:45","17:00","ON_TIME"],["Budi Santoso","08:30","17:00","LATE"],["Nadia Putri","08:00","17:00","ON_TIME"]].map(a => ({ name: a[0], day: -2, cin: a[1], cout: a[2], status: a[3] })),
    // Day -1
    ...[["Rina Amelia","07:50","17:00","ON_TIME"],["Dewi Kartika","08:05","17:00","ON_TIME"],["Siti Nurhaliza","08:20","17:10","LATE"],["Ahmad Fauzi","08:00","17:00","ON_TIME"],["Farhan Malik","08:00","17:05","ON_TIME"],["Nadia Putri","07:55","17:00","ON_TIME"]].map(a => ({ name: a[0], day: -1, cin: a[1], cout: a[2], status: a[3] })),
    // Today
    ...[["Rina Amelia","07:55",null,"ON_TIME"],["Dewi Kartika","08:02",null,"ON_TIME"],["Siti Nurhaliza","08:00",null,"ON_TIME"],["Ahmad Fauzi","08:15",null,"LATE"],["Farhan Malik","08:30",null,"LATE"],["Nadia Putri","08:00",null,"ON_TIME"]].map(a => ({ name: a[0], day: 0, cin: a[1], cout: a[2], status: a[3] })),
    { name: "Budi Santoso", day: 0, cin: null, cout: null, status: "ABSENT" },
  ];

  for (const a of attData) {
    const user = users[a.name];
    if (!user) continue;
    const date = new Date(today); date.setDate(date.getDate() + a.day);
    const makeTime = (d, t) => { if (!t) return null; const [h, m] = t.split(":"); const dt = new Date(d); dt.setHours(parseInt(h), parseInt(m), 0, 0); return dt; };
    await prisma.attendance.create({
      data: {
        userId: user.id, date, status: a.status,
        checkInTime: makeTime(date, a.cin), checkOutTime: makeTime(date, a.cout),
        checkInMethod: "WEB",
      },
    });
  }

  // Reports
  const reportsData = [
    { user: "Dewi Kartika", title: "Laporan Kunjungan Klien - PT Maju Jaya", category: "CLIENT_VISIT", status: "APPROVED", desc: "Kunjungan ke klien PT Maju Jaya untuk presentasi paket spa korporat" },
    { user: "Farhan Malik", title: "Progress Renovasi Cabang Bintaro", category: "PROJECT_PROGRESS", status: "SUBMITTED", desc: "Progress renovasi ruang treatment lantai 2" },
    { user: "Ahmad Fauzi", title: "Bukti Pengeluaran Supply Mei", category: "EXPENSE_PROOF", status: "REVISION_REQUIRED", desc: "Rekapan pengeluaran supply aromatherapy" },
    { user: "Rina Amelia", title: "Laporan Harian Spa Therapist", category: "DAILY_REPORT", status: "APPROVED", desc: "Rekap layanan spa hari ini: 8 client, 2 promo" },
    { user: "Siti Nurhaliza", title: "Laporan Training Beauty Expert", category: "PROJECT_PROGRESS", status: "SUBMITTED", desc: "Hasil training teknik facial terbaru" },
    { user: "Budi Santoso", title: "Rekapan Absensi Tim Marketing", category: "DAILY_REPORT", status: "APPROVED", desc: "Rekap absensi bulan April tim marketing" },
  ];
  for (const r of reportsData) {
    await prisma.report.create({
      data: {
        userId: users[r.user].id, title: r.title, category: r.category, status: r.status,
        description: r.desc, fileType: "PDF", submittedAt: new Date(),
        ...(r.status === "APPROVED" ? { reviewedById: admin.id, reviewedAt: new Date() } : {}),
      },
    });
  }

  // Employee Scores
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const scoresData = [
    { name: "Rina Amelia", att: 98, rep: 95, qual: 92, resp: 90, init: 95, total: 95, grade: "A" },
    { name: "Dewi Kartika", att: 95, rep: 90, qual: 88, resp: 92, init: 85, total: 91, grade: "A" },
    { name: "Siti Nurhaliza", att: 92, rep: 88, qual: 85, resp: 88, init: 80, total: 88, grade: "B" },
    { name: "Farhan Malik", att: 88, rep: 85, qual: 82, resp: 85, init: 85, total: 85, grade: "B" },
    { name: "Ahmad Fauzi", att: 85, rep: 80, qual: 80, resp: 82, init: 78, total: 82, grade: "B" },
    { name: "Budi Santoso", att: 75, rep: 78, qual: 76, resp: 80, init: 72, total: 76, grade: "C" },
    { name: "Nadia Putri", att: 90, rep: 72, qual: 70, resp: 75, init: 65, total: 74, grade: "C" },
    { name: "Rizky Pratama", att: 70, rep: 65, qual: 68, resp: 70, init: 60, total: 67, grade: "D" },
  ];
  for (const s of scoresData) {
    await prisma.employeeScore.create({
      data: {
        userId: users[s.name].id, periodDate: currentMonth,
        attendanceScore: s.att, reportCompletenessScore: s.rep, reportQualityScore: s.qual,
        responseSpeedScore: s.resp, initiativeScore: s.init, totalScore: s.total, grade: s.grade,
      },
    });
  }

  // Reminders
  const remindersData = [
    { title: "Reminder Check-In", msg: "Hai {nama}, jangan lupa check-in hari ini ya! 🕐", channel: "WHATSAPP", schedule: "DAILY", time: "07:30", status: "ACTIVE" },
    { title: "Deadline Laporan Mingguan", msg: "Halo {nama}, deadline upload laporan mingguan hari ini!", channel: "WHATSAPP_WEB", schedule: "WEEKLY", time: "14:00", status: "ACTIVE" },
    { title: "Rekap Skor Mingguan", msg: "Hi {nama}, skor performa minggu ini: {skor}.", channel: "WHATSAPP", schedule: "WEEKLY", time: "08:00", status: "ACTIVE" },
    { title: "Reminder Check-Out", msg: "Hai {nama}, sudah waktunya pulang!", channel: "WHATSAPP", schedule: "DAILY", time: "16:50", status: "PAUSED" },
    { title: "Pengingat Approval Cuti", msg: "Ada pengajuan cuti yang menunggu approval Anda.", channel: "WHATSAPP_EMAIL", schedule: "DAILY", time: "09:00", status: "ACTIVE" },
  ];
  for (const r of remindersData) {
    await prisma.reminder.create({
      data: {
        title: r.title, messageTemplate: r.msg, channel: r.channel,
        scheduleType: r.schedule, status: r.status, createdById: admin.id,
        scheduledTime: new Date(`1970-01-01T${r.time}:00Z`),
      },
    });
  }

  // Leave Requests
  await prisma.leaveRequest.create({
    data: { userId: users["Budi Santoso"].id, type: "SICK", startDate: today, endDate: new Date(today.getTime() + 86400000), reason: "Demam dan flu", status: "PENDING" },
  });
  await prisma.leaveRequest.create({
    data: { userId: users["Rizky Pratama"].id, type: "ANNUAL", startDate: today, endDate: new Date(today.getTime() + 3 * 86400000), reason: "Liburan keluarga", status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
  });

  console.log("✅ Database seeded successfully!");
  console.log("📊 Created: 9 users, attendance, 6 reports, 8 scores, 5 reminders, 2 leaves");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
