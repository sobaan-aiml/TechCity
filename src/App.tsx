import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CitizenLanding } from './components/CitizenLanding';
import { CitizenReportForm } from './components/CitizenReportForm';
import { TrackIssueView } from './components/TrackIssueView';
import { MyReportsView } from './components/MyReportsView';
import { CityMapView } from './components/CityMapView';
import { AdminDashboard } from './components/AdminDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthScreen } from './components/AuthScreen';
import { CivicIssue } from './types/civic';
import { User } from './types/auth';
import { CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';

export default function App() {
  // Authentication session state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('techcity_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Current View tab
  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('techcity_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u.role === 'authority' ? 'admin' : 'home';
      }
    } catch {}
    return 'home';
  });

  const [trackingIdToView, setTrackingIdToView] = useState<string>('CIV-2026-00102');
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('techcity_auth_user', JSON.stringify(user));
    } catch {}

    // Strictly route to the correct portal based on role!
    if (user.role === 'authority') {
      setCurrentTab('admin');
      showToast(`Welcome, ${user.name}! Official Authority portal activated.`);
    } else {
      setCurrentTab('home');
      showToast(`Welcome back, ${user.name}! Citizen reporting portal activated.`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('techcity_auth_user');
    } catch {}
    setCurrentTab('home');
    showToast('Signed out successfully.');
  };

  // Safe navigation with strict role isolation enforcement
  const handleSetTab = (tab: string) => {
    if (!currentUser) {
      setCurrentTab(tab);
      return;
    }

    // Role Security: Citizen CANNOT access Authority routes
    if (currentUser.role === 'citizen') {
      if (tab === 'admin' || tab === 'analytics') {
        showToast('Access Restricted: Municipal Authority clearance required.');
        setCurrentTab('home');
        return;
      }
    }

    // Role Security: Authority CANNOT access Citizen report/home forms
    if (currentUser.role === 'authority') {
      if (tab === 'home' || tab === 'report' || tab === 'my-reports') {
        showToast('Authority Mode: Use operations console for issue management.');
        setCurrentTab('admin');
        return;
      }
    }

    setCurrentTab(tab);
  };

  const handleResetDemo = async () => {
    if (isResettingDemo) return;
    setIsResettingDemo(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Sample demo data reset successfully!');
        if (currentTab === 'track') {
          setTrackingIdToView('CIV-2026-00102');
        }
      } else {
        alert(data.error || 'Failed to reset demo data');
      }
    } catch (err: any) {
      alert(err.message || 'Error connecting to server');
    } finally {
      setIsResettingDemo(false);
    }
  };

  const handleIssueCreated = (issue: CivicIssue) => {
    setTrackingIdToView(issue.tracking_id);
    showToast(`Issue ${issue.tracking_id} submitted with priority ${issue.priority}!`);
  };

  const handleTrackIssue = (trackingId: string) => {
    setTrackingIdToView(trackingId);
    setCurrentTab('track');
  };

  // If not logged in, render the Role-Separated Auth Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <AuthScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  const isCitizen = currentUser.role === 'citizen';
  const isAuthority = currentUser.role === 'authority';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-500 selection:text-white font-sans text-slate-900">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleSetTab}
        user={currentUser}
        onLogout={handleLogout}
        onResetDemo={handleResetDemo}
        isResettingDemo={isResettingDemo}
      />

      {/* Main View Router with Role Protection */}
      <main className="flex-1">
        {/* CITIZEN VIEWS */}
        {isCitizen && (
          <>
            {currentTab === 'home' && (
              <CitizenLanding
                onNavigateReport={() => handleSetTab('report')}
                onNavigateTrack={(id) => {
                  if (id) setTrackingIdToView(id);
                  handleSetTab('track');
                }}
                onNavigateMap={() => handleSetTab('map')}
              />
            )}

            {currentTab === 'report' && (
              <CitizenReportForm
                user={currentUser}
                onIssueCreated={handleIssueCreated}
                onTrackIssue={handleTrackIssue}
              />
            )}

            {currentTab === 'track' && (
              <TrackIssueView
                initialTrackingId={trackingIdToView}
                onNavigateReport={() => handleSetTab('report')}
              />
            )}

            {currentTab === 'my-reports' && (
              <MyReportsView
                user={currentUser}
                onTrackIssue={handleTrackIssue}
                onNavigateReport={() => handleSetTab('report')}
              />
            )}

            {currentTab === 'map' && (
              <CityMapView onSelectIssue={handleTrackIssue} />
            )}
          </>
        )}

        {/* AUTHORITY VIEWS */}
        {isAuthority && (
          <>
            {currentTab === 'admin' && (
              <AdminDashboard onSelectIssueToTrack={handleTrackIssue} />
            )}

            {currentTab === 'map' && (
              <CityMapView onSelectIssue={handleTrackIssue} />
            )}

            {currentTab === 'analytics' && <AnalyticsView />}
          </>
        )}
      </main>

      {/* Civic Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">TechCity</span>
            <span>· Unified Civic Issue Management</span>
            <span className="text-slate-300">|</span>
            <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
              isAuthority ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {isAuthority ? 'AUTHORITY DESK SESSION' : 'CITIZEN SESSION'}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="font-medium text-slate-600">
              Signed in as: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.email})
            </span>
            <button
              onClick={handleLogout}
              className="text-rose-600 hover:text-rose-800 font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
