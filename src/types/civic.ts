export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IssueStatus =
  | 'Reported'
  | 'AI Analysis'
  | 'Assigned'
  | 'In Progress'
  | 'Resolution Submitted'
  | 'User Verification'
  | 'Resolved & Verified'
  | 'REOPENED';

export type AssignmentStatus =
  | 'UNASSIGNED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type AdminApprovalStatus =
  | 'NONE'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export type TaskStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'REOPENED';

export type VerificationStatus =
  | 'NONE'
  | 'PENDING'
  | 'VERIFIED'
  | 'REOPENED';

export type IssueCategory =
  | 'Pothole'
  | 'Damaged Road'
  | 'Garbage / Waste'
  | 'Waterlogging'
  | 'Broken Streetlight'
  | 'Blocked Drain'
  | 'Sewage Problem'
  | 'Fallen Tree'
  | 'Encroachment'
  | 'Other';

export type Department =
  | 'Roads & Infrastructure'
  | 'Solid Waste Management'
  | 'Water Supply & Sewerage'
  | 'Electrical & Street Lighting'
  | 'Stormwater Drainage'
  | 'Horticulture & Trees'
  | 'Town Planning & Enforcement'
  | 'General Municipal Administration';

export interface TimelineEvent {
  id: string;
  issue_id: string;
  status: IssueStatus;
  title: string;
  description: string;
  actor: 'Citizen' | 'AI System' | 'Municipal Authority' | 'Department Staff';
  actor_name?: string;
  created_at: string;
}

export interface SupportingReport {
  id: string;
  issue_id: string;
  citizen_name?: string;
  citizen_phone?: string;
  note?: string;
  created_at: string;
}

export interface ResolutionProof {
  id: string;
  issue_id: string;
  before_image: string;
  after_image: string;
  resolution_note: string;
  submitted_by: string;
  submitted_at: string;
  verified_at?: string;
  rejection_reason?: string;
}

export interface PriorityBreakdown {
  score: number; // 0 - 120
  level: PriorityLevel;
  reasons: string[];
  sla_hours: number;
  sla_deadline: string; // ISO string
  is_overdue: boolean;
  hours_remaining_or_overdue: number;
}

export interface CivicIssue {
  id: string;
  tracking_id: string; // e.g. CIV-2026-00101
  category: IssueCategory;
  title: string;
  description: string;
  evidence_url: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark?: string;
  severity: PriorityLevel;
  urgency: PriorityLevel;
  priority: PriorityLevel;
  priority_score: number;
  priority_reasons: string[];
  affected_people: number;
  department: Department | 'Unassigned';
  status: IssueStatus;
  sla_hours: number;
  sla_deadline: string;
  is_overdue: boolean;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  is_demo: boolean;
  ai_summary?: string;
  ai_reasoning?: string;
  created_at: string;
  updated_at: string;

  // Authority Workflow Fields
  engineer_id?: string;
  engineer_name?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  assigned_by?: string;
  assignment_instructions?: string;
  assignment_date?: string;
  assignment_status?: AssignmentStatus;
  admin_approval_status?: AdminApprovalStatus;
  admin_reviewed_by?: string;
  admin_reviewed_at?: string;
  admin_rejection_reason?: string;
  task_status?: TaskStatus;
  task_accepted_at?: string;
  task_started_at?: string;
  task_completed_at?: string;
  work_notes?: string;
  verification_status?: VerificationStatus;
  verified_by?: string;
  verified_at?: string;

  timeline?: TimelineEvent[];
  resolution_proof?: ResolutionProof;
  supporting_reports?: SupportingReport[];
}

export interface AIAnalysisResult {
  category: IssueCategory;
  severity: PriorityLevel;
  urgency: PriorityLevel;
  suggested_department: Department;
  concise_summary: string;
  reasoning: string;
}

export interface DuplicateCheckResult {
  has_duplicate: boolean;
  matched_issue?: CivicIssue;
  similarity_score?: number; // 0 to 1
  reason?: string;
}

export interface AnalyticsSummary {
  total_issues: number;
  open_issues: number;
  critical_high_issues: number;
  overdue_issues: number;
  resolved_issues: number;
  average_resolution_hours: number;
  by_category: { category: string; count: number }[];
  by_status: { status: string; count: number }[];
  by_priority: { priority: string; count: number; color: string }[];
  by_department: { department: string; count: number }[];
  hotspots: {
    area: string;
    latitude: number;
    longitude: number;
    issue_count: number;
    critical_count: number;
    top_category: string;
  }[];
}
