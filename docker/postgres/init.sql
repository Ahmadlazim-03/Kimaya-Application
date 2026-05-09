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
CREATE TYPE user_role AS ENUM ('DEVELOPER', 'MANAGER', 'CS', 'THERAPIST');
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

-- (No seed users – all accounts are created via the web UI /register or /dashboard/employees)

