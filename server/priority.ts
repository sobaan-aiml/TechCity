import { PriorityBreakdown, PriorityLevel, IssueStatus } from '../src/types/civic.js';

export const SLA_HOURS: Record<PriorityLevel, number> = {
  CRITICAL: 12,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

export const SEVERITY_WEIGHTS: Record<PriorityLevel, number> = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 20,
  LOW: 10,
};

export const URGENCY_WEIGHTS: Record<PriorityLevel, number> = {
  CRITICAL: 30,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 5,
};

/**
 * Calculates deterministic priority score, reasons, and SLA deadline.
 */
export function calculatePriority(
  severity: PriorityLevel,
  urgency: PriorityLevel,
  affectedPeople: number,
  createdAtIso: string,
  currentStatus: IssueStatus = 'Reported'
): PriorityBreakdown {
  const reasons: string[] = [];

  // 1. Severity points (10 - 40)
  const sevScore = SEVERITY_WEIGHTS[severity] || 20;
  reasons.push(`${severity} severity assessment (+${sevScore} pts)`);

  // 2. Urgency points (5 - 30)
  const urgScore = URGENCY_WEIGHTS[urgency] || 10;
  reasons.push(`${urgency} urgency requirement (+${urgScore} pts)`);

  // 3. Affected people points (+3 per person beyond 1, capped at 30 pts)
  const safeAffected = Math.max(1, affectedPeople || 1);
  const peopleScore = Math.min(30, Math.floor(safeAffected * 3));
  if (safeAffected > 1) {
    reasons.push(`${safeAffected} community members affected (+${peopleScore} pts)`);
  } else {
    reasons.push(`1 citizen initially reported (+${peopleScore} pts)`);
  }

  // 4. Age points (+2 pts per 12 hours open, capped at 20 pts)
  const createdTime = new Date(createdAtIso).getTime();
  const now = Date.now();
  const hoursOpen = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60)));
  const ageIntervals = Math.floor(hoursOpen / 12);
  const ageScore = Math.min(20, ageIntervals * 2);
  if (hoursOpen >= 24) {
    const daysOpen = Math.floor(hoursOpen / 24);
    reasons.push(`Open for ${daysOpen} day${daysOpen > 1 ? 's' : ''} (${hoursOpen}h) (+${ageScore} pts)`);
  } else if (hoursOpen >= 6) {
    reasons.push(`Open for ${hoursOpen} hours (+${ageScore} pts)`);
  }

  const totalScore = sevScore + urgScore + peopleScore + ageScore;

  // Level classification based on score thresholds
  let level: PriorityLevel;
  if (totalScore >= 75) {
    level = 'CRITICAL';
  } else if (totalScore >= 50) {
    level = 'HIGH';
  } else if (totalScore >= 30) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  // SLA calculation
  const slaHours = SLA_HOURS[level];
  const slaDeadlineDate = new Date(createdTime + slaHours * 60 * 60 * 1000);
  const slaDeadline = slaDeadlineDate.toISOString();

  const isResolved = currentStatus === 'Resolved & Verified';
  const isOverdue = !isResolved && now > slaDeadlineDate.getTime();
  const hoursRemainingOrOverdue = Math.round(
    Math.abs(now - slaDeadlineDate.getTime()) / (1000 * 60 * 60)
  );

  return {
    score: totalScore,
    level,
    reasons,
    sla_hours: slaHours,
    sla_deadline: slaDeadline,
    is_overdue: isOverdue,
    hours_remaining_or_overdue: hoursRemainingOrOverdue,
  };
}
