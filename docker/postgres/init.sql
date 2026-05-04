-- ============================================
-- Management Database Initialization Script
-- PostgreSQL 16 — Kimaya Experience
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM Types
-- ============================================
CREATE TYPE user_role AS ENUM ('DEVELOPER', 'ADMIN', 'THERAPIST');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'PROBATION', 'INACTIVE', 'TERMINATED');
CREATE TYPE attendance_status AS ENUM ('ON_TIME', 'LATE', 'EARLY', 'HALF_DAY', 'ABSENT');
CREATE TYPE leave_type AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'COMPANY', 'WFH');
CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE report_category AS ENUM ('CLIENT_VISIT', 'PROJECT_PROGRESS', 'DAILY_REPORT', 'EXPENSE_PROOF');
CREATE TYPE report_status AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUIRED');
CREATE TYPE reminder_channel AS ENUM ('WHATSAPP', 'WHATSAPP_WEB', 'WHATSAPP_EMAIL', 'EMAIL');
CREATE TYPE reminder_schedule AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'CUSTOM_CRON');
CREATE TYPE reminder_status AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');

-- ============================================
-- Departments & Locations
-- ============================================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geofence_radius_m INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Users (Karyawan)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'THERAPIST',
    status user_status NOT NULL DEFAULT 'ACTIVE',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    probation_end_date DATE,
    google_id VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_location ON users(location_id);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- Attendance (Absensi)
-- ============================================
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat DECIMAL(10, 8),
    check_in_lng DECIMAL(11, 8),
    check_out_lat DECIMAL(10, 8),
    check_out_lng DECIMAL(11, 8),
    check_in_selfie_url TEXT,
    check_in_method VARCHAR(20) DEFAULT 'WEB', -- WEB, WHATSAPP, QR
    status attendance_status NOT NULL DEFAULT 'ABSENT',
    notes TEXT,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_attendance_user ON attendances(user_id);
CREATE INDEX idx_attendance_date ON attendances(date);
CREATE INDEX idx_attendance_status ON attendances(status);

-- ============================================
-- Leave Requests (Cuti / Izin)
-- ============================================
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    attachment_url TEXT,
    status leave_status NOT NULL DEFAULT 'PENDING',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_user ON leave_requests(user_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_leave_dates ON leave_requests(start_date, end_date);

-- ============================================
-- Reports (Laporan & Bukti)
-- ============================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    category report_category NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size INTEGER, -- bytes
    file_type VARCHAR(20),
    status report_status NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    upload_source VARCHAR(20) DEFAULT 'WEB', -- WEB, WHATSAPP
    metadata JSONB, -- geo, timestamp, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_submitted ON reports(submitted_at);

-- ============================================
-- Scoring (Skoring Karyawan)
-- ============================================
CREATE TABLE score_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    attendance_weight INTEGER NOT NULL DEFAULT 30,
    report_completeness_weight INTEGER NOT NULL DEFAULT 25,
    report_quality_weight INTEGER NOT NULL DEFAULT 20,
    response_speed_weight INTEGER NOT NULL DEFAULT 15,
    initiative_weight INTEGER NOT NULL DEFAULT 10,
    threshold_alert INTEGER NOT NULL DEFAULT 70,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (attendance_weight + report_completeness_weight + report_quality_weight + response_speed_weight + initiative_weight = 100)
);

CREATE TABLE employee_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_date DATE NOT NULL, -- first day of the month
    attendance_score DECIMAL(5,2) DEFAULT 0,
    report_completeness_score DECIMAL(5,2) DEFAULT 0,
    report_quality_score DECIMAL(5,2) DEFAULT 0,
    response_speed_score DECIMAL(5,2) DEFAULT 0,
    initiative_score DECIMAL(5,2) DEFAULT 0,
    total_score DECIMAL(5,2) DEFAULT 0,
    grade CHAR(1), -- A, B, C, D, E
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_date)
);

CREATE INDEX idx_scores_user ON employee_scores(user_id);
CREATE INDEX idx_scores_period ON employee_scores(period_date);
CREATE INDEX idx_scores_total ON employee_scores(total_score);

-- Bonus points from managers
CREATE TABLE initiative_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    given_by UUID NOT NULL REFERENCES users(id),
    points INTEGER NOT NULL CHECK (points > 0 AND points <= 10),
    reason TEXT NOT NULL,
    period_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Reminders
