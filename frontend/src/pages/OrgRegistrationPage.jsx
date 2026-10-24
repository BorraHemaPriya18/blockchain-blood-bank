import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Hospital, ShieldCheck, Mail, Lock, FileText, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OrgRegistrationPage() {
  const { registerOrganization } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('blood_bank');
  const [organizationName, setOrganizationName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await registerOrganization({
        role,
        organizationName,
        licenseNumber,
        email,
        username,
        password,
        walletAddress: walletAddress || undefined,
      });

      setSuccessMsg(res.message || 'Organization registered. Pending administrator verification.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-slate-900 items-center justify-center text-white shadow-lg mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Organization Registration</h1>
          <p className="mt-2 text-sm text-slate-600">
            Register an authorized Blood Bank or Clinical Hospital participant node.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6 sm:p-10">
          {successMsg ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Application Submitted</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">{successMsg}</p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center px-6 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Organization Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('blood_bank')}
                    className={`p-4 rounded-xl border-2 text-left flex items-start space-x-3 transition-all ${
                      role === 'blood_bank'
                        ? 'border-rose-600 bg-rose-50/40 text-rose-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Building2 className={`w-5 h-5 mt-0.5 ${role === 'blood_bank' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Blood Bank</div>
                      <div className="text-xs text-slate-500">Collection, screening, inventory</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('hospital')}
                    className={`p-4 rounded-xl border-2 text-left flex items-start space-x-3 transition-all ${
                      role === 'hospital'
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Hospital className={`w-5 h-5 mt-0.5 ${role === 'hospital' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Hospital Clinic</div>
                      <div className="text-xs text-slate-500">Blood requests, transfusion</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Org Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Official Organization Name</label>
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. St. Jude Blood Center"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Medical Regulatory License #</label>
                  <input
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. LIC-BB-4921"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Account Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Staff Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin_bb_staff"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Official Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@org.health"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Ethereum Wallet for On-chain signing */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Ethereum Wallet Address <span className="text-slate-400 font-normal">(Optional for dev)</span>
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Auto-assigned if blank)"
                  className="mt-1 block w-full font-mono px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-rose-500 focus:border-rose-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Used by the backend to verify caller identity in smart contract access control modifiers.
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  All hospital and blood bank registrations require system administrator authorization before access is
                  granted to inventory allocation and smart contract state.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting Application...' : 'Submit Organization Registration'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
