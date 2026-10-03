import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  HardHat,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { CivicIssue, Department } from '../types/civic';
import { User } from '../types/auth';
import { safeFetchJson } from '../utils/api';
import {
  formatDate,
  formatRelativeTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
} from '../utils/helpers';

interface AdminControlRoomProps {
  user: User;
  onSelectIssueToTrack?: (trackingId: string) => void;
}

export const AdminControlRoom: React.FC<AdminControlRoomProps> = ({
  user,
  onSelectIssueToTrack,
}) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection Dialog State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingIssue, setRejectingIssue] = useState<CivicIssue | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Quick Action in progress
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchAllIssues = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await safeFetchJson<{ issues: CivicIssue[] }>('/api/issues');
      if (res.success && res.data?.issues) {
        setIssues(res.data.issues);
      } else {
        setErrorMessage(res.error || 'Failed to fetch city issues.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching system issues');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllIssues();
  }, []);

  // Admin Approval Action: Approve
  const handleApproveAssignment = async (issue: CivicIssue) => {
    setProcessingId(issue.id);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + issue.id + '/admin-approve-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          admin_name: user.name,
        }),
      });

      if (res.success) {
        fetchAllIssues();
      } else {
        alert(res.error || 'Failed to approve assignment.');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing approval.');
    } finally {
      setProcessingId(null);
    }
  };

  // Admin Approval Action: Reject
  const handleConfirmReject = async () => {
    if (!rejectingIssue) return;
    setIsSubmittingApproval(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + rejectingIssue.id + '/admin-approve-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          rejection_reason: rejectionReason.trim() || 'Work order rejected by HQ Dispatch.',
          admin_name: user.name,
        }),
      });

      if (res.success) {
        setShowRejectModal(false);
        setRejectingIssue(null);
        setRejectionReason('');
        fetchAllIssues();
      } else {
        alert(res.error || 'Failed to reject assignment.');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing rejection.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Metric computations for Bottlenecks
  const pendingAssignmentCount = issues.filter(
    (i) => (!i.assignment_status || i.assignment_status === 'UNASSIGNED') && i.status !== 'Resolved & Verified'
  ).length;

  const pendingApprovalIssues = issues.filter(
    (i) => i.assignment_status === 'PENDING_APPROVAL'
  );

  const inProgressCount = issues.filter(
    (i) => i.status === 'In Progress' || i.task_status === 'IN_PROGRESS'
  ).length;

  const pendingVerificationCount = issues.filter(
    (i) => i.status === 'Resolution Submitted' || i.task_status === 'COMPLETED'
  ).length;

  const criticalCount = issues.filter(
    (i) => (i.priority === 'CRITICAL' || i.priority === 'HIGH') && i.status !== 'Resolved & Verified'
  ).length;

  const resolvedCount = issues.filter(
    (i) => i.status === 'Resolved & Verified' || i.task_status === 'VERIFIED'
  ).length;

  // Filtered system issues list
  const filteredIssues = issues.filter((issue) => {
    if (selectedDept !== 'ALL' && issue.department !== selectedDept) return false;
    if (selectedPriority !== 'ALL' && issue.priority !== selectedPriority) return false;
    if (selectedStatus !== 'ALL' && issue.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        issue.tracking_id.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        issue.department.toLowerCase().includes(q) ||
        issue.address.toLowerCase().includes(q) ||
        (issue.engineer_name && issue.engineer_name.toLowerCase().includes(q)) ||
        (issue.supervisor_name && issue.supervisor_name.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top HQ Control Room Banner */}
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-3 border border-blue-500/30">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>MUNICIPAL HQ · CENTRAL OPERATIONS DISPATCH</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Central Operations Control Room
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Live executive oversight across all municipal departments. Authorize field task assignments, audit bottleneck SLAs, and inspect city-wide progress.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchAllIssues}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-2 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              <span>Refresh Operations Feed</span>
            </button>
          </div>
        </div>

        {/* WORKFLOW PIPELINE TRACKER */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            TechCity End-to-End Governance Pipeline
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">1. REPORTED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">2. REVIEWED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">3. ASSIGNED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-bold">
              4. PENDING ADMIN APPROVAL
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">5. APPROVED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">6. IN PROGRESS</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">7. COMPLETED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">8. SUPERVISOR VERIFIED</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">9. RESOLVED</span>
          </div>
        </div>

        {/* REAL-TIME BOTTLENECK COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Pending Assignment</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400">{pendingAssignmentCount}</div>
            <span className="text-[11px] text-slate-400">Issues awaiting supervisor triage</span>
          </div>

          <div className="bg-amber-950/40 rounded-2xl p-4 border border-amber-600/40 ring-1 ring-amber-500/30">
            <div className="flex items-center justify-between text-amber-300 text-xs mb-1">
              <span className="font-bold">Awaiting Admin Approval</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <div className="text-2xl font-black text-amber-300">{pendingApprovalIssues.length}</div>
            <span className="text-[11px] text-amber-200/80 font-medium">Field assignments queued for HQ sign-off</span>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Field Work</span>
              <HardHat className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">{inProgressCount}</div>
            <span className="text-[11px] text-slate-400">Engineers actively working on-site</span>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Awaiting Verification</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400">{pendingVerificationCount}</div>
            <span className="text-[11px] text-slate-400">Completed tasks in supervisor audit</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: ADMIN APPROVAL QUEUE (CRITICAL FLOW) */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-6 sm:p-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Assignments Awaiting Admin Approval
              </h2>
              <p className="text-xs text-slate-500">
                Department supervisors have designated field engineers. Review instructions, department, and priority before approving work authorization.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {pendingApprovalIssues.length} ACTION REQUIRED
          </span>
        </div>

        {pendingApprovalIssues.length === 0 ? (
          <div className="bg-amber-50/50 rounded-2xl border border-amber-200/60 p-8 text-center text-slate-600">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800 text-sm">Approval Queue is Clear!</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              All supervisor assignments have been reviewed. When a supervisor assigns an engineer, it will appear here for HQ authorization.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {pendingApprovalIssues.map((issue) => {
              const isActing = processingId === issue.id;

              return (
                <div
                  key={issue.id}
                  className="rounded-2xl border border-amber-300 bg-amber-50/30 p-5 flex flex-col lg:flex-row gap-5 items-start justify-between shadow-2xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                        {issue.tracking_id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(issue.priority)}`}>
                        {issue.priority} PRIORITY
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                        {issue.department}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Pending Admin Approval
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {issue.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {issue.description}
                    </p>

                    {/* Supervisor & Engineer Details Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white rounded-xl p-3 border border-amber-200">
                      <div>
                        <span className="text-slate-500 block">Supervisor:</span>
                        <strong className="text-slate-800">{issue.supervisor_name || 'Department Supervisor'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Designated Engineer:</span>
                        <strong className="text-indigo-700 font-bold">{issue.engineer_name || 'Field Engineer'}</strong>
                      </div>
                      <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                        <span className="text-slate-500 block">Assignment Instructions:</span>
                        <span className="text-slate-800 italic">"{issue.assignment_instructions || 'Standard repair procedure'}"</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{issue.address}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reported: {formatRelativeTime(issue.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 shrink-0 justify-end pt-2 lg:pt-0">
                    <button
                      onClick={() => handleApproveAssignment(issue)}
                      disabled={isActing}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Assignment</span>
                    </button>

                    <button
                      onClick={() => {
                        setRejectingIssue(issue);
                        setShowRejectModal(true);
                      }}
                      disabled={isActing}
                      className="flex-1 py-2.5 px-4 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: SYSTEM-WIDE OPERATIONS TABLE & MONITORING */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              City-Wide Infrastructure Operations Feed
            </h2>
            <p className="text-xs text-slate-500">
              Complete cross-departmental telemetry. Monitor assignments, supervisor actions, active work orders, and resolution proofs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">
              Showing {filteredIssues.length} of {issues.length} issues
            </span>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-slate-300"
            >
              <option value="ALL">All Departments</option>
              <option value="Roads & Infrastructure">Roads & Infrastructure</option>
              <option value="Solid Waste Management">Solid Waste Management</option>
              <option value="Stormwater Drainage">Stormwater Drainage</option>
              <option value="Electrical & Street Lighting">Electrical & Street Lighting</option>
              <option value="Horticulture & Trees">Horticulture & Trees</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-slate-300"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Workflow Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolution Submitted">Resolution Submitted</option>
              <option value="Resolved & Verified">Resolved & Verified</option>
              <option value="REOPENED">Reopened</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Search Keywords</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, title, engineer..."
              className="w-full p-2 bg-white rounded-xl border border-slate-300"
            />
          </div>
        </div>

        {/* Master Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-[11px] uppercase">
              <tr>
                <th className="py-3.5 px-4">Ticket & Details</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Assigned Engineer</th>
                <th className="py-3.5 px-4">Supervisor</th>
                <th className="py-3.5 px-4">Workflow Status</th>
                <th className="py-3.5 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono font-bold text-blue-700 text-xs">
                        {issue.tracking_id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(issue.priority)}`}>
                        {issue.priority}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 max-w-xs truncate">
                      {issue.title}
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                      📍 {issue.address}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {issue.department}
                  </td>

                  <td className="py-3.5 px-4">
                    {issue.engineer_name ? (
                      <div>
                        <strong className="text-slate-900 font-bold block">{issue.engineer_name}</strong>
                        <span className="text-[10px] text-slate-400">
                          {issue.task_status || 'Assigned'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-700">
                    {issue.supervisor_name || 'Auto Assigned'}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(issue.status)}`}>
                      {issue.status}
                    </span>
                    {issue.is_overdue && (
                      <span className="block mt-1 text-[10px] font-bold text-rose-600">
                        ⚠ SLA Overdue
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => onSelectIssueToTrack?.(issue.tracking_id)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center space-x-1"
                    >
                      <span>Track</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECT ASSIGNMENT MODAL */}
      {showRejectModal && rejectingIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Reject Assignment · {rejectingIssue.tracking_id}
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Rejecting will return this task back to Supervisor <strong>{rejectingIssue.supervisor_name || 'Supervisor'}</strong> for reassignment. Provide reason:
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Engineer already booked with higher priority road hazard in Ward 84. Please assign alternative personnel."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 mb-4"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingApproval || !rejectionReason.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
