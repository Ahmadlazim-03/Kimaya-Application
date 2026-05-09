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

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  await prisma.user.create({
    data: { 
      email: "developer@kimayaexperience.com", 
      fullName: "System Developer", 
      phone: "+6280000000000", 
      role: "DEVELOPER", 
      status: "ACTIVE", 
      departmentId: depts["IT Support"].id, 
      locationId: locs["Kimaya Spa Gading Serpong"].id, 
      passwordHash: hashedPassword, 
      onboardingCompleted: true 
    },
  });

  console.log(`🔑 Default password for Developer (developer@kimayaexperience.com): ${DEFAULT_PASSWORD}`);
  console.log("✅ Database seeded: system config, departments, locations, score config, and root developer");
  console.log("ℹ️  Login as Developer to add more accounts via /dashboard/employees");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