-- ============================================
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    message_template TEXT NOT NULL,
    target_role user_role, -- NULL = all
    target_department_id UUID REFERENCES departments(id),
    target_user_id UUID REFERENCES users(id),
    channel reminder_channel NOT NULL DEFAULT 'WHATSAPP',
    schedule_type reminder_schedule NOT NULL DEFAULT 'DAILY',
    cron_expression VARCHAR(50), -- for CUSTOM_CRON
    scheduled_time TIME, -- for DAILY / WEEKLY
    scheduled_day INTEGER, -- 0-6 for WEEKLY (0 = Sunday)
    status reminder_status NOT NULL DEFAULT 'ACTIVE',
    last_sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    channel reminder_channel NOT NULL,
    status VARCHAR(20) DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
    error_message TEXT,
    waha_message_id VARCHAR(100)
);

CREATE INDEX idx_reminder_logs_reminder ON reminder_logs(reminder_id);
CREATE INDEX idx_reminder_logs_sent ON reminder_logs(sent_at);

-- ============================================
-- Audit Log
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, CREATE, UPDATE, DELETE, EXPORT
    entity_type VARCHAR(50), -- USER, ATTENDANCE, REPORT, SCORE, etc.
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================
-- System Configuration
-- ============================================
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Seed Data
-- ============================================

-- Default system config
INSERT INTO system_config (key, value, description) VALUES
    ('default_check_in_time', '08:00', 'Jam masuk default'),
    ('default_check_out_time', '17:00', 'Jam pulang default'),
    ('late_tolerance_minutes', '10', 'Toleransi keterlambatan (menit)'),
    ('geofence_radius_meters', '100', 'Radius geolokasi check-in (meter)'),
    ('max_upload_size_mb', '25', 'Ukuran maksimal upload file (MB)'),
    ('score_calculation_time', '00:00', 'Waktu perhitungan skor otomatis'),
    ('weekly_recap_day', '1', 'Hari kirim rekap mingguan (1=Senin)'),
    ('weekly_recap_time', '08:00', 'Jam kirim rekap mingguan');

-- Departments (Kimaya Experience)
INSERT INTO departments (name, description) VALUES
    ('Spa Therapist', 'Tim spa dan terapi'),
    ('Beauty Expert', 'Tim kecantikan dan treatment'),
    ('Front Desk', 'Resepsionis dan layanan pelanggan'),
    ('Operations', 'Tim operasional'),
    ('Marketing', 'Tim pemasaran dan promosi'),
    ('IT Support', 'Tim teknologi informasi'),
    ('HR & Admin', 'Human Resources dan administrasi');

-- Locations (Kimaya Experience branches)
INSERT INTO locations (name, address, latitude, longitude, geofence_radius_m) VALUES
    ('Kimaya Spa Banda Aceh', 'Kota Banda Aceh, Aceh 24415', 5.5483, 95.3238, 100),
    ('Kimaya Spa Surabaya', 'Jl. Doktor Wahidin No.12, DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur 60264', -7.2575, 112.7521, 100),
    ('Kimaya Spa Gading Serpong', 'Unity Building, Jl. Gading Serpaong Boulevard No.M5-21, Tangerang, Banten 15810', -6.2246, 106.6311, 100),
    ('Kimaya Spa Bintaro', 'Blok JA2 No.8, Jl. Maleo Raya, Pondok Pucung, Tangerang Selatan', -6.2783, 106.7156, 100);

-- Default score config (company-wide)
INSERT INTO score_configs (attendance_weight, report_completeness_weight, report_quality_weight, response_speed_weight, initiative_weight, threshold_alert) VALUES
    (30, 25, 20, 15, 10, 70);

