-- ============================================================
-- MediKiosk Database Schema
-- PostgreSQL 16+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (doctors only use JWT auth; patients identified by ABHA) ──────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(254) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone_number    VARCHAR(20),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('doctor', 'admin')),
    specialty       VARCHAR(100),
    hospital_name   VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ─── Patients (identified via mock ABHA ID or name) ─────────────────────
CREATE TABLE patients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abha_id         VARCHAR(50) UNIQUE,
    full_name       VARCHAR(200) NOT NULL,
    phone_number    VARCHAR(20),
    date_of_birth   DATE,
    language        VARCHAR(20) DEFAULT 'en',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_abha ON patients(abha_id);

-- ─── Intake Sessions ────────────────────────────────────────────────────
CREATE TABLE intake_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    doctor_id           UUID REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress', 'completed', 'reviewed')),
    conversation        JSONB NOT NULL DEFAULT '[]',
    structured_summary  JSONB,
    timeline            JSONB,
    chief_complaint     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_patient ON intake_sessions(patient_id);
CREATE INDEX idx_sessions_doctor ON intake_sessions(doctor_id);
CREATE INDEX idx_sessions_status ON intake_sessions(status, created_at DESC);

-- ─── OCR Scans ──────────────────────────────────────────────────────────
CREATE TABLE ocr_scans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
    raw_ocr_text    TEXT,
    structured_data JSONB,
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_session ON ocr_scans(session_id);

-- ─── Access Logs ────────────────────────────────────────────────────────
CREATE TABLE access_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    user_role       VARCHAR(20),
    action_type     VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     TEXT,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at DESC);

-- ─── Update trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON intake_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
