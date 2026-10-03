-- TechCity Civic Issue Management Schema for Supabase PostgreSQL

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  head_contact TEXT,
  sla_target_hours INTEGER DEFAULT 48,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Civic Issues Table
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL, -- e.g. CIV-2026-00101
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  urgency TEXT NOT NULL CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  priority_score INTEGER NOT NULL DEFAULT 30,
  priority_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_people INTEGER NOT NULL DEFAULT 1,
  department TEXT NOT NULL DEFAULT 'Unassigned',
  status TEXT NOT NULL CHECK (status IN (
    'Reported', 'AI Analysis', 'Assigned', 'In Progress', 
    'Resolution Submitted', 'User Verification', 'Resolved & Verified', 'REOPENED'
  )) DEFAULT 'Reported',
  sla_hours INTEGER NOT NULL DEFAULT 48,
  sla_deadline TIMESTAMPTZ NOT NULL,
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  ai_summary TEXT,
  ai_reasoning TEXT,
  -- Authority Role-Based Workflow Fields
  engineer_id TEXT,
  engineer_name TEXT,
  supervisor_id TEXT,
  supervisor_name TEXT,
  assigned_by TEXT,
  assignment_instructions TEXT,
  assignment_date TIMESTAMPTZ,
  assignment_status TEXT DEFAULT 'UNASSIGNED',
  admin_approval_status TEXT DEFAULT 'NONE',
  admin_reviewed_by TEXT,
  admin_reviewed_at TIMESTAMPTZ,
  admin_rejection_reason TEXT,
  task_status TEXT DEFAULT 'UNASSIGNED',
  task_accepted_at TIMESTAMPTZ,
  task_started_at TIMESTAMPTZ,
  task_completed_at TIMESTAMPTZ,
  work_notes TEXT,
  verification_status TEXT DEFAULT 'NONE',
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Issue Updates & Timeline
CREATE TABLE IF NOT EXISTS issue_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('Citizen', 'AI System', 'Municipal Authority', 'Department Staff')),
  actor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Supporting Reports / "Me Too"
CREATE TABLE IF NOT EXISTS supporting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  citizen_name TEXT,
  citizen_phone TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Resolution Proofs
CREATE TABLE IF NOT EXISTS resolution_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID UNIQUE NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  before_image TEXT NOT NULL,
  after_image TEXT NOT NULL,
  resolution_note TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_issues_tracking_id ON issues(tracking_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(department);
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_issue_updates_issue_id ON issue_updates(issue_id);
CREATE INDEX IF NOT EXISTS idx_supporting_reports_issue_id ON supporting_reports(issue_id);
