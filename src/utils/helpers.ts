import { IssueStatus, PriorityLevel } from '../types/civic';

export function getPriorityBadgeClass(priority: PriorityLevel): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

export function getPriorityColorHex(priority: PriorityLevel): string {
  switch (priority) {
    case 'CRITICAL':
      return '#ef4444';
    case 'HIGH':
      return '#f97316';
    case 'MEDIUM':
      return '#eab308';
    case 'LOW':
      return '#3b82f6';
    default:
      return '#64748b';
  }
}

export function getStatusBadgeClass(status: IssueStatus): string {
  switch (status) {
    case 'Reported':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'AI Analysis':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Assigned':
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    case 'In Progress':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Resolution Submitted':
      return 'bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold';
    case 'User Verification':
      return 'bg-teal-100 text-teal-800 border-teal-300';
    case 'Resolved & Verified':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
    case 'REOPENED':
      return 'bg-rose-100 text-rose-800 border-rose-300 font-semibold';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

export function formatDate(isoString: string): string {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(isoString: string): string {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffHours = Math.floor((now - past) / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Preset evidence photos for fast testing during hackathon
export const SAMPLE_EVIDENCE_PRESETS = [
  {
    label: 'Deep Road Pothole',
    category: 'Pothole',
    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Overflowing Waste Dump',
    category: 'Garbage / Waste',
    url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Street Flood / Waterlogging',
    category: 'Waterlogging',
    url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Dark Broken Streetlight',
    category: 'Broken Streetlight',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Blocked Stormwater Grate',
    category: 'Blocked Drain',
    url: 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Fallen Tree Branch',
    category: 'Fallen Tree',
    url: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=800&q=80',
  },
];

// Preset resolution photos for authority proof
export const SAMPLE_RESOLUTION_PRESETS = [
  {
    label: 'Asphalt Road Paved & Leveled',
    url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Cleaned & Swept Footpath',
    url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'Drain Desilted & Cleared Water',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
  {
    label: 'New LED Streetlight Installed & Lit',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
  },
];
