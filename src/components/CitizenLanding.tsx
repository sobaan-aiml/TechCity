import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  MapPin,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

interface CitizenLandingProps {
  onNavigateReport: () => void;
  onNavigateTrack: (trackingId?: string) => void;
  onNavigateMap: () => void;
}

export const CitizenLanding: React.FC<CitizenLandingProps> = ({
  onNavigateReport,
  onNavigateTrack,
  onNavigateMap,
}) => {
  return (
    <div className="space-y-12 pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/80 via-white to-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
          {/* TechCity Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-6 border border-blue-200 shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>TechCity · Municipal Public Works Portal</span>
          </div>

          {/* Main Title & Short Explanation (Exact brief requirement) */}
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight sm:leading-tight">
            TechCity Civic Issue Management
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Report civic problems, track progress, and help your community get issues resolved.
          </p>

          {/* Action Buttons (Exact brief requirement) */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={onNavigateReport}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Report an Issue</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTrack()}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 shadow-2xs transition-all flex items-center justify-center space-x-2"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>Track My Report</span>
            </button>
          </div>

          {/* Live Metric Banner */}
          <div className="mt-12 pt-8 border-t border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Guaranteed SLA Target</div>
              <div className="text-xl font-bold text-slate-900 mt-1">12h to 72h</div>
              <div className="text-[11px] text-blue-600 font-semibold mt-0.5">Deterministic triage</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Community Endorsements</div>
              <div className="text-xl font-bold text-slate-900 mt-1">"I Also Face This"</div>
              <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Prevents duplicate tickets</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">AI Assisted Analysis</div>
              <div className="text-xl font-bold text-slate-900 mt-1">Gemini Triage</div>
              <div className="text-[11px] text-purple-600 font-semibold mt-0.5">Objective classification</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Resolution Verification</div>
              <div className="text-xl font-bold text-slate-900 mt-1">Citizen Sign-Off</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Before / After photo proof</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS LIFECYCLE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Transparent Issue Lifecycle
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-xl mx-auto">
            From your camera directly to the municipal repair squad, with complete public visibility at every milestone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Citizen Submits</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Capture photo evidence, drop pin on the map, and write a brief description.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">AI Triage & SLA Priority</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Gemini assesses severity while transparent formula calculates deterministic score and SLA deadline.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Department Dispatched</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Assigned team executes repairs on site and uploads photographic proof before closing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">
              4
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Citizen Verifies</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Inspect Before & After photos to Confirm Resolution or Reopen the ticket if work is incomplete.
            </p>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS & INTERACTIVE SHORTCUTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Interactive City Map
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
              Explore Active Repairs & Ward Hotspots
            </h3>
            <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
              View color-coded priority pins across the municipality, inspect active road works, and check flood/waste clusters on OpenStreetMap.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={onNavigateMap}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center space-x-2"
            >
              <MapPin className="w-4 h-4" />
              <span>Open City Map</span>
            </button>
            <button
              onClick={() => onNavigateTrack('CIV-2026-00102')}
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Test Verification Flow</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
