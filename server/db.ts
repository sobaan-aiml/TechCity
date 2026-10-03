import fs from 'fs';
import path from 'path';
import {
  CivicIssue,
  TimelineEvent,
  SupportingReport,
  ResolutionProof,
  IssueCategory,
  PriorityLevel,
  IssueStatus,
  Department,
  DuplicateCheckResult,
  AnalyticsSummary,
} from '../src/types/civic.js';
import { calculatePriority } from './priority.js';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? '/tmp' : path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'civic_db.json');

export const DEPARTMENTS: Department[] = [
  'Roads & Infrastructure',
  'Solid Waste Management',
  'Water Supply & Sewerage',
  'Electrical & Street Lighting',
  'Stormwater Drainage',
  'Horticulture & Trees',
  'Town Planning & Enforcement',
  'General Municipal Administration',
];

interface DatabaseSchema {
  issues: CivicIssue[];
  timeline: TimelineEvent[];
  supporting_reports: SupportingReport[];
  resolution_proofs: ResolutionProof[];
  last_ticket_number: number;
}

let dbCache: DatabaseSchema | null = null;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Read-only filesystem in serverless, will operate in-memory safely
  }
}

function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;

  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      refreshIssueSlas(dbCache!);
      return dbCache!;
    }
  } catch (e) {
    console.warn('[DB] Failed reading db file, regenerating initial seed:', e);
  }

  const initial = getInitialSeed();
  dbCache = initial;
  saveDatabase(initial);
  return dbCache;
}

function saveDatabase(data: DatabaseSchema) {
  dbCache = data;
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // In serverless environments, file writing may be restricted; memory cache will continue working
  }
}

function refreshIssueSlas(db: DatabaseSchema) {
  const now = Date.now();
  db.issues.forEach((issue) => {
    const isResolved = issue.status === 'Resolved & Verified';
    const deadlineTime = new Date(issue.sla_deadline).getTime();
    issue.is_overdue = !isResolved && now > deadlineTime;
  });
}

