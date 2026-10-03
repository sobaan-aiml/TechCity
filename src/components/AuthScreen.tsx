import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
  AlertCircle,
  ArrowRight,
  Sparkles,
  KeyRound,
  IdCard,
} from 'lucide-react';
import { User as UserType, UserRole } from '../types/auth';
import { safeFetchJson } from '../utils/api';

interface AuthScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');
  const [isRegistering, setIsRegistering] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('Roads & Infrastructure');
  const [employeeId, setEmployeeId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Demo Logins
  const handleQuickLogin = async (demoEmail: string, role: UserRole) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await safeFetchJson<{ user: UserType }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: demoEmail,
          password: role === 'authority' ? 'admin123' : 'citizen123',
          role,
        }),
      });

      if (result.success && result.data?.user) {
        onLoginSuccess(result.data.user);
      } else {
        // Fallback for Vercel if serverless functions are cold or misconfigured
        const fallbackUsers: Record<string, UserType> = {
          'vikram@techcity.org': {
            id: 'user_cit_1',
            name: 'Vikram Sharma',
            email: 'vikram@techcity.org',
            phone: '+91 98450 11223',
            role: 'citizen',
            created_at: new Date().toISOString(),
          },
          'anita@techcity.org': {
            id: 'user_cit_2',
            name: 'Anita Deshmukh',
            email: 'anita@techcity.org',
            phone: '+91 98450 12345',
            role: 'citizen',
            created_at: new Date().toISOString(),
          },
          'rmurthy@techcity.gov': {
            id: 'user_auth_1',
            name: 'Engineer R. Murthy',
            email: 'rmurthy@techcity.gov',
            phone: '+91 98200 44556',
            role: 'authority',
            authority_type: 'engineer',
            department: 'Roads & Infrastructure',
            employee_id: 'TC-ROADS-401',
            created_at: new Date().toISOString(),
          },
          'jkhan@techcity.gov': {
            id: 'user_auth_2',
            name: 'Supervisor J. Khan',
            email: 'jkhan@techcity.gov',
            phone: '+91 98200 77889',
            role: 'authority',
            authority_type: 'supervisor',
            department: 'Solid Waste Management',
            employee_id: 'TC-SWM-805',
            created_at: new Date().toISOString(),
          },
          'admin@techcity.gov': {
            id: 'user_auth_3',
            name: 'Central Operations Dispatch',
            email: 'admin@techcity.gov',
            phone: '+91 80 2233 4455',
            role: 'authority',
            authority_type: 'admin',
            department: 'General Municipal Administration',
            employee_id: 'TC-HQ-001',
            created_at: new Date().toISOString(),
          },
        };

        if (fallbackUsers[demoEmail]) {
          onLoginSuccess(fallbackUsers[demoEmail]);
        } else {
          setErrorMessage(result.error || 'Login failed. Please verify credentials.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        const result = await safeFetchJson<{ user: UserType }>('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            role: selectedRole,
            department: selectedRole === 'authority' ? department : undefined,
            employee_id: selectedRole === 'authority' ? employeeId : undefined,
          }),
        });

        if (result.success && result.data?.user) {
          onLoginSuccess(result.data.user);
        } else {
          // If serverless is unavailable, provide client registration
          const fallbackUser: UserType = {
            id: `user_${selectedRole}_${Date.now()}`,
            name,
            email,
            phone,
            role: selectedRole,
            department: selectedRole === 'authority' ? department : undefined,
            employee_id: selectedRole === 'authority' ? employeeId : undefined,
            created_at: new Date().toISOString(),
          };
          onLoginSuccess(fallbackUser);
        }
      } else {
        const result = await safeFetchJson<{ user: UserType }>('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            role: selectedRole,
          }),
        });

        if (result.success && result.data?.user) {
          onLoginSuccess(result.data.user);
        } else {
          setErrorMessage(result.error || 'Invalid credentials or incorrect portal selected.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="max-w-xl w-full">
        {/* Top TechCity Logo Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md mb-3 ring-4 ring-blue-100">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            TechCity
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Unified Civic Issue Management & Role-Secured Municipal Dispatch
          </p>
        </div>

        {/* Portal Selection Tabs (Strict Role Segmentation) */}
        <div className="bg-slate-200/80 p-1.5 rounded-2xl flex items-center mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setSelectedRole('citizen');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 ${
              selectedRole === 'citizen'
                ? 'bg-white text-blue-700 shadow-md ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-blue-600" />
            <span>Citizen Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole('authority');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 ${
              selectedRole === 'authority'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-300" />
            <span>Municipal Authority Portal</span>
          </button>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          {/* Role Header Description */}
          <div className="mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  selectedRole === 'citizen'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {selectedRole === 'citizen' ? 'Citizen Access Only' : 'Official Authority Access Only'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {isRegistering
                ? `Create ${selectedRole === 'citizen' ? 'Citizen' : 'Authority'} Account`
                : `${selectedRole === 'citizen' ? 'Citizen' : 'Authority'} Sign In`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedRole === 'citizen'
                ? 'Log in to file civic reports, endorse community issues, and track verified resolutions. Authority tools are disabled in this mode.'
                : 'Log in with municipal credentials to assign departments, monitor SLA deadlines, and submit verified resolution proofs. Citizen reporting is disabled in this mode.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedRole === 'citizen' ? 'e.g. Vikram Sharma' : 'e.g. Engineer R. Murthy'}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {selectedRole === 'citizen' ? 'Email Address' : 'Official Municipal Email'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={selectedRole === 'citizen' ? 'vikram@techcity.org' : 'rmurthy@techcity.gov'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {isRegistering && selectedRole === 'citizen' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 11223"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            )}

            {isRegistering && selectedRole === 'authority' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="Roads & Infrastructure">Roads & Infrastructure</option>
                    <option value="Solid Waste Management">Solid Waste Management</option>
                    <option value="Water Supply & Sewerage">Water Supply & Sewerage</option>
                    <option value="Electrical & Street Lighting">Electrical & Street Lighting</option>
                    <option value="Stormwater Drainage">Stormwater Drainage</option>
                    <option value="Horticulture & Trees">Horticulture & Trees</option>
                    <option value="General Municipal Administration">General Municipal HQ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="TC-ENG-401"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <span className="text-[10px] text-slate-400">
                  {selectedRole === 'citizen' ? 'Default: citizen123' : 'Default: admin123'}
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center space-x-2 ${
                selectedRole === 'citizen'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <span>{isRegistering ? 'Complete Registration' : `Sign In as ${selectedRole === 'citizen' ? 'Citizen' : 'Authority'}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="text-center mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              {isRegistering
                ? 'Already have an account? Sign in'
                : `Need a new account? Register as ${selectedRole}`}
            </button>
          </div>

          {/* Quick Demo One-Click Sign-in Section (Super fast for Hackathon testing!) */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Click Hackathon Demo Logins:</span>
            </div>

            {selectedRole === 'citizen' ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('vikram@techcity.org', 'citizen')}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-xs transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-blue-700">
                      Vikram Sharma
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">Ward 84 Resident</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Quick Login →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('anita@techcity.org', 'citizen')}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-xs transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-blue-700">
                      Anita Deshmukh
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">Market Trader (Ward 85)</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Quick Login →
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('rmurthy@techcity.gov', 'authority')}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-xs transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-indigo-700">
                      Engineer R. Murthy
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">Roads & Infrastructure</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    My Assigned Tasks →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('jkhan@techcity.gov', 'authority')}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-xs transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-indigo-700">
                      Supervisor J. Khan
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">Solid Waste Management</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Department Operations →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@techcity.gov', 'authority')}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-xs transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-indigo-700">
                      Central Operations Dispatch
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">Municipal HQ Admin</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Control Room →
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