-- ============================================
-- Seed Users (password: kimaya123 for all)
-- ============================================
DO $$
DECLARE
  dept_spa UUID; dept_beauty UUID; dept_front UUID; dept_ops UUID; dept_mkt UUID; dept_it UUID; dept_hr UUID;
  loc_aceh UUID; loc_sby UUID; loc_gs UUID; loc_btn UUID;
  uid_admin UUID; uid_rina UUID; uid_dewi UUID; uid_siti UUID; uid_ahmad UUID;
  uid_farhan UUID; uid_budi UUID; uid_nadia UUID; uid_rizky UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO dept_spa FROM departments WHERE name = 'Spa Therapist';
  SELECT id INTO dept_beauty FROM departments WHERE name = 'Beauty Expert';
  SELECT id INTO dept_front FROM departments WHERE name = 'Front Desk';
  SELECT id INTO dept_ops FROM departments WHERE name = 'Operations';
  SELECT id INTO dept_mkt FROM departments WHERE name = 'Marketing';
  SELECT id INTO dept_it FROM departments WHERE name = 'IT Support';
  SELECT id INTO dept_hr FROM departments WHERE name = 'HR & Admin';

  -- Get location IDs
  SELECT id INTO loc_aceh FROM locations WHERE name LIKE '%Banda Aceh%';
  SELECT id INTO loc_sby FROM locations WHERE name LIKE '%Surabaya%';
  SELECT id INTO loc_gs FROM locations WHERE name LIKE '%Gading Serpong%';
  SELECT id INTO loc_btn FROM locations WHERE name LIKE '%Bintaro%';

  -- Insert Admin
  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('admin@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Admin HR', '+6281200000000', 'ADMIN', 'ACTIVE', dept_hr, loc_gs, '2023-06-01')
  RETURNING id INTO uid_admin;

  -- Insert Employees
  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('rina@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Rina Amelia', '+6281234567890', 'THERAPIST', 'ACTIVE', dept_spa, loc_aceh, '2024-01-15')
  RETURNING id INTO uid_rina;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('dewi@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Dewi Kartika', '+6281345678901', 'THERAPIST', 'ACTIVE', dept_front, loc_sby, '2024-03-20')
  RETURNING id INTO uid_dewi;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('siti@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Siti Nurhaliza', '+6281456789012', 'THERAPIST', 'ACTIVE', dept_beauty, loc_gs, '2024-06-01')
  RETURNING id INTO uid_siti;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('ahmad@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Ahmad Fauzi', '+6281567890123', 'THERAPIST', 'ACTIVE', dept_ops, loc_btn, '2024-02-10')
  RETURNING id INTO uid_ahmad;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('farhan@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Farhan Malik', '+6281678901234', 'THERAPIST', 'ACTIVE', dept_ops, loc_sby, '2024-04-05')
  RETURNING id INTO uid_farhan;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('budi@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Budi Santoso', '+6281789012345', 'THERAPIST', 'PROBATION', dept_mkt, loc_gs, '2026-04-01')
  RETURNING id INTO uid_budi;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('nadia@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Nadia Putri', '+6281890123456', 'THERAPIST', 'ACTIVE', dept_spa, loc_aceh, '2024-08-15')
  RETURNING id INTO uid_nadia;

  INSERT INTO users (email, password_hash, full_name, phone, role, status, department_id, location_id, join_date)
    VALUES ('rizky@kimayaexperience.com', crypt('kimaya123', gen_salt('bf')), 'Rizky Pratama', '+6281901234567', 'DEVELOPER', 'INACTIVE', dept_it, loc_gs, '2025-09-10')
  RETURNING id INTO uid_rizky;

  -- ============================================
  -- Seed Attendance (last 7 days)
  -- ============================================
  -- Day -6 (Monday)
  INSERT INTO attendances (user_id, date, check_in_time, check_out_time, status, check_in_method) VALUES
    (uid_rina,  CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '07:55', (CURRENT_DATE - 6) + TIME '17:05', 'ON_TIME', 'WEB'),
    (uid_dewi,  CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '08:02', (CURRENT_DATE - 6) + TIME '17:10', 'ON_TIME', 'WEB'),
    (uid_siti,  CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '08:00', (CURRENT_DATE - 6) + TIME '17:00', 'ON_TIME', 'WHATSAPP'),
    (uid_ahmad, CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '08:15', (CURRENT_DATE - 6) + TIME '17:00', 'LATE', 'WEB'),
    (uid_farhan,CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '07:50', (CURRENT_DATE - 6) + TIME '17:02', 'ON_TIME', 'WEB'),
    (uid_budi,  CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '08:05', (CURRENT_DATE - 6) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_nadia, CURRENT_DATE - 6, (CURRENT_DATE - 6) + TIME '08:00', (CURRENT_DATE - 6) + TIME '17:00', 'ON_TIME', 'WHATSAPP');
  -- Day -5 (Tuesday)
  INSERT INTO attendances (user_id, date, check_in_time, check_out_time, status, check_in_method) VALUES
    (uid_rina,  CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '07:58', (CURRENT_DATE - 5) + TIME '17:03', 'ON_TIME', 'WEB'),
    (uid_dewi,  CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '08:00', (CURRENT_DATE - 5) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_siti,  CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '07:55', (CURRENT_DATE - 5) + TIME '17:05', 'ON_TIME', 'WEB'),
    (uid_ahmad, CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '08:08', (CURRENT_DATE - 5) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_farhan,CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '07:45', (CURRENT_DATE - 5) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_budi,  CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '08:30', (CURRENT_DATE - 5) + TIME '17:00', 'LATE', 'WEB'),
    (uid_nadia, CURRENT_DATE - 5, (CURRENT_DATE - 5) + TIME '08:00', (CURRENT_DATE - 5) + TIME '17:00', 'ON_TIME', 'WHATSAPP'),
    (uid_rizky, CURRENT_DATE - 5, NULL, NULL, 'ABSENT', 'WEB');
  -- Day -4 (Wednesday)
  INSERT INTO attendances (user_id, date, check_in_time, check_out_time, status, check_in_method) VALUES
    (uid_rina,  CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '07:50', (CURRENT_DATE - 4) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_dewi,  CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '08:05', (CURRENT_DATE - 4) + TIME '17:00', 'ON_TIME', 'WEB'),
    (uid_siti,  CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '08:20', (CURRENT_DATE - 4) + TIME '17:10', 'LATE', 'WEB'),
    (uid_ahmad, CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '08:00', (CURRENT_DATE - 4) + TIME '17:00', 'ON_TIME', 'WHATSAPP'),
    (uid_farhan,CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '08:00', (CURRENT_DATE - 4) + TIME '17:05', 'ON_TIME', 'WEB'),
    (uid_nadia, CURRENT_DATE - 4, (CURRENT_DATE - 4) + TIME '07:55', (CURRENT_DATE - 4) + TIME '17:00', 'ON_TIME', 'WEB');
  -- Today
  INSERT INTO attendances (user_id, date, check_in_time, check_out_time, status, check_in_method) VALUES
    (uid_rina,  CURRENT_DATE, CURRENT_DATE + TIME '07:55', NULL, 'ON_TIME', 'WEB'),
    (uid_dewi,  CURRENT_DATE, CURRENT_DATE + TIME '08:02', NULL, 'ON_TIME', 'WEB'),
    (uid_siti,  CURRENT_DATE, CURRENT_DATE + TIME '08:00', NULL, 'ON_TIME', 'WHATSAPP'),
    (uid_ahmad, CURRENT_DATE, CURRENT_DATE + TIME '08:15', NULL, 'LATE', 'WEB'),
    (uid_farhan,CURRENT_DATE, CURRENT_DATE + TIME '08:30', NULL, 'LATE', 'WEB'),
    (uid_nadia, CURRENT_DATE, CURRENT_DATE + TIME '08:00', NULL, 'ON_TIME', 'WHATSAPP'),
    (uid_budi,  CURRENT_DATE, NULL, NULL, 'ABSENT', 'WEB');

  -- ============================================
  -- Seed Reports
  -- ============================================
  INSERT INTO reports (user_id, title, category, description, file_type, status, submitted_at, reviewed_by, reviewed_at) VALUES
    (uid_dewi,  'Laporan Kunjungan Klien - PT Maju Jaya', 'CLIENT_VISIT', 'Kunjungan ke klien PT Maju Jaya untuk presentasi paket spa korporat', 'PDF', 'APPROVED', NOW() - INTERVAL '2 hours', uid_admin, NOW() - INTERVAL '1 hour'),
    (uid_farhan,'Progress Renovasi Cabang Bintaro', 'PROJECT_PROGRESS', 'Progress renovasi ruang treatment lantai 2', 'DOCX', 'SUBMITTED', NOW() - INTERVAL '3 hours', NULL, NULL),
    (uid_ahmad, 'Bukti Pengeluaran Supply Mei', 'EXPENSE_PROOF', 'Rekapan pengeluaran supply aromatherapy', 'XLSX', 'REVISION_REQUIRED', NOW() - INTERVAL '1 day', uid_admin, NOW() - INTERVAL '12 hours'),
    (uid_rina,  'Laporan Harian Spa Therapist', 'DAILY_REPORT', 'Rekap layanan spa hari ini: 8 client, 2 promo', 'PDF', 'APPROVED', NOW() - INTERVAL '1 day', uid_admin, NOW() - INTERVAL '20 hours'),
    (uid_siti,  'Laporan Training Beauty Expert', 'PROJECT_PROGRESS', 'Hasil training teknik facial terbaru', 'PDF', 'SUBMITTED', NOW() - INTERVAL '2 days', NULL, NULL),
    (uid_budi,  'Rekapan Absensi Tim Marketing', 'DAILY_REPORT', 'Rekap absensi bulan April tim marketing', 'XLSX', 'APPROVED', NOW() - INTERVAL '2 days', uid_admin, NOW() - INTERVAL '1 day');

  -- ============================================
  -- Seed Employee Scores (current month)
  -- ============================================
  INSERT INTO employee_scores (user_id, period_date, attendance_score, report_completeness_score, report_quality_score, response_speed_score, initiative_score, total_score, grade) VALUES
    (uid_rina,  DATE_TRUNC('month', CURRENT_DATE), 98, 95, 92, 90, 95, 95, 'A'),
    (uid_dewi,  DATE_TRUNC('month', CURRENT_DATE), 95, 90, 88, 92, 85, 91, 'A'),
    (uid_siti,  DATE_TRUNC('month', CURRENT_DATE), 92, 88, 85, 88, 80, 88, 'B'),
    (uid_farhan,DATE_TRUNC('month', CURRENT_DATE), 88, 85, 82, 85, 85, 85, 'B'),
    (uid_ahmad, DATE_TRUNC('month', CURRENT_DATE), 85, 80, 80, 82, 78, 82, 'B'),
    (uid_budi,  DATE_TRUNC('month', CURRENT_DATE), 75, 78, 76, 80, 72, 76, 'C'),
    (uid_nadia, DATE_TRUNC('month', CURRENT_DATE), 90, 72, 70, 75, 65, 74, 'C'),
    (uid_rizky, DATE_TRUNC('month', CURRENT_DATE), 70, 65, 68, 70, 60, 67, 'D');
  -- Previous months
  INSERT INTO employee_scores (user_id, period_date, attendance_score, report_completeness_score, report_quality_score, response_speed_score, initiative_score, total_score, grade) VALUES
    (uid_rina,  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 95, 92, 90, 88, 90, 92, 'A'),
    (uid_dewi,  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 90, 88, 85, 90, 80, 87, 'B'),
    (uid_rina,  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months', 93, 90, 88, 85, 88, 90, 'A'),
    (uid_dewi,  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months', 88, 85, 82, 88, 78, 84, 'B');

  -- ============================================
  -- Seed Leave Requests
  -- ============================================
  INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, status, approved_by, approved_at) VALUES
    (uid_budi,  'SICK', CURRENT_DATE, CURRENT_DATE + 1, 'Demam dan flu', 'PENDING', NULL, NULL),
    (uid_rizky, 'ANNUAL', CURRENT_DATE, CURRENT_DATE + 3, 'Liburan keluarga', 'APPROVED', uid_admin, NOW() - INTERVAL '2 days'),
    (uid_nadia, 'EMERGENCY', CURRENT_DATE + 1, CURRENT_DATE + 1, 'Urusan keluarga mendadak', 'PENDING', NULL, NULL);

  -- ============================================
  -- Seed Reminders
  -- ============================================
  INSERT INTO reminders (title, message_template, channel, schedule_type, scheduled_time, status, created_by, last_sent_at) VALUES
    ('Reminder Check-In', 'Hai {nama}, jangan lupa check-in hari ini ya! 🕐', 'WHATSAPP', 'DAILY', '07:30', 'ACTIVE', uid_admin, CURRENT_DATE + TIME '07:30'),
    ('Deadline Laporan Mingguan', 'Halo {nama}, deadline upload laporan mingguan hari Jumat jam 14:00. Jangan sampai terlewat! 📝', 'WHATSAPP_WEB', 'WEEKLY', '14:00', 'ACTIVE', uid_admin, CURRENT_DATE - 4 + TIME '14:00'),
    ('Rekap Skor Mingguan', 'Hi {nama}, skor performa minggu ini: {skor}. Pertahankan atau tingkatkan ya! ⭐', 'WHATSAPP', 'WEEKLY', '08:00', 'ACTIVE', uid_admin, CURRENT_DATE - 1 + TIME '08:00'),
    ('Reminder Check-Out', 'Hai {nama}, sudah waktunya pulang! Jangan lupa check-out ya 🏠', 'WHATSAPP', 'DAILY', '16:50', 'PAUSED', uid_admin, CURRENT_DATE - 9 + TIME '16:50'),
    ('Pengingat Approval Cuti', 'Ada pengajuan cuti yang menunggu approval Anda. Silakan cek dashboard Kimaya Management 📋', 'WHATSAPP_EMAIL', 'DAILY', '09:00', 'ACTIVE', uid_admin, CURRENT_DATE + TIME '09:00');

  RAISE NOTICE 'Management database seeded successfully!';
  RAISE NOTICE 'Default password for all users: kimaya123';
END $$;
