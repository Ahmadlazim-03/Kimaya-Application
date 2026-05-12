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

  // Shifts — only 2 active shifts. Window between checkInStart and startTime
  // counts as ON_TIME. Before checkInStart → EARLY; after startTime → LATE.
  const shiftPagi = await prisma.shift.create({
    data: {
      name: "Pagi",
      checkInStart: "09:30",
      startTime: "10:00",
      endTime: "19:00",
      description: "Shift Pagi: window check-in 09:30–10:00, kerja 10:00–19:00",
    },
  });
  const shiftMalam = await prisma.shift.create({
    data: {
      name: "Malam",
      checkInStart: "12:30",
      startTime: "13:00",
      endTime: "22:00",
      description: "Shift Malam: window check-in 12:30–13:00, kerja 13:00–22:00",
    },
  });

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // One seed account per role so the team can smoke-test the full flow
  // without manually creating users. All passwords are kimaya2026.
  const defaultLocationId = locs["Kimaya Spa Gading Serpong"].id;

  await prisma.user.create({
    data: {
      email: "developer@kimayaexperience.com",
      fullName: "System Developer",
      phone: "+6280000000000",
      role: "DEVELOPER",
      status: "ACTIVE",
      departmentId: depts["IT Support"].id,
      locationId: defaultLocationId,
      passwordHash: hashedPassword,
      onboardingCompleted: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "manager@kimayaexperience.com",
      fullName: "Manager Kimaya",
      phone: "+6281000000001",
      role: "MANAGER",
      status: "ACTIVE",
      departmentId: depts["Operations"].id,
      locationId: defaultLocationId,
      passwordHash: hashedPassword,
      onboardingCompleted: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "cs@kimayaexperience.com",
      fullName: "Customer Service Kimaya",
      phone: "+6281000000002",
      role: "CS",
      status: "ACTIVE",
      departmentId: depts["Front Desk"].id,
      locationId: defaultLocationId,
      // CS now does face-attendance too, so they MUST onboard their face.
      // Leave onboardingCompleted false so first login goes through the
      // face-registration flow.
      onboardingCompleted: false,
      shiftId: shiftPagi.id,
      passwordHash: hashedPassword,
    },
  });

  await prisma.user.create({
    data: {
      email: "therapist@kimayaexperience.com",
      fullName: "Therapist Kimaya",
      phone: "+6281000000003",
      role: "THERAPIST",
      status: "ACTIVE",
      departmentId: depts["Spa Therapist"].id,
      locationId: defaultLocationId,
      onboardingCompleted: false, // Goes through face onboarding on first login
      shiftId: shiftPagi.id,
      passwordHash: hashedPassword,
    },
  });

  console.log("✅ Seeded shifts: Pagi (09:30→10:00, kerja 10–19), Malam (12:30→13:00, kerja 13–22)");
  console.log("✅ Seeded 4 accounts (password: kimaya2026):");
  console.log("   - developer@kimayaexperience.com  (DEVELOPER)");
  console.log("   - manager@kimayaexperience.com    (MANAGER)");
  console.log("   - cs@kimayaexperience.com         (CS, shift Pagi, perlu onboarding wajah)");
  console.log("   - therapist@kimayaexperience.com  (THERAPIST, shift Pagi, perlu onboarding wajah)");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
