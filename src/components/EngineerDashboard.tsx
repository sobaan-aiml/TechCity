import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HardHat,
  MapPin,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { CivicIssue, TaskStatus } from '../types/civic';
import { User } from '../types/auth';
import { safeFetchJson } from '../utils/api';
import {
  formatDate,
  formatRelativeTime,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  SAMPLE_RESOLUTION_PRESETS,
} from '../utils/helpers';

interface EngineerDashboardProps {
  user: User;
  onSelectIssueToTrack?: (trackingId: string) => void;
}

export const EngineerDashboard: React.FC<EngineerDashboardProps> = ({
  user,
  onSelectIssueToTrack,
}) => {
  const [tasks, setTasks] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'REOPENED'>('ALL');

  // Selected task for action
  const [selectedTask, setSelectedTask] = useState<CivicIssue | null>(null);

  // Note dialog state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Completion proof modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [afterImage, setAfterImage] = useState(SAMPLE_RESOLUTION_PRESETS[0].url);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Quick action loading tracker
  const [actingTaskId, setActingTaskId] = useState<string | null>(null);

  const fetchMyTasks = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await safeFetchJson<{ issues: CivicIssue[] }>('/api/issues');
      if (res.success && res.data?.issues) {
        // Strict Role Filter: ONLY tasks assigned to this engineer AND approved by admin!
        const myAssigned = res.data.issues.filter((issue) => {
          const isMyId = issue.engineer_id && issue.engineer_id === user.id;
          const isMyName = issue.engineer_name && issue.engineer_name.toLowerCase().includes(user.name.toLowerCase());
          const isApproved = issue.assignment_status === 'APPROVED';
          return (isMyId || isMyName) && isApproved;
        });

        setTasks(myAssigned);

        if (selectedTask) {
          const fresh = myAssigned.find((t) => t.id === selectedTask.id);
          if (fresh) setSelectedTask(fresh);
        }
      } else {
        setErrorMessage(res.error || 'Failed to load assigned tasks.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, [user.id, user.name]);

  // Engineer Action: Accept Task
  const handleAcceptTask = async (task: CivicIssue) => {
    setActingTaskId(task.id);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + task.id + '/engineer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPT',
          engineer_id: user.id,
          engineer_name: user.name,
        }),
      });

      if (res.success && res.data?.issue) {
        fetchMyTasks();
      } else {
        alert(res.error || 'Failed to accept task.');
      }
    } catch (err: any) {
      alert(err.message || 'Error accepting task.');
    } finally {
      setActingTaskId(null);
    }
  };

  // Engineer Action: Start Work
  const handleStartWork = async (task: CivicIssue) => {
    setActingTaskId(task.id);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + task.id + '/engineer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_WORK',
          engineer_id: user.id,
          engineer_name: user.name,
        }),
      });

      if (res.success && res.data?.issue) {
        fetchMyTasks();
      } else {
        alert(res.error || 'Failed to start work.');
      }
    } catch (err: any) {
      alert(err.message || 'Error starting work.');
    } finally {
      setActingTaskId(null);
    }
  };

  // Engineer Action: Add Work Note
  const handleSubmitNote = async () => {
    if (!selectedTask || !noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + selectedTask.id + '/engineer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_NOTE',
          engineer_id: user.id,
          engineer_name: user.name,
          note: noteText.trim(),
        }),
      });

      if (res.success) {
        setShowNoteModal(false);
        setNoteText('');
        fetchMyTasks();
      } else {
        alert(res.error || 'Failed to log work note.');
      }
    } catch (err: any) {
      alert(err.message || 'Error logging note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Engineer Action: Submit Completion Proof
  const handleSubmitProof = async () => {
    if (!selectedTask || !resolutionNote.trim()) {
      alert('Please provide a completion note describing the repaired work.');
      return;
    }
    setIsSubmittingProof(true);
    try {
      const res = await safeFetchJson<{ issue: CivicIssue }>('/api/issues/' + selectedTask.id + '/engineer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_COMPLETION',
          engineer_id: user.id,
          engineer_name: user.name,
          before_image: selectedTask.evidence_url,
          after_image: afterImage,
          resolution_note: resolutionNote.trim(),
        }),
      });

      if (res.success) {
        setShowProofModal(false);
        setResolutionNote('');
        fetchMyTasks();
      } else {
        alert(res.error || 'Failed to submit completion proof.');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting proof.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  // Filter tasks based on activeFilter
  const filteredTasks = tasks.filter((t) => {
    const status = t.task_status || (t.status === 'In Progress' ? 'IN_PROGRESS' : 'ASSIGNED');
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'ASSIGNED') return status === 'ASSIGNED' || status === 'ACCEPTED';
    if (activeFilter === 'IN_PROGRESS') return status === 'IN_PROGRESS';
    if (activeFilter === 'COMPLETED') return status === 'COMPLETED';
    if (activeFilter === 'VERIFIED') return status === 'VERIFIED' || t.status === 'Resolved & Verified';
    if (activeFilter === 'REOPENED') return status === 'REOPENED' || t.status === 'REOPENED';
    return true;
  });

  const assignedCount = tasks.filter((t) => t.task_status === 'ASSIGNED' || t.task_status === 'ACCEPTED').length;
  const inProgressCount = tasks.filter((t) => t.task_status === 'IN_PROGRESS' || t.status === 'In Progress').length;
  const pendingVerificationCount = tasks.filter((t) => t.task_status === 'COMPLETED' || t.status === 'Resolution Submitted').length;
  const reopenedCount = tasks.filter((t) => t.task_status === 'REOPENED' || t.status === 'REOPENED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-3 border border-blue-200">
              <HardHat className="w-3.5 h-3.5 text-blue-600" />
              <span>FIELD ENGINEER DISPATCH · {user.department || 'Roads & Infrastructure'}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              My Assigned Tasks
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Field execution desk for <strong>{user.name}</strong> ({user.employee_id || 'TC-ENG'}). Review work orders, update field progress, and submit completion proof.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchMyTasks}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-2 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Task Counters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">To Accept / Start</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{assignedCount}</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-200">
            <span className="text-[11px] font-semibold text-blue-600 uppercase">In Progress</span>
            <div className="text-2xl font-black text-blue-700 mt-0.5">{inProgressCount}</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-700 uppercase">Awaiting Verification</span>
            <div className="text-2xl font-black text-amber-800 mt-0.5">{pendingVerificationCount}</div>
          </div>
          <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200">
            <span className="text-[11px] font-semibold text-rose-700 uppercase">Reopened (Rework)</span>
            <div className="text-2xl font-black text-rose-800 mt-0.5">{reopenedCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 scrollbar-none text-xs font-bold">
        {[
          { key: 'ALL', label: `All My Tasks (${tasks.length})` },
          { key: 'ASSIGNED', label: `To Do (${assignedCount})` },
          { key: 'IN_PROGRESS', label: `In Progress (${inProgressCount})` },
          { key: 'COMPLETED', label: `Pending Verification (${pendingVerificationCount})` },
          { key: 'REOPENED', label: `Reopened (${reopenedCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key as any)}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeFilter === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-medium mb-6">
          {errorMessage}
        </div>
      )}

      {/* Task List Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-sm font-semibold">Loading assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No tasks in this category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not have any pending tasks under the selected filter tab. Check other tabs or notify your supervisor.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const taskStatus = task.task_status || (task.status === 'In Progress' ? 'IN_PROGRESS' : 'ASSIGNED');
            const isActing = actingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-blue-300 transition-all flex flex-col md:flex-row gap-6 items-start justify-between"
              >
                {/* Left Task Content */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {task.tracking_id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadgeClass(task.priority)}`}>
                      {task.priority} PRIORITY
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {task.category}
                    </span>
                    {task.is_overdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                        OVERDUE SLA
                      </span>
                    )}

                    {/* Workflow status chip */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      taskStatus === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : taskStatus === 'COMPLETED'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : taskStatus === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : taskStatus === 'REOPENED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {taskStatus === 'ASSIGNED' && 'Awaiting Acceptance'}
                      {taskStatus === 'ACCEPTED' && 'Accepted · Ready to Start'}
                      {taskStatus === 'IN_PROGRESS' && 'Work In Progress'}
                      {taskStatus === 'COMPLETED' && 'Submitted · Pending Supervisor Audit'}
                      {taskStatus === 'VERIFIED' && 'Verified & Resolved'}
                      {taskStatus === 'REOPENED' && 'Rework Required'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  </div>

                  {/* Supervisor Instructions Callout */}
                  {task.assignment_instructions && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                      <strong className="font-semibold block mb-0.5 text-amber-800">
                        📋 Instructions from {task.supervisor_name || 'Supervisor'}:
                      </strong>
                      <span>{task.assignment_instructions}</span>
                    </div>
                  )}

                  {/* Reopened Notice if applicable */}
                  {taskStatus === 'REOPENED' && task.resolution_proof?.rejection_reason && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                      <strong className="font-semibold block mb-0.5 text-rose-800">
                        ⚠️ Rework Requested by Supervisor:
                      </strong>
                      <span>{task.resolution_proof.rejection_reason}</span>
                    </div>
                  )}

                  {/* Location & Metadata info */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{task.address}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Assigned: {formatDate(task.assignment_date || task.created_at)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deadline: {formatDate(task.sla_deadline)}</span>
                    </span>
                  </div>

                  {/* Existing Work Notes */}
                  {task.work_notes && (
                    <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-line font-mono">
                      {task.work_notes}
                    </div>
                  )}
                </div>

                {/* Right Action Column */}
                <div className="w-full md:w-64 flex flex-col space-y-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5">
                  {/* Photo thumbnail */}
                  {task.evidence_url && (
                    <div className="relative rounded-xl overflow-hidden h-28 bg-slate-100 border border-slate-200 mb-2">
                      <img
                        src={task.evidence_url}
                        alt="Evidence photo"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white font-bold px-1.5 py-0.5 rounded">
                        Citizen Photo
                      </span>
                    </div>
                  )}

                  {/* Stage-based action buttons */}
                  {taskStatus === 'ASSIGNED' && (
                    <button
                      onClick={() => handleAcceptTask(task)}
                      disabled={isActing}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Accept Task</span>
                    </button>
                  )}

                  {taskStatus === 'ACCEPTED' && (
                    <button
                      onClick={() => handleStartWork(task)}
                      disabled={isActing}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start Work</span>
                    </button>
                  )}

                  {(taskStatus === 'IN_PROGRESS' || taskStatus === 'REOPENED') && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowProofModal(true);
                        }}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Upload Completion Proof</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowNoteModal(true);
                        }}
                        className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>Add Work Note</span>
                      </button>
                    </>
                  )}

                  {taskStatus === 'COMPLETED' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center text-xs text-purple-900">
                      <span className="font-bold block">✓ Work Submitted</span>
                      <span className="text-[11px] text-purple-700">Awaiting supervisor verification</span>
                    </div>
                  )}

                  {taskStatus === 'VERIFIED' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-xs text-emerald-900">
                      <span className="font-bold block">✓ Verified & Resolved</span>
                      <span className="text-[11px] text-emerald-700">Verified by {task.verified_by || 'Supervisor'}</span>
                    </div>
                  )}

                  {/* View on Public Tracker */}
                  <button
                    onClick={() => onSelectIssueToTrack?.(task.tracking_id)}
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

      {/* MODAL 1: ADD WORK NOTE */}
      {showNoteModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Log Progress Note · {selectedTask.tracking_id}
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Add real-time notes on site conditions, material dispatch, or repair status for supervisors and dispatchers to monitor.
            </p>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Cleared 2 tons of surface debris. Asphalt mixer scheduled to arrive in 45 minutes."
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 mb-4"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNote}
                disabled={isSubmittingNote || !noteText.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: UPLOAD COMPLETION PROOF */}
      {showProofModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Submit Work Completion Proof
                </h3>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {selectedTask.tracking_id}
                </span>
              </div>
              <button
                onClick={() => setShowProofModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Upload photo evidence of the completed repair. Once submitted, your supervisor will review the before/after photos and verify resolution.
            </p>

            {/* Before vs After Photo preview */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-2 text-center">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Before (Original)
                </span>
                <img
                  src={selectedTask.evidence_url}
                  alt="Before repair"
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-2 text-center">
                <span className="text-[11px] font-bold text-emerald-700 block mb-1.5">
                  After (Repaired Proof)
                </span>
                <img
                  src={afterImage}
                  alt="After repair proof"
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Sample Photo Presets */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Select Sample Repair Proof Photo (or choose from library):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_RESOLUTION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAfterImage(preset.url)}
                    className={`p-1.5 rounded-xl border text-left transition-all ${
                      afterImage === preset.url
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="w-full h-16 object-cover rounded-lg mb-1" />
                    <span className="text-[10px] font-bold text-slate-700 block truncate">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Completion Note */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Field Completion Summary & Note:
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe the completed rectification: e.g. Compacted asphalt hot-mix flush with road surface. Barricades retrieved and traffic circulation reopened."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowProofModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitProof}
                disabled={isSubmittingProof || !resolutionNote.trim()}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center space-x-2 shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Completed & Submit to Supervisor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
