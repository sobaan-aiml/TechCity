import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Flame,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { CivicIssue, Department, IssueCategory, IssueStatus, PriorityLevel } from '../types/civic';
import { safeFetchJson } from '../utils/api';
import {
  formatDate,
  formatRelativeTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  SAMPLE_RESOLUTION_PRESETS,
} from '../utils/helpers';

interface AdminDashboardProps {
  onSelectIssueToTrack?: (trackingId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectIssueToTrack,
}) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Issue for Modal Action Drawer
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Department assignment state
  const [assignedDept, setAssignedDept] = useState<string>('');

  // Status update state
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');

  // Internal note state
  const [internalNoteText, setInternalNoteText] = useState('');
  const [authorName, setAuthorName] = useState('Dispatcher Officer');

  // Submit Resolution Modal State
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionAfterImage, setResolutionAfterImage] = useState(SAMPLE_RESOLUTION_PRESETS[0].url);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittedBy, setSubmittedBy] = useState('Field Unit Lead #14');

  const fetchIssues = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedPriority !== 'ALL') params.append('priority', selectedPriority);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedDepartment !== 'ALL') params.append('department', selectedDepartment);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await safeFetchJson<{ issues: CivicIssue[] }>(`/api/issues?${params.toString()}`);
      if (res.success && res.data?.issues) {
        setIssues(res.data.issues);
        // Refresh selected issue if open
        if (selectedIssue) {
          const fresh = res.data.issues.find((i: CivicIssue) => i.id === selectedIssue.id);
          if (fresh) setSelectedIssue(fresh);
        }
      } else {
        setErrorMessage(res.error || 'Failed to fetch issues');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching issues');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [selectedCategory, selectedPriority, selectedStatus, selectedDepartment]);

  // Metric computations
  const totalCount = issues.length;
  const openCount = issues.filter(i => i.status !== 'Resolved & Verified').length;
  const criticalHighCount = issues.filter(
    i => i.priority === 'CRITICAL' || i.priority === 'HIGH'
  ).length;
  const overdueCount = issues.filter(i => i.is_overdue).length;
  const resolvedCount = issues.filter(i => i.status === 'Resolved & Verified').length;

  // Handle Department Assignment
  const handleAssignDepartment = async () => {
    if (!selectedIssue || !assignedDept) return;
    setIsUpdating(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${selectedIssue.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: assignedDept,
          actor_name: authorName,
        }),
      });
      if (res.success && res.data?.issue) {
        setSelectedIssue(res.data.issue);
        fetchIssues();
      } else {
        alert(res.error || 'Failed to assign department');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedIssue || !newStatus) return;
    setIsUpdating(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${selectedIssue.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: statusNote || undefined,
          actor: 'Municipal Authority',
          actor_name: authorName,
        }),
      });
      if (res.success && res.data?.issue) {
        setSelectedIssue(res.data.issue);
        setStatusNote('');
        fetchIssues();
      } else {
        alert(res.error || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Internal Note
  const handleAddInternalNote = async () => {
    if (!selectedIssue || !internalNoteText.trim()) return;
    setIsUpdating(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${selectedIssue.id}/internal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: internalNoteText.trim(),
          author: authorName,
        }),
      });
      if (res.success && res.data?.issue) {
        setSelectedIssue(res.data.issue);
        setInternalNoteText('');
        fetchIssues();
      } else {
        alert(res.error || 'Failed to add internal note');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Resolution Submission
  const handleSubmitResolution = async () => {
    if (!selectedIssue || !resolutionAfterImage || !resolutionNote.trim()) {
      alert('After photo and resolution note are required.');
      return;
    }
    setIsUpdating(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>(`/api/issues/${selectedIssue.id}/submit-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          before_image: selectedIssue.evidence_url,
          after_image: resolutionAfterImage,
          resolution_note: resolutionNote.trim(),
          submitted_by: submittedBy,
        }),
      });
      if (res.success && res.data?.issue) {
        setSelectedIssue(res.data.issue);
        setShowResolutionModal(false);
        setResolutionNote('');
        fetchIssues();
      } else {
        alert(res.error || 'Failed to submit resolution proof');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
              OPERATIONS DESK
            </span>
            <span className="text-xs text-slate-500">Live Central Command</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Municipal Authority Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Dispatch departments, track SLA deadlines, review AI triage insights, and submit verified resolution proofs.
          </p>
        </div>

        <button
          onClick={fetchIssues}
          disabled={isLoading}
          className="self-start sm:self-center px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center space-x-1.5 shadow-2xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Desk</span>
        </button>
      </div>

      {/* METRIC CARDS ROW (PROMPT REQUIREMENT) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Total Issues</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">All city tickets</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-amber-700">Open Issues</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{openCount}</div>
          <div className="text-[11px] text-amber-600 mt-1">Active field pipeline</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-red-700">High / Critical</div>
          <div className="text-2xl font-black text-red-600 mt-1">{criticalHighCount}</div>
          <div className="text-[11px] text-red-500 mt-1">Safety hazards & bottlenecks</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-rose-700 flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue SLA</span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{overdueCount}</div>
          <div className="text-[11px] text-rose-500 mt-1">Exceeded target deadline</div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-700">Resolved Issues</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Citizen verified closed</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs mb-6 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchIssues()}
              placeholder="Search by Tracking ID, street address, or description..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Quick Submit Search */}
          <button
            type="button"
            onClick={fetchIssues}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-2xs shrink-0"
          >
            Search
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="ALL">All Categories</option>
              <option value="Pothole">Pothole</option>
              <option value="Damaged Road">Damaged Road</option>
              <option value="Garbage / Waste">Garbage / Waste</option>
              <option value="Waterlogging">Waterlogging</option>
              <option value="Broken Streetlight">Broken Streetlight</option>
              <option value="Blocked Drain">Blocked Drain</option>
              <option value="Sewage Problem">Sewage Problem</option>
              <option value="Fallen Tree">Fallen Tree</option>
              <option value="Encroachment">Encroachment</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical (12h SLA)</option>
              <option value="HIGH">High (24h SLA)</option>
              <option value="MEDIUM">Medium (48h SLA)</option>
              <option value="LOW">Low (72h SLA)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="AI Analysis">AI Analysis</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolution Submitted">Resolution Submitted</option>
              <option value="Resolved & Verified">Resolved & Verified</option>
              <option value="REOPENED">REOPENED</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="ALL">All Departments</option>
              <option value="Roads & Infrastructure">Roads & Infrastructure</option>
              <option value="Solid Waste Management">Solid Waste Management</option>
              <option value="Water Supply & Sewerage">Water Supply & Sewerage</option>
              <option value="Electrical & Street Lighting">Electrical & Lighting</option>
              <option value="Stormwater Drainage">Stormwater Drainage</option>
              <option value="Horticulture & Trees">Horticulture & Trees</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* ISSUES TABLE (PROMPT REQUIREMENT) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 font-bold">Tracking ID</th>
                <th className="py-3.5 px-4 font-bold">Category</th>
                <th className="py-3.5 px-4 font-bold">Location & Address</th>
                <th className="py-3.5 px-4 font-bold">Priority</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Assigned Department</th>
                <th className="py-3.5 px-4 font-bold">Reported</th>
                <th className="py-3.5 px-4 font-bold">SLA Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No civic reports match the current filters.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedIssue(issue);
                      setAssignedDept(issue.department !== 'Unassigned' ? issue.department : 'Roads & Infrastructure');
                      setNewStatus(issue.status);
                    }}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {issue.tracking_id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {issue.category}
                    </td>
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <div className="truncate font-medium text-slate-800">{issue.address}</div>
                      {issue.landmark && (
                        <div className="text-[10px] text-slate-400 truncate">{issue.landmark}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getPriorityBadgeClass(
                          issue.priority
                        )}`}
                      >
                        {issue.priority} ({issue.priority_score})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeClass(
                          issue.status
                        )}`}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                      {issue.department}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatDate(issue.created_at)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {issue.status === 'Resolved & Verified' ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolved</span>
                        </span>
                      ) : issue.is_overdue ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                          <Flame className="w-3 h-3" />
                          <span>OVERDUE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-blue-700 text-[11px] font-medium">
                          <Clock className="w-3 h-3" />
                          <span>{issue.sla_hours}h target</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIssue(issue);
                          setAssignedDept(issue.department !== 'Unassigned' ? issue.department : 'Roads & Infrastructure');
                          setNewStatus(issue.status);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ISSUE MANAGEMENT MODAL DRAWER */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-mono text-xl font-bold text-blue-700">
                    {selectedIssue.tracking_id}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                      selectedIssue.status
                    )}`}
                  >
                    {selectedIssue.status}
                  </span>
                  {selectedIssue.is_overdue && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
                      OVERDUE
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{selectedIssue.title}</h3>
                <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedIssue.address}</span>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {onSelectIssueToTrack && (
                  <button
                    type="button"
                    onClick={() => onSelectIssueToTrack(selectedIssue.tracking_id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium flex items-center space-x-1"
                  >
                    <span>Citizen View</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Grid Layout: Left Details, Right Authority Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Evidence & AI Triage Context */}
              <div className="space-y-4">
                {/* Evidence Photo */}
                <div className="rounded-xl overflow-hidden border border-slate-200 h-52 bg-slate-900">
                  <img
                    src={selectedIssue.evidence_url}
                    alt="Citizen evidence"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Description */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-bold text-slate-700 mb-1">Citizen Problem Statement:</div>
                  <p className="text-slate-800 leading-relaxed">{selectedIssue.description}</p>
                </div>

                {/* Deterministic Priority Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Priority Score: {selectedIssue.priority_score} pts ({selectedIssue.priority})</span>
                    <span className="text-blue-700 font-semibold">{selectedIssue.affected_people} Affected</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {selectedIssue.priority_reasons?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Gemini AI Summary & Reasoning */}
                {selectedIssue.ai_reasoning && (
                  <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950">
                    <div className="flex items-center space-x-1.5 font-bold text-purple-900 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Gemini AI Triage Assessment</span>
                    </div>
                    <p className="text-purple-800 leading-relaxed mb-2">
                      {selectedIssue.ai_reasoning}
                    </p>
                    <div className="text-[11px] text-purple-600">
                      Suggested Department: <span className="font-bold">{selectedIssue.department}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Authority Actions */}
              <div className="space-y-5">
                {/* Action 1: Assign Department */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Assign Responsible Department</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={assignedDept}
                      onChange={(e) => setAssignedDept(e.target.value)}
                      className="flex-1 p-2 text-xs rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="Roads & Infrastructure">Roads & Infrastructure</option>
                      <option value="Solid Waste Management">Solid Waste Management</option>
                      <option value="Water Supply & Sewerage">Water Supply & Sewerage</option>
                      <option value="Electrical & Street Lighting">Electrical & Street Lighting</option>
                      <option value="Stormwater Drainage">Stormwater Drainage</option>
                      <option value="Horticulture & Trees">Horticulture & Trees</option>
                      <option value="Town Planning & Enforcement">Town Planning & Enforcement</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignDepartment}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                {/* Action 2: Update Status */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Update Ticket Status</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="flex-1 p-2 text-xs rounded-xl border border-slate-300 bg-white"
                      >
                        <option value="Reported">Reported</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolution Submitted">Resolution Submitted</option>
                        <option value="Resolved & Verified">Resolved & Verified</option>
                        <option value="REOPENED">REOPENED</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleUpdateStatus}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
                      >
                        Update
                      </button>
                    </div>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional status transition note for timeline..."
                      className="w-full p-2 text-xs rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                {/* Action 3: SUBMIT RESOLUTION PROOF (CRITICAL PROMPT REQUIREMENT) */}
                <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-emerald-900 text-xs flex items-center space-x-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Submit Resolution Proof</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Citizen Verification Flow
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mb-3">
                    Require photographic proof (Before & After) and work details. Sets status to "Resolution Submitted" for resident sign-off.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowResolutionModal(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Before/After Proof & Complete</span>
                  </button>
                </div>

                {/* Action 4: Add Internal Note */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>Internal Department Note</span>
                  </label>
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      placeholder="Log internal crew update, procurement request, or dispatch log..."
                      className="w-full p-2 text-xs rounded-xl border border-slate-300"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddInternalNote}
                        disabled={isUpdating || !internalNoteText.trim()}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl transition-colors"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION PROOF MODAL (BEFORE / AFTER / NOTE) */}
      {showResolutionModal && selectedIssue && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>Submit Resolution Proof ({selectedIssue.tracking_id})</span>
              </div>
              <button
                onClick={() => setShowResolutionModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Upload the field proof of completion. This will transition the ticket to "Resolution Submitted" so the citizen can inspect and verify.
            </p>

            <div className="space-y-4 mb-6">
              {/* Before image display */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Before Image (Citizen Evidence)
                </label>
                <div className="h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={selectedIssue.evidence_url}
                    alt="Before evidence"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* After image selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. After Repair Photo (Select or Upload Proof)
                </label>
                <div className="h-36 rounded-xl overflow-hidden border border-emerald-300 bg-slate-900 mb-2">
                  <img
                    src={resolutionAfterImage}
                    alt="After repair proof"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="text-[11px] text-slate-500 mb-1">Quick Select Resolution Proof Preset:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SAMPLE_RESOLUTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setResolutionAfterImage(preset.url)}
                      className={`text-[11px] p-2 rounded-lg border text-left truncate transition-colors ${
                        resolutionAfterImage === preset.url
                          ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Resolution Note & Field Work Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Detail the technical repair: e.g. Cold asphalt laid and roller compacted; drain cleared with suction truck; luminaire replaced with 45W LED fixture..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Submitted By (Engineer / Supervisor)
                </label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitResolution}
                disabled={isUpdating || !resolutionNote.trim()}
                className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Resolution Proof</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
