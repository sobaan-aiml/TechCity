import React from 'react';
import {
  Building2,
  PlusCircle,
  Search,
  MapPin,
  ShieldCheck,
  BarChart3,
  RotateCcw,
  User as UserIcon,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { User, UserRole } from '../types/auth';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: any) => void;
  user: User | null;
  onLogout: () => void;
  onResetDemo: () => void;
  isResettingDemo: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onLogout,
  onResetDemo,
  isResettingDemo,
}) => {
  const isCitizen = user?.role === 'citizen';
  const isAuthority = user?.role === 'authority';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & City Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => {
              if (isCitizen) setCurrentTab('home');
              else if (isAuthority) setCurrentTab('admin');
            }}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ring-2 ${
              isAuthority ? 'bg-indigo-600 ring-indigo-500/20' : 'bg-blue-600 ring-blue-500/20'
            }`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl text-slate-900 tracking-tight">TechCity</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  isAuthority
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {isAuthority ? 'Authority Operations' : 'Citizen Portal'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none">
                {isAuthority ? 'Municipal Dispatch & SLA Control' : 'Unified Civic Issue Management'}
              </p>
            </div>
          </div>

          {/* Navigation Links (STRICT ROLE SEGREGATION) */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* Citizen Only Links */}
            {isCitizen && (
              <>
                <button
                  onClick={() => setCurrentTab('home')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'home'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentTab('report')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'report'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  <span>Report Problem</span>
                </button>
                <button
                  onClick={() => setCurrentTab('track')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'track'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Search className="w-4 h-4 text-slate-500" />
                  <span>Track Status</span>
                </button>
                <button
                  onClick={() => setCurrentTab('my-reports')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'my-reports'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span>My Submissions</span>
                </button>
                <button
                  onClick={() => setCurrentTab('map')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'map'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>City Map</span>
                </button>
              </>
            )}

            {/* Authority Only Links */}
            {isAuthority && (
              <>
                <button
                  onClick={() => setCurrentTab('admin')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                    currentTab === 'admin'
                      ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Operations Dashboard</span>
                </button>
                <button
                  onClick={() => setCurrentTab('map')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'map'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Infrastructure Map</span>
                </button>
                <button
                  onClick={() => setCurrentTab('analytics')}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'analytics'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  <span>Civic Analytics</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Section: User Profile & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User Profile Badge */}
            {user && (
              <div className="flex items-center space-x-2 bg-slate-100/90 py-1.5 px-3 rounded-xl border border-slate-200 text-xs">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${
                  isAuthority ? 'bg-indigo-600' : 'bg-blue-600'
                }`}>
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">
                    {isAuthority
                      ? `${user.department || 'Municipal HQ'}`
                      : 'Verified Resident'}
                  </div>
                </div>
              </div>
            )}

            {/* Reset Demo Data Button */}
            <button
              type="button"
              onClick={onResetDemo}
              disabled={isResettingDemo}
              title="Reset Demo Data"
              className="hidden lg:flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResettingDemo ? 'animate-spin text-blue-600' : ''}`} />
              <span>Reset Demo</span>
            </button>

            {/* Logout Button */}
            {user && (
              <button
                type="button"
                onClick={onLogout}
                title="Log out of current portal"
                className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {user && (
          <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100 text-xs overflow-x-auto">
            {isCitizen ? (
              <>
                <button
                  onClick={() => setCurrentTab('home')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'home' ? 'font-bold text-blue-600' : 'text-slate-600'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentTab('report')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'report' ? 'font-bold text-blue-600' : 'text-slate-600'}`}
                >
                  Report
                </button>
                <button
                  onClick={() => setCurrentTab('track')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'track' ? 'font-bold text-blue-600' : 'text-slate-600'}`}
                >
                  Track
                </button>
                <button
                  onClick={() => setCurrentTab('my-reports')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'my-reports' ? 'font-bold text-blue-600' : 'text-slate-600'}`}
                >
                  My Reports
                </button>
                <button
                  onClick={() => setCurrentTab('map')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'map' ? 'font-bold text-blue-600' : 'text-slate-600'}`}
                >
                  Map
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('admin')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'admin' ? 'font-bold text-indigo-600' : 'text-slate-600'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentTab('map')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'map' ? 'font-bold text-indigo-600' : 'text-slate-600'}`}
                >
                  Map
                </button>
                <button
                  onClick={() => setCurrentTab('analytics')}
                  className={`py-1 px-2 rounded-md ${currentTab === 'analytics' ? 'font-bold text-indigo-600' : 'text-slate-600'}`}
                >
                  Analytics
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
