import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { CivicIssue, IssueStatus } from '../types/civic';
import { safeFetchJson } from '../utils/api';
import {
  formatDate,
  formatRelativeTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
} from '../utils/helpers';

interface TrackIssueViewProps {
  initialTrackingId?: string;
  onNavigateReport?: () => void;
}

const TIMELINE_STEPS: { status: IssueStatus; label: string; desc: string }[] = [
  { status: 'Reported', label: 'Reported', desc: 'Ticket registered by citizen' },
  { status: 'AI Analysis', label: 'AI Analysis', desc: 'Automated triage & scoring' },
  { status: 'Assigned', label: 'Assigned', desc: 'Routed to municipal department' },
  { status: 'In Progress', label: 'In Progress', desc: 'Field crew mobilized' },
  { status: 'Resolution Submitted', label: 'Resolution Submitted', desc: 'Field proof uploaded' },
  { status: 'User Verification', label: 'User Verification', desc: 'Citizen inspects completed work' },
  { status: 'Resolved & Verified', label: 'Resolved & Verified', desc: 'Problem verified closed' },
];

export const TrackIssueView: React.FC<TrackIssueViewProps> = ({
  initialTrackingId = '',
  onNavigateReport,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialTrackingId || 'CIV-2026-00102');
  const [issue, setIssue] = useState<CivicIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Expanded explanations
  const [showPriorityDetails, setShowPriorityDetails] = useState(false);

  // "Me too" action state
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorseName, setEndorseName] = useState('');
  const [endorseNote, setEndorseNote] = useState('');

  // Citizen verification modal / action state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Quick Demo Chips
  const SAMPLE_TRACKING_IDS = [
    { id: 'CIV-2026-00102', label: 'Waste (Resolution Submitted - Ready to Verify!)', badge: 'Verification Ready' },
    { id: 'CIV-2026-00101', label: 'Pothole (In Progress - Overdue SLA)', badge: 'OVERDUE' },
    { id: 'CIV-2026-00103', label: 'Waterlogging (Assigned - Critical)', badge: 'Critical' },
    { id: 'CIV-2026-00106', label: 'Fallen Tree (Resolved & Verified)', badge: 'Resolved' },
  ];

  const fetchIssue = async (trackingId: string) => {
    if (!trackingId || !trackingId.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setVerificationFeedback(null);

    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${encodeURIComponent(trackingId.trim())}`);
      if (res.success && res.data?.issue) {
        setIssue(res.data.issue);
      } else {
        setIssue(null);
        setErrorMessage(res.error || `No civic report found for "${trackingId}".`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch issue details. Please check connection.');
      setIssue(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingId) {
      setSearchQuery(initialTrackingId);
      fetchIssue(initialTrackingId);
    } else {
      fetchIssue('CIV-2026-00102');
    }
  }, [initialTrackingId]);

  // Handle "I Also Face This"
  const handleMeToo = async () => {
    if (!issue) return;
    try {
      setIsEndorsing(true);
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${issue.id}/me-too`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_name: endorseName || 'Concerned Citizen',
          note: endorseNote || 'Confirmed facing this problem in my neighborhood.',
        }),
      });
      if (res.success && res.data?.issue) {
        setIssue(res.data.issue);
        setShowEndorseModal(false);
        setEndorseNote('');
      } else {
        alert(res.error || 'Failed to record support');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setIsEndorsing(false);
    }
  };

  // Handle Citizen Resolution Verification (Confirm or Reject)
  const handleVerifyResolution = async (confirmed: boolean, reason?: string) => {
    if (!issue) return;
    setIsVerifying(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue; message: string }>(`/api/issues/${issue.id}/verify-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed,
          rejection_reason: reason,
          citizen_name: issue.contact_name || 'Resident Citizen',
        }),
      });
      if (res.success && res.data?.issue) {
        setIssue(res.data.issue);
        setShowReopenModal(false);
        setVerificationFeedback(res.data.message || 'Verification recorded successfully!');
      } else {
        alert(res.error || 'Failed to submit verification');
      }
    } catch (err: any) {
      alert(err.message || 'Network error submitting verification');
    } finally {
      setIsVerifying(false);
    }
  };

  // Calculate timeline progress index
  const getTimelineStepIndex = (status: IssueStatus): number => {
    switch (status) {
      case 'Reported':
        return 0;
      case 'AI Analysis':
        return 1;
      case 'Assigned':
        return 2;
      case 'In Progress':
        return 3;
      case 'Resolution Submitted':
        return 4;
      case 'User Verification':
        return 5;
      case 'Resolved & Verified':
        return 6;
      case 'REOPENED':
        return 3; // loops back to In Progress
      default:
        return 0;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Search Bar Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Track Civic Issue Progress
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Enter your unique Tracking ID to view real-time field status, SLA compliance, AI analysis, and verify photo proof when work completes.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchIssue(searchQuery);
          }}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. CIV-2026-00102"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center space-x-2 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Track Issue</span>
          </button>
        </form>

        {/* Quick Demo Chips */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">
            Test with Demo Reports:
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TRACKING_IDS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setSearchQuery(sample.id);
                  fetchIssue(sample.id);
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center space-x-1.5 ${
                  searchQuery === sample.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="font-mono">{sample.id}</span>
                <span className="text-slate-400">·</span>
                <span className="truncate max-w-[180px]">{sample.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error or Empty state */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800 mb-8">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="font-bold text-base">Tracking ID Not Found</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{errorMessage}</p>
          {onNavigateReport && (
            <button
              onClick={onNavigateReport}
              className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors"
            >
              Report a New Issue
            </button>
          )}
        </div>
      )}

      {/* Main Issue Details & Timeline */}
      {issue && (
        <div className="space-y-6">
          {/* Top Banner with Tracking ID, Status & SLA Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xl sm:text-2xl font-black text-blue-700 tracking-tight">
                    {issue.tracking_id}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(
                      issue.status
                    )}`}
                  >
                    {issue.status}
                  </span>
                  {issue.is_overdue && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
                      <Flame className="w-3.5 h-3.5" />
                      <span>OVERDUE SLA</span>
                    </span>
                  )}
                  {issue.is_demo && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                      Sample Demo
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{issue.title}</h2>
                <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{issue.address}</span>
                  {issue.landmark && <span>({issue.landmark})</span>}
                </p>
              </div>

              {/* Priority & Community Endorsement Counter */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-right">
                  <div className="text-[11px] text-slate-500 font-medium">Priority Rating</div>
                  <div className="flex items-center justify-end space-x-1 mt-0.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority} ({issue.priority_score} pts)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPriorityDetails(!showPriorityDetails)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="Why this priority?"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-right">
                  <div className="text-[11px] text-blue-700 font-medium">Affected Citizens</div>
                  <div className="flex items-center justify-end space-x-2 mt-0.5">
                    <span className="font-bold text-base text-blue-900">
                      {issue.affected_people}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEndorseModal(true)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center space-x-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>I Also Face This</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable Priority Explanation Box */}
            {showPriorityDetails && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800 mb-2">
                  <span>Transparent Priority Score Calculation</span>
                  <button
                    onClick={() => setShowPriorityDetails(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-600 mb-2">
                  TechCity uses deterministic public works logic combining severity, urgency, community reports, and age:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 font-medium">
                  {issue.priority_reasons?.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-slate-500">
                  <span>SLA target window: {issue.sla_hours} hours</span>
                  <span>Target Deadline: {formatDate(issue.sla_deadline)}</span>
                </div>
              </div>
            )}

            {/* Quick Meta Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
              <div>
                <span className="text-slate-500">Department:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{issue.department}</p>
              </div>
              <div>
                <span className="text-slate-500">Reported On:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{formatDate(issue.created_at)}</p>
              </div>
              <div>
                <span className="text-slate-500">SLA Status:</span>
                <p
                  className={`font-semibold mt-0.5 ${
                    issue.is_overdue
                      ? 'text-red-600 font-bold'
                      : issue.status === 'Resolved & Verified'
                      ? 'text-emerald-600 font-bold'
                      : 'text-slate-800'
                  }`}
                >
                  {issue.status === 'Resolved & Verified'
                    ? 'Resolved within SLA'
                    : issue.is_overdue
                    ? 'OVERDUE'
                    : `On Track (Target ${issue.sla_hours}h)`}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Last Updated:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{formatRelativeTime(issue.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* CITIZEN RESOLUTION VERIFICATION BOX (PROMPT REQUIREMENT) */}
          {issue.status === 'Resolution Submitted' && issue.resolution_proof && (
            <div className="rounded-2xl border-2 border-cyan-400 bg-cyan-50/70 p-6 shadow-sm">
              <div className="flex items-center space-x-2 text-cyan-900 font-bold text-lg mb-2">
                <CheckCircle2 className="w-6 h-6 text-cyan-600" />
                <span>Field Work Completed - Awaiting Your Confirmation</span>
              </div>
              <p className="text-xs text-cyan-800 mb-5">
                The municipal department has submitted photographic evidence of resolution. Please inspect the before and after comparison below and confirm whether public infrastructure has been restored.
              </p>

              {/* Side-by-side Before & After Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                    <span>BEFORE REPAIR</span>
                    <span className="text-[10px] text-slate-500">Initial Evidence</span>
                  </div>
                  <div className="h-56 bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={issue.resolution_proof.before_image || issue.evidence_url}
                      alt="Before resolution"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-emerald-300 overflow-hidden shadow-2xs">
                  <div className="bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900 flex items-center justify-between border-b border-emerald-200">
                    <span>AFTER REPAIR</span>
                    <span className="text-[10px] text-emerald-700">Official Field Resolution Proof</span>
                  </div>
                  <div className="h-56 bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={issue.resolution_proof.after_image}
                      alt="After resolution"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Resolution Note */}
              <div className="bg-white rounded-xl border border-cyan-200 p-4 mb-5 text-xs text-slate-800">
                <div className="font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>Field Engineer Note:</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Submitted by {issue.resolution_proof.submitted_by} ({formatRelativeTime(issue.resolution_proof.submitted_at)})
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed italic">
                  "{issue.resolution_proof.resolution_note}"
                </p>
              </div>

              {/* Feedback Alert if just acted */}
              {verificationFeedback && (
                <div className="mb-4 p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-xl text-center">
                  {verificationFeedback}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(true)}
                  disabled={isVerifying}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs shadow-2xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <ThumbsDown className="w-4 h-4 text-rose-600" />
                  <span>Issue Not Resolved (Reopen)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyResolution(true)}
                  disabled={isVerifying}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-4 h-4" />
                  )}
                  <span>Confirm Resolution (Verify & Close)</span>
                </button>
              </div>
            </div>
          )}

          {/* If already Resolved & Verified */}
          {issue.status === 'Resolved & Verified' && issue.resolution_proof && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-base mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verified Resolution Completed</span>
              </div>
              <p className="text-xs text-emerald-800 mb-4">
                This issue was inspected and verified closed by the community. Thank you for making TechCity cleaner and safer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="text-[11px] font-bold bg-slate-100 px-3 py-1 text-slate-700">Before</div>
                  <img
                    src={issue.resolution_proof.before_image || issue.evidence_url}
                    alt="Before"
                    className="w-full h-44 object-cover"
                  />
                </div>
                <div className="rounded-xl overflow-hidden border border-emerald-300">
                  <div className="text-[11px] font-bold bg-emerald-100 px-3 py-1 text-emerald-800">
                    Restored & Verified
                  </div>
                  <img
                    src={issue.resolution_proof.after_image}
                    alt="After"
                    className="w-full h-44 object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VISUAL STATUS TIMELINE STEPPER */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Status Timeline & Lifecycle</span>
            </h3>

            {/* Stepper Progress Bar */}
            <div className="hidden lg:flex items-center justify-between mb-8 relative">
              <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-200 -translate-y-1/2 z-0" />
              {TIMELINE_STEPS.map((step, idx) => {
                const currentIdx = getTimelineStepIndex(issue.status);
                const isCompleted = idx < currentIdx || issue.status === 'Resolved & Verified';
                const isCurrent = idx === currentIdx && issue.status !== 'Resolved & Verified';

                return (
                  <div key={step.status} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-2xs ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs mt-2 font-semibold text-center whitespace-nowrap ${
                        isCurrent
                          ? 'text-blue-700'
                          : isCompleted
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Timeline Events Log */}
            <div className="space-y-4 relative pl-6 border-l-2 border-blue-100 ml-3">
              {issue.timeline?.map((event) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white" />
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <span className="font-bold text-sm text-slate-900">{event.title}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{event.description}</p>
                    <div className="mt-2 text-[11px] font-medium text-slate-500 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        {event.actor}: {event.actor_name || 'System'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details & AI Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Description & Citizen Evidence */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Initial Report & Evidence</span>
              </h3>
              <p className="text-sm text-slate-700 mb-4 leading-relaxed">{issue.description}</p>
              {issue.evidence_url && (
                <div className="rounded-xl overflow-hidden border border-slate-200 h-64 bg-slate-900">
                  <img
                    src={issue.evidence_url}
                    alt="Citizen evidence"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* AI Analysis & Classification */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center space-x-2 text-purple-900">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>AI Automated Triage Information</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <div className="text-slate-500 font-medium mb-1">Issue Summary</div>
                  <p className="font-semibold text-purple-950">
                    {issue.ai_summary || issue.title}
                  </p>
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <div className="text-slate-500 font-medium mb-1">AI Reasoning & Public Safety Evaluation</div>
                  <p className="text-purple-900 leading-relaxed">
                    {issue.ai_reasoning || 'Triage completed according to reported risk factors.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500">Evaluated Severity</span>
                    <p className="font-bold text-slate-900 mt-0.5">{issue.severity}</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500">Evaluated Urgency</span>
                    <p className="font-bold text-slate-900 mt-0.5">{issue.urgency}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* "I Also Face This" Modal */}
      {showEndorseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>Endorse This Report ("I Also Face This")</span>
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              By adding your endorsement, you help prioritize this problem in municipal dispatch without creating unnecessary duplicate tickets.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={endorseName}
                  onChange={(e) => setEndorseName(e.target.value)}
                  placeholder="e.g. Neighbor on 5th Cross"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Note (Optional)</label>
                <textarea
                  rows={2}
                  value={endorseNote}
                  onChange={(e) => setEndorseNote(e.target.value)}
                  placeholder="e.g. My daily commute is disrupted by this waterlogging."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowEndorseModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMeToo}
                disabled={isEndorsing}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center space-x-1"
              >
                {isEndorsing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Endorsement (+1)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen / Issue Not Resolved Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-rose-900 mb-2 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Reopen Issue (Work Incomplete)</span>
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Please let municipal inspectors know why this resolution is unsatisfactory so the team can be re-dispatched.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Reopening</label>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Asphalt patch was not compacted and broke apart, or trash only partially removed..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVerifyResolution(false, reopenReason)}
                disabled={isVerifying}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs flex items-center space-x-1"
              >
                {isVerifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit & Reopen Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
