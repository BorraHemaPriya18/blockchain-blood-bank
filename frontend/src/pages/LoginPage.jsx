import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Droplet, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(emailOrUsername, password);
      // Route based on role
      switch (user.role) {
        case 'admin':
          navigate('/admin-dashboard');
          break;
        case 'blood_bank':
          navigate('/bloodbank-dashboard');
          break;
        case 'hospital':
          navigate('/hospital-dashboard');
          break;
        case 'donor':
          navigate('/donor-dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setEmailOrUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-200">
            <Droplet className="w-7 h-7 fill-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Sign In to BloodChain
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Enter your authorized credentials or select a demonstration account below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Email or Username</label>
              <div className="mt-1 relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="admin@bloodchain.org or username"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="mt-1 relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Quick-Fill Demonstration Accounts */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>1-Click Test Credentials</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@bloodchain.org', 'Admin@password123')}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                <div className="font-semibold text-slate-800">System Admin</div>
                <div className="text-[10px] text-slate-500 truncate">admin@bloodchain.org</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('bloodbank@redcross.org', 'Bank@password123')}
                className="p-2 text-left bg-rose-50/50 hover:bg-rose-100/50 rounded-lg border border-rose-200 transition-colors"
              >
                <div className="font-semibold text-rose-800">Blood Bank</div>
                <div className="text-[10px] text-slate-500 truncate">bloodbank@redcross.org</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('hospital1@metrohealth.org', 'Hosp@password123')}
                className="p-2 text-left bg-blue-50/50 hover:bg-blue-100/50 rounded-lg border border-blue-200 transition-colors"
              >
                <div className="font-semibold text-blue-800">Metro Hospital</div>
                <div className="text-[10px] text-slate-500 truncate">hospital1@metrohealth.org</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('donor1@example.com', 'Donor@password123')}
                className="p-2 text-left bg-emerald-50/50 hover:bg-emerald-100/50 rounded-lg border border-emerald-200 transition-colors"
              >
                <div className="font-semibold text-emerald-800">Donor (Alex)</div>
                <div className="text-[10px] text-slate-500 truncate">donor1@example.com</div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
            <div>
              New voluntary donor?{' '}
              <Link to="/register-donor" className="font-semibold text-rose-600 hover:text-rose-700">
                Register as Donor
              </Link>
            </div>
            <div>
              Register new hospital or blood bank?{' '}
              <Link to="/register-org" className="font-semibold text-slate-700 hover:text-slate-900">
                Organization Registration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