// Distance in kilometers using Haversine formula
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function stringSimilarity(s1: string, s2: string): number {
  const words1 = new Set(s1.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;
  let matches = 0;
  words1.forEach(w => {
    if (words2.has(w)) matches++;
  });
  return (2 * matches) / (words1.size + words2.size);
}

export function getAllIssues(filters?: {
  category?: string;
  priority?: string;
  status?: string;
  department?: string;
  search?: string;
}): CivicIssue[] {
  const db = loadDatabase();
  refreshIssueSlas(db);

  return db.issues
    .map(issue => attachRelations(issue, db))
    .filter(issue => {
      if (filters?.category && filters.category !== 'ALL' && issue.category !== filters.category) return false;
      if (filters?.priority && filters.priority !== 'ALL' && issue.priority !== filters.priority) return false;
      if (filters?.status && filters.status !== 'ALL' && issue.status !== filters.status) return false;
      if (filters?.department && filters.department !== 'ALL' && issue.department !== filters.department) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const match =
          issue.tracking_id.toLowerCase().includes(q) ||
          issue.title.toLowerCase().includes(q) ||
          issue.description.toLowerCase().includes(q) ||
          issue.address.toLowerCase().includes(q) ||
          issue.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getIssueByIdOrTracking(idOrTracking: string): CivicIssue | null {
  const db = loadDatabase();
  refreshIssueSlas(db);
  const issue = db.issues.find(
    i => i.id === idOrTracking || i.tracking_id.toLowerCase() === idOrTracking.trim().toLowerCase()
  );
  if (!issue) return null;
  return attachRelations(issue, db);
}

function attachRelations(issue: CivicIssue, db: DatabaseSchema): CivicIssue {
  const timeline = db.timeline
    .filter(t => t.issue_id === issue.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const resolution_proof = db.resolution_proofs.find(r => r.issue_id === issue.id);
  const supporting_reports = db.supporting_reports.filter(s => s.issue_id === issue.id);

  return {
    ...issue,
    timeline,
    resolution_proof,
    supporting_reports,
  };
}

export function checkDuplicate(
  category: IssueCategory,
  lat?: number,
  lng?: number,
  description?: string
): DuplicateCheckResult {
  const db = loadDatabase();
  const openIssues = db.issues.filter(
    i => i.status !== 'Resolved & Verified'
  );

  let bestMatch: CivicIssue | null = null;
  let highestScore = 0;
  let matchReason = '';

  for (const issue of openIssues) {
    let score = 0;
    const sameCategory = issue.category.toLowerCase() === category.toLowerCase();

    // Check location distance if coords provided
    let distanceKm: number | null = null;
    if (lat && lng && issue.latitude && issue.longitude) {
      distanceKm = calculateDistanceKm(lat, lng, issue.latitude, issue.longitude);
      if (distanceKm <= 0.3) {
        score += 0.55; // within 300m
      } else if (distanceKm <= 0.8) {
        score += 0.35; // within 800m
      }
    }

    if (sameCategory) {
      score += 0.35;
    }

    if (description && issue.description) {
      const textSim = stringSimilarity(description, issue.description);
      score += textSim * 0.4;
    }

    if (score > highestScore && score >= 0.6) {
      highestScore = score;
      bestMatch = issue;
      if (distanceKm !== null && distanceKm <= 0.3 && sameCategory) {
        matchReason = `Identical category "${category}" within ${Math.round(distanceKm * 1000)} meters of this location.`;
      } else if (sameCategory) {
        matchReason = `Similar reported issue in "${category}" with matching description in the vicinity.`;
      } else {
        matchReason = `High contextual similarity to an active municipal ticket nearby.`;
      }
    }
  }

  if (bestMatch) {
    return {
      has_duplicate: true,
      matched_issue: attachRelations(bestMatch, db),
      similarity_score: Math.min(1, Math.round(highestScore * 100) / 100),
      reason: matchReason,
    };
  }

  return { has_duplicate: false };
}

export function createIssue(data: {
  category: IssueCategory;
  title: string;
  description: string;
  evidence_url?: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark?: string;
  severity: PriorityLevel;
  urgency: PriorityLevel;
  department?: Department;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  ai_summary?: string;
  ai_reasoning?: string;
}): CivicIssue {
  const db = loadDatabase();
  const id = `iss_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ticketNum = db.last_ticket_number + 1;
  db.last_ticket_number = ticketNum;
  const tracking_id = `CIV-2026-${String(ticketNum).padStart(5, '0')}`;
  const nowIso = new Date().toISOString();

  // Deterministic priority & SLA calculation
  const priorityCalc = calculatePriority(data.severity, data.urgency, 1, nowIso, 'Reported');

  const newIssue: CivicIssue = {
    id,
    tracking_id,
    category: data.category,
    title: data.title || `${data.category} at ${data.address.split(',')[0]}`,
    description: data.description,
    evidence_url: data.evidence_url || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
    landmark: data.landmark || '',
    severity: data.severity,
    urgency: data.urgency,
    priority: priorityCalc.level,
    priority_score: priorityCalc.score,
    priority_reasons: priorityCalc.reasons,
    affected_people: 1,
    department: data.department || 'Unassigned',
    status: 'Reported',
    sla_hours: priorityCalc.sla_hours,
    sla_deadline: priorityCalc.sla_deadline,
    is_overdue: false,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    is_demo: false,
    ai_summary: data.ai_summary,
    ai_reasoning: data.ai_reasoning,
    assignment_status: 'UNASSIGNED',
    admin_approval_status: 'NONE',
    task_status: 'UNASSIGNED',
    verification_status: 'NONE',
    created_at: nowIso,
    updated_at: nowIso,
  };

  db.issues.unshift(newIssue);

  // Initial timeline event: Reported
  db.timeline.push({
    id: `tl_${Date.now()}_1`,
    issue_id: id,
    status: 'Reported',
    title: 'Issue Submitted by Citizen',
    description: `Report filed with priority ${priorityCalc.level} (SLA target: ${priorityCalc.sla_hours} hours).`,
    actor: 'Citizen',
    actor_name: data.contact_name || 'Community Member',
    created_at: nowIso,
  });

  // AI analysis timeline event if present
  if (data.ai_summary || data.ai_reasoning) {
    db.timeline.push({
      id: `tl_${Date.now()}_2`,
      issue_id: id,
      status: 'AI Analysis',
      title: 'Automated AI Triage & Classification',
      description: data.ai_reasoning || 'Severity, urgency, and recommended department analyzed by Gemini.',
      actor: 'AI System',
      actor_name: 'TechCity AI Engine',
      created_at: new Date(Date.now() + 1000).toISOString(),
    });
  }

  saveDatabase(db);
  return attachRelations(newIssue, db);
}

export function addSupportingReport(
  issueId: string,
  citizenName?: string,
  citizenPhone?: string,
  note?: string
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  issue.affected_people += 1;
  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  // Recalculate deterministic priority based on increased affected_people
  const recalc = calculatePriority(
    issue.severity,
    issue.urgency,
    issue.affected_people,
    issue.created_at,
    issue.status
  );
  issue.priority = recalc.level;
  issue.priority_score = recalc.score;
  issue.priority_reasons = recalc.reasons;

  const supportId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.supporting_reports.push({
    id: supportId,
    issue_id: issue.id,
    citizen_name: citizenName || 'Verified Citizen',
    citizen_phone: citizenPhone,
    note: note || 'Confirmed affected by this civic problem.',
    created_at: nowIso,
  });

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: issue.status,
    title: 'Citizen Endorsement ("I Also Face This")',
    description: `Community impact updated: ${issue.affected_people} citizens affected. Priority score adjusted to ${recalc.score} (${recalc.level}).`,
    actor: 'Citizen',
    actor_name: citizenName || 'Community Member',
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function assignDepartment(issueId: string, department: Department, actorName = 'Municipal Dispatcher'): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  issue.department = department;
  if (issue.status === 'Reported' || issue.status === 'AI Analysis') {
    issue.status = 'Assigned';
  }
  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: issue.status,
    title: `Assigned to ${department}`,
    description: `Ticket routed to field engineering unit for inspection and mobilization.`,
    actor: 'Municipal Authority',
    actor_name: actorName,
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function updateIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  note?: string,
  actor: 'Citizen' | 'Municipal Authority' | 'Department Staff' = 'Municipal Authority',
  actorName = 'Operations Officer'
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  issue.status = newStatus;
  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  // Refresh SLA overdue status
  const deadlineTime = new Date(issue.sla_deadline).getTime();
  issue.is_overdue = newStatus !== 'Resolved & Verified' && Date.now() > deadlineTime;

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: newStatus,
    title: `Status changed to ${newStatus}`,
    description: note || `Issue state transitioned to ${newStatus}.`,
    actor,
    actor_name: actorName,
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function addInternalNote(
  issueId: string,
  note: string,
  author = 'Civic Staff'
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: issue.status,
    title: 'Internal Municipal Note Added',
    description: note,
    actor: 'Department Staff',
    actor_name: author,
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function submitResolutionProof(
  issueId: string,
  beforeImage: string,
  afterImage: string,
  resolutionNote: string,
  submittedBy = 'Field Engineer'
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.status = 'Resolution Submitted';
  issue.updated_at = nowIso;

  // Remove existing proof if any
  db.resolution_proofs = db.resolution_proofs.filter(r => r.issue_id !== issue.id);

  db.resolution_proofs.push({
    id: `proof_${Date.now()}`,
    issue_id: issue.id,
    before_image: beforeImage || issue.evidence_url,
    after_image: afterImage,
    resolution_note: resolutionNote,
    submitted_by: submittedBy,
    submitted_at: nowIso,
  });

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: 'Resolution Submitted',
    title: 'Resolution Proof Uploaded',
    description: `Field team documented completion. Awaiting citizen confirmation: "${resolutionNote}"`,
    actor: 'Department Staff',
    actor_name: submittedBy,
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function verifyResolution(
  issueId: string,
  confirmed: boolean,
  rejectionReason?: string,
  citizenName = 'Citizen Reporter'
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  const proof = db.resolution_proofs.find(r => r.issue_id === issue.id);

  if (confirmed) {
    issue.status = 'Resolved & Verified';
    issue.is_overdue = false;
    if (proof) {
      proof.verified_at = nowIso;
    }
    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'Resolved & Verified',
      title: 'Resolution Verified & Accepted by Citizen',
      description: 'The citizen confirmed that public infrastructure has been successfully restored.',
      actor: 'Citizen',
      actor_name: citizenName,
      created_at: nowIso,
    });
  } else {
    issue.status = 'REOPENED';
    if (proof) {
      proof.rejection_reason = rejectionReason || 'Citizen indicated the problem persists.';
    }
    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'REOPENED',
      title: 'Resolution Rejected - Ticket Reopened',
      description: `Citizen noted: "${rejectionReason || 'Work unsatisfactory, issue still exists.'}". Escalated to authority for re-dispatch.`,
      actor: 'Citizen',
      actor_name: citizenName,
      created_at: nowIso,
    });
  }

  saveDatabase(db);
  return attachRelations(issue, db);
}

// -------------------------------------------------------------
// ROLE-BASED AUTHORITY WORKFLOW MUTATIONS
// -------------------------------------------------------------

// 1. Supervisor Assigns Issue to Engineer (Transitions to PENDING_APPROVAL)
export function supervisorAssignIssue(
  issueId: string,
  data: {
    supervisor_id: string;
    supervisor_name: string;
    engineer_id: string;
    engineer_name: string;
    instructions?: string;
    deadline?: string;
  }
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;
  issue.supervisor_id = data.supervisor_id;
  issue.supervisor_name = data.supervisor_name;
  issue.assigned_by = data.supervisor_name;
  issue.engineer_id = data.engineer_id;
  issue.engineer_name = data.engineer_name;
  issue.assignment_instructions = data.instructions || 'Inspect site, repair infrastructure, and submit completion proof.';
  issue.assignment_date = nowIso;
  issue.assignment_status = 'PENDING_APPROVAL';
  issue.admin_approval_status = 'PENDING';
  issue.task_status = 'UNASSIGNED';

  if (data.deadline) {
    issue.sla_deadline = data.deadline;
  }

  db.timeline.push({
    id: `tl_${Date.now()}`,
    issue_id: issue.id,
    status: issue.status,
    title: 'Engineer Assigned · Pending Admin Approval',
    description: `Supervisor ${data.supervisor_name} designated ${data.engineer_name} with instructions: "${issue.assignment_instructions}". Submitted for Central HQ approval.`,
    actor: 'Municipal Authority',
    actor_name: data.supervisor_name,
    created_at: nowIso,
  });

  saveDatabase(db);
  return attachRelations(issue, db);
}

// 2. Central Operations Dispatch (Admin) Approves or Rejects Assignment
export function adminApproveAssignment(
  issueId: string,
  data: {
    approved: boolean;
    rejection_reason?: string;
    admin_name?: string;
  }
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;
  issue.admin_reviewed_by = data.admin_name || 'Central Operations Dispatch';
  issue.admin_reviewed_at = nowIso;

  if (data.approved) {
    issue.assignment_status = 'APPROVED';
    issue.admin_approval_status = 'APPROVED';
    issue.status = 'Assigned';
    issue.task_status = 'ASSIGNED';

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'Assigned',
      title: 'Assignment Approved by Central Operations HQ',
      description: `HQ Dispatch approved assignment for ${issue.engineer_name}. Work order dispatched to engineer task queue.`,
      actor: 'Municipal Authority',
      actor_name: issue.admin_reviewed_by,
      created_at: nowIso,
    });
  } else {
    issue.assignment_status = 'REJECTED';
    issue.admin_approval_status = 'REJECTED';
    issue.admin_rejection_reason = data.rejection_reason || 'Assignment returned for review.';
    issue.task_status = 'UNASSIGNED';

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: issue.status,
      title: 'Assignment Rejected by Central Operations',
      description: `HQ Dispatch rejected assignment. Reason: "${issue.admin_rejection_reason}". Reassigned back to supervisor.`,
      actor: 'Municipal Authority',
      actor_name: issue.admin_reviewed_by,
      created_at: nowIso,
    });
  }

  saveDatabase(db);
  return attachRelations(issue, db);
}

// 3. Engineer Workflow Actions (ACCEPT, START_WORK, ADD_NOTE, SUBMIT_COMPLETION)
export function engineerUpdateTask(
  issueId: string,
  data: {
    action: 'ACCEPT' | 'START_WORK' | 'ADD_NOTE' | 'SUBMIT_COMPLETION';
    engineer_id: string;
    engineer_name: string;
    note?: string;
    before_image?: string;
    after_image?: string;
    resolution_note?: string;
  }
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  if (data.action === 'ACCEPT') {
    issue.task_status = 'ACCEPTED';
    issue.task_accepted_at = nowIso;

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: issue.status,
      title: 'Task Accepted by Field Engineer',
      description: `${data.engineer_name} accepted the work order. Crew preparation underway.`,
      actor: 'Department Staff',
      actor_name: data.engineer_name,
      created_at: nowIso,
    });
  } else if (data.action === 'START_WORK') {
    issue.task_status = 'IN_PROGRESS';
    issue.status = 'In Progress';
    issue.task_started_at = nowIso;

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'In Progress',
      title: 'Field Work Started',
      description: `On-site repair and restoration begun by ${data.engineer_name}. Equipment deployed.`,
      actor: 'Department Staff',
      actor_name: data.engineer_name,
      created_at: nowIso,
    });
  } else if (data.action === 'ADD_NOTE') {
    if (data.note) {
      issue.work_notes = issue.work_notes
        ? `${issue.work_notes}\n[${new Date().toLocaleTimeString()} - ${data.engineer_name}]: ${data.note}`
        : `[${new Date().toLocaleTimeString()} - ${data.engineer_name}]: ${data.note}`;

      db.timeline.push({
        id: `tl_${Date.now()}`,
        issue_id: issue.id,
        status: issue.status,
        title: 'Engineer Work Progress Logged',
        description: `Note from ${data.engineer_name}: "${data.note}"`,
        actor: 'Department Staff',
        actor_name: data.engineer_name,
        created_at: nowIso,
      });
    }
  } else if (data.action === 'SUBMIT_COMPLETION') {
    issue.task_status = 'COMPLETED';
    issue.status = 'Resolution Submitted';
    issue.task_completed_at = nowIso;
    issue.verification_status = 'PENDING';

    const proofIdx = db.resolution_proofs.findIndex(r => r.issue_id === issue.id);
    const proof: ResolutionProof = {
      id: proofIdx >= 0 ? db.resolution_proofs[proofIdx].id : `proof_${Date.now()}`,
      issue_id: issue.id,
      before_image: data.before_image || issue.evidence_url || '',
      after_image: data.after_image || 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f8?auto=format&fit=crop&w=800&q=80',
      resolution_note: data.resolution_note || data.note || 'Work completed according to municipal engineering standards.',
      submitted_by: data.engineer_name,
      submitted_at: nowIso,
    };

    if (proofIdx >= 0) {
      db.resolution_proofs[proofIdx] = proof;
    } else {
      db.resolution_proofs.push(proof);
    }

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'Resolution Submitted',
      title: 'Work Completed · Submitted for Supervisor Verification',
      description: `${data.engineer_name} completed field repairs and uploaded before/after evidence proof. Awaiting supervisor audit.`,
      actor: 'Department Staff',
      actor_name: data.engineer_name,
      created_at: nowIso,
    });
  }

  saveDatabase(db);
  return attachRelations(issue, db);
}

// 4. Supervisor Verifies Completed Work (VERIFY / REOPEN)
export function supervisorVerifyTask(
  issueId: string,
  data: {
    supervisor_id: string;
    supervisor_name: string;
    verified: boolean;
    rejection_note?: string;
  }
): CivicIssue | null {
  const db = loadDatabase();
  const issue = db.issues.find(i => i.id === issueId || i.tracking_id === issueId);
  if (!issue) return null;

  const nowIso = new Date().toISOString();
  issue.updated_at = nowIso;

  if (data.verified) {
    issue.task_status = 'VERIFIED';
    issue.status = 'Resolved & Verified';
    issue.verification_status = 'VERIFIED';
    issue.verified_by = data.supervisor_name;
    issue.verified_at = nowIso;
    issue.is_overdue = false;

    const proof = db.resolution_proofs.find(r => r.issue_id === issue.id);
    if (proof) {
      proof.verified_at = nowIso;
    }

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'Resolved & Verified',
      title: 'Supervisor Verified & Work Accepted',
      description: `Supervisor ${data.supervisor_name} inspected and confirmed quality of work. Ticket marked RESOLVED.`,
      actor: 'Municipal Authority',
      actor_name: data.supervisor_name,
      created_at: nowIso,
    });
  } else {
    issue.task_status = 'REOPENED';
    issue.status = 'REOPENED';
    issue.verification_status = 'REOPENED';

    const proof = db.resolution_proofs.find(r => r.issue_id === issue.id);
    if (proof) {
      proof.rejection_reason = data.rejection_note || 'Quality check failed. Further rectification required.';
    }

    db.timeline.push({
      id: `tl_${Date.now()}`,
      issue_id: issue.id,
      status: 'REOPENED',
      title: 'Supervisor Reopened Task (Rework Required)',
      description: `Supervisor ${data.supervisor_name} noted deficiencies: "${data.rejection_note || 'Rework required'}". Reopened for engineer attention.`,
      actor: 'Municipal Authority',
      actor_name: data.supervisor_name,
      created_at: nowIso,
    });
  }

  saveDatabase(db);
  return attachRelations(issue, db);
}

export function getAnalytics(): AnalyticsSummary {
  const db = loadDatabase();
  refreshIssueSlas(db);

  const total = db.issues.length;
  const resolved = db.issues.filter(i => i.status === 'Resolved & Verified').length;
  const open = total - resolved;
  const criticalHigh = db.issues.filter(i => i.priority === 'CRITICAL' || i.priority === 'HIGH').length;
  const overdue = db.issues.filter(i => i.is_overdue).length;

  // Category counts
  const catMap: Record<string, number> = {};
  db.issues.forEach(i => {
    catMap[i.category] = (catMap[i.category] || 0) + 1;
  });
  const by_category = Object.entries(catMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Status counts
  const statusMap: Record<string, number> = {};
  db.issues.forEach(i => {
    statusMap[i.status] = (statusMap[i.status] || 0) + 1;
  });
  const by_status = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  // Priority counts
  const priorityColors: Record<PriorityLevel, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#3b82f6',
  };
  const prioMap: Record<PriorityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  db.issues.forEach(i => {
    prioMap[i.priority] = (prioMap[i.priority] || 0) + 1;
  });
  const by_priority = (Object.keys(prioMap) as PriorityLevel[]).map(priority => ({
    priority,
    count: prioMap[priority],
    color: priorityColors[priority],
  }));

  // Department counts
  const deptMap: Record<string, number> = {};
  db.issues.forEach(i => {
    deptMap[i.department] = (deptMap[i.department] || 0) + 1;
  });
  const by_department = Object.entries(deptMap)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  // Calculate average resolution hours for resolved issues
  const resolvedIssues = db.issues.filter(i => i.status === 'Resolved & Verified');
  let avgHours = 28;
  if (resolvedIssues.length > 0) {
    const totalHours = resolvedIssues.reduce((acc, issue) => {
      const created = new Date(issue.created_at).getTime();
      const updated = new Date(issue.updated_at).getTime();
      return acc + Math.max(1, (updated - created) / (1000 * 60 * 60));
    }, 0);
    avgHours = Math.round(totalHours / resolvedIssues.length);
  }

  // Hotspot analysis based on geographical proximity clusters
  const hotspots = generateHotspots(db.issues);

  return {
    total_issues: total,
    open_issues: open,
    critical_high_issues: criticalHigh,
    overdue_issues: overdue,
    resolved_issues: resolved,
    average_resolution_hours: avgHours,
    by_category,
    by_status,
    by_priority,
    by_department,
    hotspots,
  };
}

function generateHotspots(issues: CivicIssue[]) {
  const clusters = [
    {
      area: 'Central Commercial District / Metro Station',
      lat: 12.9716,
      lng: 77.5946,
      radiusKm: 1.2,
    },
    {
      area: 'North Ring Road & Industrial Corridor',
      lat: 12.985,
      lng: 77.608,
      radiusKm: 1.5,
    },
    {
      area: 'Tech Corridor & IT Park Sector',
      lat: 12.935,
      lng: 77.624,
      radiusKm: 1.5,
    },
    {
      area: 'Old Suburb & Market Ward',
      lat: 12.955,
      lng: 77.575,
      radiusKm: 1.2,
    },
  ];

  return clusters.map(cluster => {
    const matchingIssues = issues.filter(
      i => calculateDistanceKm(i.latitude, i.longitude, cluster.lat, cluster.lng) <= cluster.radiusKm
    );
    const critical = matchingIssues.filter(i => i.priority === 'CRITICAL' || i.priority === 'HIGH').length;

    const catCounts: Record<string, number> = {};
    matchingIssues.forEach(i => {
      catCounts[i.category] = (catCounts[i.category] || 0) + 1;
    });
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Road & Drainage';

    return {
      area: cluster.area,
      latitude: cluster.lat,
      longitude: cluster.lng,
      issue_count: matchingIssues.length,
      critical_count: critical,
      top_category: topCategory,
    };
  }).filter(h => h.issue_count > 0);
}

export function resetDemoData() {
  const seed = getInitialSeed();
  saveDatabase(seed);
  return getAllIssues();
}

function getInitialSeed(): DatabaseSchema {
  const now = Date.now();
  const H = 60 * 60 * 1000;
  const D = 24 * H;

  const issues: CivicIssue[] = [
    {
      id: 'iss_seed_1',
      tracking_id: 'CIV-2026-00101',
      category: 'Pothole',
      title: 'Dangerous Pothole on 5th Main Road (Near Metro Pillar 142)',
      description: 'Deep pothole approximately 2 feet wide and 8 inches deep right on the active lane. Two two-wheeler skids observed during morning peak hours.',
      evidence_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9721,
      longitude: 77.5952,
      address: '5th Main Road, Metro Station Exit 2, Ward 84',
      landmark: 'Near Metro Pillar 142',
      severity: 'HIGH',
      urgency: 'HIGH',
      priority: 'CRITICAL',
      priority_score: 82,
      priority_reasons: [
        'HIGH severity assessment (+30 pts)',
        'HIGH urgency requirement (+20 pts)',
        '6 community members affected (+18 pts)',
        'Open for 1 day (32h) (+14 pts)',
      ],
      affected_people: 6,
      department: 'Roads & Infrastructure',
      status: 'In Progress',
      task_status: 'IN_PROGRESS',
      assignment_status: 'APPROVED',
      admin_approval_status: 'APPROVED',
      admin_reviewed_by: 'Central Operations Dispatch',
      supervisor_id: 'user_auth_2',
      supervisor_name: 'Supervisor J. Khan',
      assigned_by: 'Supervisor J. Khan',
      engineer_id: 'user_auth_1',
      engineer_name: 'Engineer R. Murthy',
      assignment_instructions: 'Patch crater with industrial hot-mix asphalt and compact with 3-ton roller.',
      assignment_date: new Date(now - 28 * H).toISOString(),
      task_accepted_at: new Date(now - 26 * H).toISOString(),
      task_started_at: new Date(now - 4 * H).toISOString(),
      work_notes: 'Cold-mix applied temporarily; heavy compaction team on site.',
      sla_hours: 12,
      sla_deadline: new Date(now - 10 * H).toISOString(), // Overdue by 10 hours for testing!
      is_overdue: true,
      contact_name: 'Vikram Sharma',
      contact_email: 'vikram.s@example.com',
      is_demo: true,
      ai_summary: 'Severe road pothole creating active skid hazards for commuter two-wheelers near transit hub.',
      ai_reasoning: 'High risk of vehicular collision and bodily injury due to crater depth in a high-speed arterial roadway.',
      created_at: new Date(now - 32 * H).toISOString(),
      updated_at: new Date(now - 4 * H).toISOString(),
    },
    {
      id: 'iss_seed_2',
      tracking_id: 'CIV-2026-00102',
      category: 'Garbage / Waste',
      title: 'Overflowing Community Waste Dumpster at Central Market',
      description: 'Commercial waste and vegetable organic refuse piled up onto the public footpath for 3 consecutive days. Strong foul odor and stray animals obstructing pedestrians.',
      evidence_url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9698,
      longitude: 77.5935,
      address: 'Commercial Street Junction, Ward 85',
      landmark: 'Opposite City Supermarket',
      severity: 'MEDIUM',
      urgency: 'HIGH',
      priority: 'HIGH',
      priority_score: 64,
      priority_reasons: [
        'MEDIUM severity assessment (+20 pts)',
        'HIGH urgency requirement (+20 pts)',
        '4 community members affected (+12 pts)',
        'Open for 1 day (28h) (+12 pts)',
      ],
      affected_people: 4,
      department: 'Solid Waste Management',
      status: 'Resolution Submitted',
      task_status: 'COMPLETED',
      assignment_status: 'APPROVED',
      admin_approval_status: 'APPROVED',
      admin_reviewed_by: 'Central Operations Dispatch',
      supervisor_id: 'user_auth_2',
      supervisor_name: 'Supervisor J. Khan',
      assigned_by: 'Supervisor J. Khan',
      engineer_id: 'user_auth_1',
      engineer_name: 'Engineer R. Murthy',
      verification_status: 'PENDING',
      assignment_instructions: 'Clear overflowing waste dumpster and sanitize area.',
      task_completed_at: new Date(now - 2 * H).toISOString(),
      sla_hours: 24,
      sla_deadline: new Date(now + 4 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Anita Deshmukh',
      contact_phone: '+91 98450 12345',
      is_demo: true,
      ai_summary: 'Solid waste accumulation blocking commercial pedestrian corridor and causing sanitation concern.',
      ai_reasoning: 'Biohazard risk from decomposing organic matter in high-footfall marketplace.',
      created_at: new Date(now - 28 * H).toISOString(),
      updated_at: new Date(now - 2 * H).toISOString(),
    },
    {
      id: 'iss_seed_3',
      tracking_id: 'CIV-2026-00103',
      category: 'Waterlogging',
      title: 'Severe Waterlogging under Railway Underpass',
      description: 'Stormwater accumulation exceeding 1.5 feet under the railway bridge following evening showers. Small cars and autos unable to navigate.',
      evidence_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9845,
      longitude: 77.6092,
      address: 'North Link Underpass, Sector 3',
      landmark: 'Railway Bridge 11A',
      severity: 'CRITICAL',
      urgency: 'CRITICAL',
      priority: 'CRITICAL',
      priority_score: 95,
      priority_reasons: [
        'CRITICAL severity assessment (+40 pts)',
        'CRITICAL urgency requirement (+30 pts)',
        '8 community members affected (+24 pts)',
        'Open for 4 hours (+0 pts)',
      ],
      affected_people: 8,
      department: 'Stormwater Drainage',
      status: 'Assigned',
      sla_hours: 12,
      sla_deadline: new Date(now + 8 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Rahul Sen',
      contact_email: 'rahul.sen@example.com',
      is_demo: true,
      ai_summary: 'Severe road sub-grade submergence cutting off vehicular connection beneath railway tracks.',
      ai_reasoning: 'Life safety danger of vehicle stranding, engine flooding, and sudden depth drowning hazard.',
      created_at: new Date(now - 4 * H).toISOString(),
      updated_at: new Date(now - 1 * H).toISOString(),
    },
    {
      id: 'iss_seed_4',
      tracking_id: 'CIV-2026-00104',
      category: 'Broken Streetlight',
      title: 'Four Successive Non-functional Streetlights on Park Avenue',
      description: 'Stretch of 200 meters completely pitch dark after sunset. High pedestrian volume of evening walkers and students from the nearby girls college.',
      evidence_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9362,
      longitude: 77.6251,
      address: 'Park Avenue 4th Cross, IT Corridor',
      landmark: 'Between Gate 1 and Gate 3 of City Park',
      severity: 'MEDIUM',
      urgency: 'MEDIUM',
      priority: 'MEDIUM',
      priority_score: 46,
      priority_reasons: [
        'MEDIUM severity assessment (+20 pts)',
        'MEDIUM urgency requirement (+10 pts)',
        '3 community members affected (+9 pts)',
        'Open for 18 hours (+6 pts)',
      ],
      affected_people: 3,
      department: 'Electrical & Street Lighting',
      status: 'Assigned',
      sla_hours: 48,
      sla_deadline: new Date(now + 30 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Divya Nair',
      is_demo: true,
      ai_summary: 'Dark street lighting corridor posing safety and security vulnerability.',
      ai_reasoning: 'Diminished nighttime public safety in dense residential and college corridor.',
      created_at: new Date(now - 18 * H).toISOString(),
      updated_at: new Date(now - 6 * H).toISOString(),
    },
    {
      id: 'iss_seed_5',
      tracking_id: 'CIV-2026-00105',
      category: 'Blocked Drain',
      title: 'Clogged Stormwater Drain Cover with Debris on 12th Cross',
      description: 'Silt, plastic bottles, and fallen branches have completely choked the drain inlet grate. Slight rain immediately causes overflow onto property compounds.',
      evidence_url: 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9567,
      longitude: 77.5762,
      address: '12th Cross Road, Suburb Ward 4',
      landmark: 'Next to Primary Health Centre',
      severity: 'MEDIUM',
      urgency: 'LOW',
      priority: 'MEDIUM',
      priority_score: 38,
      priority_reasons: [
        'MEDIUM severity assessment (+20 pts)',
        'LOW urgency requirement (+5 pts)',
        '2 community members affected (+6 pts)',
        'Open for 1 day (36h) (+6 pts)',
      ],
      affected_people: 2,
      department: 'Roads & Infrastructure',
      status: 'Assigned',
      task_status: 'ASSIGNED',
      assignment_status: 'APPROVED',
      admin_approval_status: 'APPROVED',
      admin_reviewed_by: 'Central Operations Dispatch',
      supervisor_id: 'user_auth_2',
      supervisor_name: 'Supervisor J. Khan',
      assigned_by: 'Supervisor J. Khan',
      engineer_id: 'user_auth_1',
      engineer_name: 'Engineer R. Murthy',
      assignment_instructions: 'Inspect drainage grate, remove solid silt blockage, and restore rainwater inflow.',
      assignment_date: new Date(now - 6 * H).toISOString(),
      sla_hours: 48,
      sla_deadline: new Date(now + 12 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Karthik Pillai',
      is_demo: true,
      ai_summary: 'Inlet grate blockage causing backwater pooling near healthcare facility.',
      ai_reasoning: 'Moderate localized flooding risk without immediate structural threat.',
      created_at: new Date(now - 36 * H).toISOString(),
      updated_at: new Date(now - 6 * H).toISOString(),
    },
    {
      id: 'iss_seed_6',
      tracking_id: 'CIV-2026-00106',
      category: 'Fallen Tree',
      title: 'Large Banyan Branch Snapped and Obstructing Half the Lane',
      description: 'Heavy tree bough fell onto the asphalt during yesterday winds. Telecommunication wires tangled underneath.',
      evidence_url: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9348,
      longitude: 77.6215,
      address: '7th Block Boulevard, Tech Zone',
      landmark: 'Near Innovation Hub Circle',
      severity: 'HIGH',
      urgency: 'HIGH',
      priority: 'HIGH',
      priority_score: 72,
      priority_reasons: [
        'HIGH severity assessment (+30 pts)',
        'HIGH urgency requirement (+20 pts)',
        '4 community members affected (+12 pts)',
        'Resolved on schedule',
      ],
      affected_people: 4,
      department: 'Horticulture & Trees',
      status: 'Resolved & Verified',
      task_status: 'VERIFIED',
      verification_status: 'VERIFIED',
      verified_by: 'Central Operations Dispatch',
      sla_hours: 24,
      sla_deadline: new Date(now - 4 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Suresh Kumar',
      is_demo: true,
      ai_summary: 'Major tree obstruction cleared and timber transported to municipal nursery.',
      ai_reasoning: 'Rapid clearance executed to restore traffic circulation and prevent wire damage.',
      created_at: new Date(now - 48 * H).toISOString(),
      updated_at: new Date(now - 8 * H).toISOString(),
    },
    {
      id: 'iss_seed_7',
      tracking_id: 'CIV-2026-00107',
      category: 'Garbage / Waste',
      title: 'Overloaded Secondary Dump Site near Bus Terminal',
      description: 'Secondary collection container filled past capacity. Overflowing trash bags scattering onto traffic lane during morning commute.',
      evidence_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9735,
      longitude: 77.5985,
      address: 'Central Terminal Road, Ward 85',
      landmark: 'Bus Bay Platform 4',
      severity: 'HIGH',
      urgency: 'HIGH',
      priority: 'HIGH',
      priority_score: 70,
      priority_reasons: [
        'HIGH severity bio-waste (+30 pts)',
        'HIGH urgency commute route (+20 pts)',
        '5 community members reported (+15 pts)',
      ],
      affected_people: 5,
      department: 'Solid Waste Management',
      status: 'Reported',
      assignment_status: 'PENDING_APPROVAL',
      admin_approval_status: 'PENDING',
      task_status: 'UNASSIGNED',
      supervisor_id: 'user_auth_2',
      supervisor_name: 'Supervisor J. Khan',
      assigned_by: 'Supervisor J. Khan',
      engineer_id: 'user_auth_1',
      engineer_name: 'Engineer R. Murthy',
      assignment_instructions: 'Deploy compacting tipper truck and spray liquid sanitizing solution.',
      assignment_date: new Date(now - 1 * H).toISOString(),
      sla_hours: 12,
      sla_deadline: new Date(now + 11 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Mahesh Reddy',
      is_demo: true,
      ai_summary: 'Commercial hub waste overflow requiring heavy equipment clearance.',
      created_at: new Date(now - 2 * H).toISOString(),
      updated_at: new Date(now - 1 * H).toISOString(),
    },
    {
      id: 'iss_seed_8',
      tracking_id: 'CIV-2026-00108',
      category: 'Garbage / Waste',
      title: 'Illegal Bulk Vegetable Waste Dumping behind City Market Arcade',
      description: 'Rotting vegetable matter and wooden crates dumped along the service alley. Choking storm drains and creating rat infestation.',
      evidence_url: 'https://images.unsplash.com/photo-1582408921715-18e7806365c1?auto=format&fit=crop&w=800&q=80',
      latitude: 12.9682,
      longitude: 77.5918,
      address: 'Market Service Alley 2, Ward 85',
      landmark: 'Rear Exit of Wholesale Market',
      severity: 'HIGH',
      urgency: 'HIGH',
      priority: 'HIGH',
      priority_score: 74,
      priority_reasons: [
        'HIGH severity organic hazard (+30 pts)',
        'HIGH urgency pest infestation (+20 pts)',
        '7 community members reported (+21 pts)',
      ],
      affected_people: 7,
      department: 'Solid Waste Management',
      status: 'Reported',
      assignment_status: 'UNASSIGNED',
      admin_approval_status: 'NONE',
      task_status: 'UNASSIGNED',
      sla_hours: 24,
      sla_deadline: new Date(now + 20 * H).toISOString(),
      is_overdue: false,
      contact_name: 'Subramani K.',
      is_demo: true,
      ai_summary: 'Market alley biohazard dump requires immediate mechanical pickup.',
      created_at: new Date(now - 4 * H).toISOString(),
      updated_at: new Date(now - 4 * H).toISOString(),
    },
  ];

  const timeline: TimelineEvent[] = [
    // Seed 1 timeline
    {
      id: 'tl_s1_1',
      issue_id: 'iss_seed_1',
      status: 'Reported',
      title: 'Issue Submitted by Citizen',
      description: 'Report filed with initial priority HIGH (12 hour target SLA).',
      actor: 'Citizen',
      actor_name: 'Vikram Sharma',
      created_at: new Date(now - 32 * H).toISOString(),
    },
    {
      id: 'tl_s1_2',
      issue_id: 'iss_seed_1',
      status: 'AI Analysis',
      title: 'Automated AI Triage & Classification',
      description: 'Gemini recognized high collision risk for two-wheelers. Elevated priority to CRITICAL.',
      actor: 'AI System',
      actor_name: 'TechCity AI Engine',
      created_at: new Date(now - 32 * H + 30000).toISOString(),
    },
    {
      id: 'tl_s1_3',
      issue_id: 'iss_seed_1',
      status: 'Assigned',
      title: 'Assigned to Roads & Infrastructure',
      description: 'Forwarded to Central Zone Rapid Asphalt Repair Unit.',
      actor: 'Municipal Authority',
      actor_name: 'Control Room Dispatch',
      created_at: new Date(now - 28 * H).toISOString(),
    },
    {
      id: 'tl_s1_4',
      issue_id: 'iss_seed_1',
      status: 'In Progress',
      title: 'Crew Dispatched to Site',
      description: 'Cold-mix asphalt truck dispatched. Safety barricades placed.',
      actor: 'Department Staff',
      actor_name: 'Engineer R. Murthy',
      created_at: new Date(now - 4 * H).toISOString(),
    },

    // Seed 2 timeline (Resolution Submitted - Ready for citizen verification demo!)
    {
      id: 'tl_s2_1',
      issue_id: 'iss_seed_2',
      status: 'Reported',
      title: 'Issue Submitted by Citizen',
      description: 'Trash pile reported outside market gate.',
      actor: 'Citizen',
      actor_name: 'Anita Deshmukh',
      created_at: new Date(now - 28 * H).toISOString(),
    },
    {
      id: 'tl_s2_2',
      issue_id: 'iss_seed_2',
      status: 'Assigned',
      title: 'Assigned to Solid Waste Management',
      description: 'Designated to Ward 85 Sanitation Supervisor.',
      actor: 'Municipal Authority',
      actor_name: 'Operations Dispatch',
      created_at: new Date(now - 24 * H).toISOString(),
    },
    {
      id: 'tl_s2_3',
      issue_id: 'iss_seed_2',
      status: 'Resolution Submitted',
      title: 'Resolution Proof Uploaded',
      description: 'Solid waste fully cleared via compactor truck. Bleaching powder sprayed. Awaiting citizen confirmation.',
      actor: 'Department Staff',
      actor_name: 'Supervisor J. Khan',
      created_at: new Date(now - 2 * H).toISOString(),
    },

    // Seed 6 timeline (Resolved & Verified)
    {
      id: 'tl_s6_1',
      issue_id: 'iss_seed_6',
      status: 'Reported',
      title: 'Issue Submitted by Citizen',
      description: 'Fallen branch blocking road lane.',
      actor: 'Citizen',
      actor_name: 'Suresh Kumar',
      created_at: new Date(now - 48 * H).toISOString(),
    },
    {
      id: 'tl_s6_2',
      issue_id: 'iss_seed_6',
      status: 'Resolution Submitted',
      title: 'Tree Cleared by Horticulture Team',
      description: 'Chainsaw crew cut and moved wood.',
      actor: 'Department Staff',
      actor_name: 'Arborist Unit',
      created_at: new Date(now - 12 * H).toISOString(),
    },
    {
      id: 'tl_s6_3',
      issue_id: 'iss_seed_6',
      status: 'Resolved & Verified',
      title: 'Resolution Verified & Accepted by Citizen',
      description: 'Citizen verified lane is clear and safe for passage.',
      actor: 'Citizen',
      actor_name: 'Suresh Kumar',
      created_at: new Date(now - 8 * H).toISOString(),
    },
  ];

  const supporting_reports: SupportingReport[] = [
    {
      id: 'sup_1',
      issue_id: 'iss_seed_1',
      citizen_name: 'Mohan Lal',
      citizen_phone: '+91 97312 00112',
      note: 'My scooter wheel nearly buckled here this morning.',
      created_at: new Date(now - 20 * H).toISOString(),
    },
    {
      id: 'sup_2',
      issue_id: 'iss_seed_1',
      citizen_name: 'Sneha Patel',
      note: 'I also take this road daily, very dangerous in the dark.',
      created_at: new Date(now - 14 * H).toISOString(),
    },
    {
      id: 'sup_3',
      issue_id: 'iss_seed_2',
      citizen_name: 'Rajiv Mehra',
      note: 'Shopkeeper next door, odor is unbearable for customers.',
      created_at: new Date(now - 22 * H).toISOString(),
    },
  ];

  const resolution_proofs: ResolutionProof[] = [
    {
      id: 'proof_seed_2',
      issue_id: 'iss_seed_2',
      before_image: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
      after_image: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
      resolution_note: 'Sanitation squad completed complete garbage evacuation using hydraulic tipper vehicle. Footpath swept clean and disinfected with lime powder.',
      submitted_by: 'Supervisor J. Khan (Ward 85 Sanitation)',
      submitted_at: new Date(now - 2 * H).toISOString(),
    },
    {
      id: 'proof_seed_6',
      issue_id: 'iss_seed_6',
      before_image: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=800&q=80',
      after_image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      resolution_note: 'Branch chopped, timber logged, and carriageway thoroughly swept.',
      submitted_by: 'Arborist Field Crew #4',
      submitted_at: new Date(now - 12 * H).toISOString(),
      verified_at: new Date(now - 8 * H).toISOString(),
    },
  ];

  return {
    issues,
    timeline,
    supporting_reports,
    resolution_proofs,
    last_ticket_number: 108,
  };
}
