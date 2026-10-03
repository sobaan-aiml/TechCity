import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  HardHat,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CivicIssue } from '../types/civic';
import { User } from '../types/auth';
import { safeFetchJson } from '../utils/api';
import {
  formatDate,
  formatRelativeTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
} from '../utils/helpers';

interface SupervisorDashboardProps {
  user: User;
  onSelectIssueToTrack?: (trackingId: string) => void;
}

interface EngineerOption {
  id: string;
  name: string;
  department: string;
  employee_id: string;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  user,
  onSelectIssueToTrack,
}) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<EngineerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Department scope (Supervisor manages his department, e.g. Solid Waste Management)
  const myDepartment = user.department || 'Solid Waste Management';

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'UNASSIGNED' | 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'COMPLETED' | 'RESOLVED' | 'REOPENED'
  >('ALL');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Issue for Modals
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);

  // Assign Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>('user_auth_1'); // Default to Engineer R. Murthy for seamless demo!
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [customDeadlineHours, setCustomDeadlineHours] = useState('24');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  // Verification Review Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const fetchDepartmentIssues = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch issues filtered to supervisor's department
      const res = await safeFetchJson<{ issues: CivicIssue[] }>('/api/issues?department=' + encodeURIComponent(myDepartment));
      if (res.success && res.data?.issues) {
        setIssues(res.data.issues);
        if (selectedIssue) {
          const fresh = res.data.issues.find((i) => i.id === selectedIssue.id);
          if (fresh) setSelectedIssue(fresh);
        }
      } else {
        setErrorMessage(res.error || 'Failed to fetch department issues.');
      }

      // Fetch available engineers for assignment
      const engRes = await safeFetchJson<{ engineers: EngineerOption[] }>('/api/engineers');
      if (engRes.success && engRes.data?.engineers) {
        setAvailableEngineers(engRes.data.engineers);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching department data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentIssues();
  }, [myDepartment]);

  // Handle Supervisor Assignment -> Transitions to PENDING ADMIN APPROVAL
  const handleAssignEngineer = async () => {
    if (!selectedIssue || !selectedEngineerId) return;
    const targetEng = availableEngineers.find((e) => e.id === selectedEngineerId);
    if (!targetEng) return;

    setIsSubmittingAssignment(true);
    try {
      const deadlineDate = new Date(Date.now() + parseInt(customDeadlineHours, 10) * 3600 * 1000).toISOString();

      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + selectedIssue.id + '/supervisor-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisor_id: user.id,
          supervisor_name: user.name,
          engineer_id: targetEng.id,
          engineer_name: targetEng.name,
          instructions: assignmentInstructions.trim() || 'Inspect site and execute repairs per municipal standards.',
          deadline: deadlineDate,
        }),
      });

      if (res.success) {
        setShowAssignModal(false);
        setAssignmentInstructions('');
        fetchDepartmentIssues();
      } else {
        alert(res.error || 'Failed to submit assignment.');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting assignment.');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  // Handle Supervisor Verification (Approve or Reopen)
  const handleVerifyWork = async (verified: boolean) => {
    if (!selectedIssue) return;
    if (!verified && !rejectionReason.trim()) {
      alert('Please provide a reason explaining what work needs rework.');
      return;
    }

    setIsSubmittingVerification(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + selectedIssue.id + '/supervisor-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisor_id: user.id,
          supervisor_name: user.name,
          verified,
          rejection_note: rejectionReason.trim(),
        }),
      });

      if (res.success) {
        setShowVerifyModal(false);
        setRejectionReason('');
        setIsRejecting(false);
        fetchDepartmentIssues();
      } else {
        alert(res.error || 'Failed to record verification.');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing verification.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Categorize issues for supervisor tab views
  const unassignedList = issues.filter((i) => !i.assignment_status || i.assignment_status === 'UNASSIGNED');
  const pendingApprovalList = issues.filter((i) => i.assignment_status === 'PENDING_APPROVAL');
  const inProgressList = issues.filter((i) => i.assignment_status === 'APPROVED' && (i.task_status === 'IN_PROGRESS' || i.task_status === 'ASSIGNED' || i.task_status === 'ACCEPTED'));
  const pendingVerificationList = issues.filter((i) => i.task_status === 'COMPLETED' || i.status === 'Resolution Submitted');
  const resolvedList = issues.filter((i) => i.task_status === 'VERIFIED' || i.status === 'Resolved & Verified');
  const reopenedList = issues.filter((i) => i.task_status === 'REOPENED' || i.status === 'REOPENED');

  const filteredIssues = issues.filter((issue) => {
    // Tab filter
    if (activeTab === 'UNASSIGNED' && (issue.assignment_status && issue.assignment_status !== 'UNASSIGNED')) return false;
    if (activeTab === 'PENDING_APPROVAL' && issue.assignment_status !== 'PENDING_APPROVAL') return false;
    if (activeTab === 'IN_PROGRESS' && (issue.task_status !== 'IN_PROGRESS' && issue.task_status !== 'ASSIGNED' && issue.task_status !== 'ACCEPTED')) return false;
    if (activeTab === 'COMPLETED' && (issue.task_status !== 'COMPLETED' && issue.status !== 'Resolution Submitted')) return false;
    if (activeTab === 'RESOLVED' && (issue.task_status !== 'VERIFIED' && issue.status !== 'Resolved & Verified')) return false;
    if (activeTab === 'REOPENED' && (issue.task_status !== 'REOPENED' && issue.status !== 'REOPENED')) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        issue.tracking_id.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        issue.address.toLowerCase().includes(q) ||
        (issue.engineer_name && issue.engineer_name.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Department Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold mb-3 border border-indigo-200">
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>DEPARTMENT OPERATIONS DESK · {myDepartment.toUpperCase()}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Department Operations
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Command console for <strong>{user.name}</strong> ({user.employee_id || 'TC-SWM'}). Assign field engineers, monitor task progress, and audit completed repair proofs.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchDepartmentIssues}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-2 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh Department Data</span>
            </button>
          </div>
        </div>

        {/* Workflow Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200">
            <span className="text-[11px] font-semibold text-rose-700 uppercase">New / Unassigned</span>
            <div className="text-2xl font-black text-rose-900 mt-0.5">{unassignedList.length}</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-700 uppercase">Pending Admin Approval</span>
            <div className="text-2xl font-black text-amber-900 mt-0.5">{pendingApprovalList.length}</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-200">
            <span className="text-[11px] font-semibold text-blue-700 uppercase">In Progress</span>
            <div className="text-2xl font-black text-blue-900 mt-0.5">{inProgressList.length}</div>
          </div>
          <div className="bg-purple-50 rounded-2xl p-3 border border-purple-200">
            <span className="text-[11px] font-semibold text-purple-700 uppercase">Pending Verification</span>
            <div className="text-2xl font-black text-purple-900 mt-0.5">{pendingVerificationList.length}</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase">Verified & Resolved</span>
            <div className="text-2xl font-black text-emerald-900 mt-0.5">{resolvedList.length}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none text-xs font-bold">
          {[
            { key: 'ALL', label: `All Issues (${issues.length})` },
            { key: 'UNASSIGNED', label: `Unassigned (${unassignedList.length})` },
            { key: 'PENDING_APPROVAL', label: `Awaiting Admin (${pendingApprovalList.length})` },
            { key: 'IN_PROGRESS', label: `In Progress (${inProgressList.length})` },
            { key: 'COMPLETED', label: `Verify Proof (${pendingVerificationList.length})` },
            { key: 'REOPENED', label: `Reopened (${reopenedList.length})` },
            { key: 'RESOLVED', label: `Resolved (${resolvedList.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, title, engineer..."
            className="w-full text-xs pl-8 pr-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-medium mb-6">
          {errorMessage}
        </div>
      )}

      {/* Issues Table / Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm font-semibold">Loading department operations...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No issues under this view</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All department issues have been handled or no records match your filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const isUnassigned = !issue.assignment_status || issue.assignment_status === 'UNASSIGNED';
            const isPendingAdmin = issue.assignment_status === 'PENDING_APPROVAL';
            const isReadyToVerify = issue.task_status === 'COMPLETED' || issue.status === 'Resolution Submitted';
            const isReopened = issue.task_status === 'REOPENED' || issue.status === 'REOPENED';

            return (
              <div
                key={issue.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-indigo-300 transition-all flex flex-col md:flex-row gap-6 items-start justify-between"
              >
                {/* Left Issue Information */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {issue.tracking_id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(issue.priority)}`}>
                      {issue.priority} PRIORITY
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {issue.category}
                    </span>

                    {/* Workflow status indicator */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isUnassigned
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : isPendingAdmin
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                        : isReadyToVerify
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : isReopened
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : issue.status === 'Resolved & Verified'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {isUnassigned && '⚡ Needs Engineer Assignment'}
                      {isPendingAdmin && '⏳ Awaiting Admin Approval'}
                      {isReadyToVerify && '🔍 Proof Submitted · Ready to Verify'}
                      {isReopened && '⚠️ Reopened for Rework'}
                      {!isUnassigned && !isPendingAdmin && !isReadyToVerify && !isReopened && issue.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {issue.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {issue.description}
                    </p>
                  </div>

                  {/* Assigned Engineer details banner */}
                  {issue.engineer_name && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold">Assigned Engineer: </span>
                        <strong className="text-slate-800 font-bold">{issue.engineer_name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Status: </span>
                        <span className="font-semibold text-slate-700">
                          {issue.task_status || issue.status}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Location & Metadata */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issue.address}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reported: {formatRelativeTime(issue.created_at)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issue.affected_people} citizens affected</span>
                    </span>
                  </div>
                </div>

                {/* Right Action Column */}
                <div className="w-full md:w-64 flex flex-col space-y-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5">
                  {/* Photo thumbnail */}
                  {issue.evidence_url && (
                    <div className="relative rounded-xl overflow-hidden h-28 bg-slate-100 border border-slate-200 mb-2">
                      <img
                        src={issue.evidence_url}
                        alt="Evidence photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* ACTION 1: Assign Engineer (for unassigned issues or reassignment) */}
                  {(isUnassigned || issue.assignment_status === 'REJECTED') && (
                    <button
                      onClick={() => {
                        setSelectedIssue(issue);
                        setShowAssignModal(true);
                      }}
                      className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Select Engineer & Assign</span>
                    </button>
                  )}

                  {/* ACTION 2: Pending Admin Notice */}
                  {isPendingAdmin && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-xs text-amber-900">
                      <span className="font-bold block">Assignment Dispatched</span>
                      <span className="text-[11px] text-amber-700">Awaiting Central Ops Admin Approval</span>
                    </div>
                  )}

                  {/* ACTION 3: Review Proof & Verify */}
                  {isReadyToVerify && (
                    <button
                      onClick={() => {
                        setSelectedIssue(issue);
                        setShowVerifyModal(true);
                      }}
                      className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Inspect Proof & Verify Work</span>
                    </button>
                  )}

                  {/* Reopened Notice */}
                  {isReopened && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center text-xs text-rose-900">
                      <span className="font-bold block">Rework in Progress</span>
                      <span className="text-[11px] text-rose-700">Engineer is addressing deficiencies</span>
                    </div>
                  )}

                  {/* View on Public Tracker */}
                  <button
                    onClick={() => onSelectIssueToTrack?.(issue.tracking_id)}
                    className="w-full py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center justify-center space-x-1"
                  >
                    <span>View Public Timeline</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ASSIGN ENGINEER */}
      {showAssignModal && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Assign Field Engineer
                </h3>
                <span className="text-xs font-mono font-bold text-indigo-600">
                  {selectedIssue.tracking_id} · {selectedIssue.title}
                </span>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Select an authorized municipal engineer. Once assigned, this assignment will be submitted to <strong>Central Operations Dispatch for Admin Approval</strong> before being dispatched to the engineer.
            </p>

            {/* Engineer Selection Dropdown */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Select Available Engineer:
              </label>
              <select
                value={selectedEngineerId}
                onChange={(e) => setSelectedEngineerId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {availableEngineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.department} · {eng.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Instructions */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Specific Work Instructions & Scope:
              </label>
              <textarea
                value={assignmentInstructions}
                onChange={(e) => setAssignmentInstructions(e.target.value)}
                placeholder="e.g. Deploy 10-ton compactor truck. Clear entire commercial perimeter and apply bleaching powder."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Deadline hours */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Resolution Target Deadline:
              </label>
              <select
                value={customDeadlineHours}
                onChange={(e) => setCustomDeadlineHours(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium"
              >
                <option value="6">6 Hours (Emergency Priority)</option>
                <option value="12">12 Hours (Urgent)</option>
                <option value="24">24 Hours (Standard Fast Track)</option>
                <option value="48">48 Hours (Regular SLA)</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignEngineer}
                disabled={isSubmittingAssignment || !selectedEngineerId}
                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Submit Assignment for Admin Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFY WORK & AUDIT PROOF */}
      {showVerifyModal && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Supervisor Quality Audit & Verification
                </h3>
                <span className="text-xs font-mono font-bold text-indigo-600">
                  {selectedIssue.tracking_id}
                </span>
              </div>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Before vs After Photo Proof Comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-2 text-center">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">
                  Before (Incident Photo)
                </span>
                <img
                  src={selectedIssue.resolution_proof?.before_image || selectedIssue.evidence_url}
                  alt="Original issue"
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-2 text-center">
                <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                  After (Engineer Completion Proof)
                </span>
                <img
                  src={selectedIssue.resolution_proof?.after_image || 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80'}
                  alt="Completed work proof"
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Engineer Resolution Notes */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 mb-4">
              <strong className="block text-slate-900 font-semibold mb-1">
                Field Engineer Completion Log ({selectedIssue.resolution_proof?.submitted_by || selectedIssue.engineer_name}):
              </strong>
              <p>{selectedIssue.resolution_proof?.resolution_note || 'Work executed according to standards.'}</p>
            </div>

            {/* Rejection input field if supervisor is reopening */}
            {isRejecting ? (
              <div className="mb-4">
                <label className="text-xs font-bold text-rose-800 block mb-1">
                  Deficiency / Rework Required:
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why work is unsatisfactory (e.g. Debris still scattered on sidewalk; further cleaning required)."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-rose-300 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {!isRejecting ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl"
                  >
                    Request Rework (Reopen)
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyWork(true)}
                      disabled={isSubmittingVerification}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center space-x-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Mark Resolved</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyWork(false)}
                    disabled={isSubmittingVerification || !rejectionReason.trim()}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl flex items-center space-x-1.5 shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirm Reopen (Send back to Engineer)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
