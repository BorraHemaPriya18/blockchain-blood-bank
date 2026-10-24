import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  Lock,
  ExternalLink,
  Activity,
  Droplet,
  Share2,
  PackageCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [usersRes, metricsRes, transfersRes, reqsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/analytics/dashboard'),
        api.get('/transfers'),
        api.get('/requests'),
      ]);

      if (usersRes.data.success) setUsers(usersRes.data.users || []);
      if (metricsRes.data.success) setMetrics(metricsRes.data.data);
      if (transfersRes.data.success) setTransfers(transfersRes.data.transfers || []);
      if (reqsRes.data.success) setRecentRequests((reqsRes.data.requests || []).slice(0, 5));
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, approve) => {
    try {
      const res = await api.put(`/auth/users/${userId}/approve`, { approve });
      setActionMsg(res.data.message);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating organization approval');
    }
  };

  const pendingOrgs = users.filter((u) => ['blood_bank', 'hospital'].includes(u.role) && !u.isApproved);
  const approvedOrgs = users.filter((u) => ['blood_bank', 'hospital'].includes(u.role) && u.isApproved);
  const donors = users.filter((u) => u.role === 'donor');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
              Root System Administrator
            </span>
            <span className="text-xs text-slate-500 font-mono">Contract Owner Node &bull; PoA Validator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            System Governance & Network Monitoring
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Authorize participant nodes, monitor emergency transfers, verify order fulfillment, and inspect on-chain ledger activity.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/analytics"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs"
          >
            Analytics & Reports
          </Link>
          <Link
            to="/explorer"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm flex items-center space-x-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>Blockchain Explorer</span>
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span className="font-semibold">{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="font-bold text-base cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Network Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Donors</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{donors.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Off-chain PII protected</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Authorized Blood Banks</div>
          <div className="text-3xl font-black text-rose-600 mt-1">
            {users.filter((u) => u.role === 'blood_bank' && u.isApproved).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Licensed collection nodes</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Authorized Hospitals</div>
          <div className="text-3xl font-black text-blue-600 mt-1">
            {users.filter((u) => u.role === 'hospital' && u.isApproved).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Clinical recipient nodes</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Approvals</div>
          <div className="text-3xl font-black text-amber-600 mt-1">{pendingOrgs.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting medical license validation</div>
        </div>
      </div>

      {/* Emergency Transfers Monitoring (Prompt Requirement 7) */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Share2 className="w-5 h-5 text-rose-600" />
              <span>Emergency Inter-Hospital Transfers Monitoring ({transfers.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit of peer-to-peer hospital transfers with verified supplying and requesting institutions.
            </p>
          </div>
          <Link
            to="/transfers"
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
          >
            <span>View All Transfers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {transfers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No emergency inter-hospital transfers recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/50 border-b border-rose-200 font-semibold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Transfer ID</th>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Requesting Hospital</th>
                  <th className="py-2.5 px-3">Supplying Organization</th>
                  <th className="py-2.5 px-3">Group / Comp</th>
                  <th className="py-2.5 px-3">Urgency</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Turnaround Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((t) => (
                  <tr key={t.transferId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{t.transferId}</td>
                    <td className="py-3 px-3 font-mono text-rose-700 font-semibold">
                      <Link to={`/units/${t.unitId}`} className="hover:underline">
                        {t.unitId}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {t.requestingHospitalName || 'Requesting Hospital'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {t.supplyingHospitalName || 'Supplying Hospital'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-rose-700">{t.bloodGroup}</span>{' '}
                      <span className="text-slate-500 text-[11px]">{t.componentType}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white">
                        {t.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-3">
                      {t.elapsedTimeMinutes ? (
                        <span className="font-bold text-emerald-700">{t.elapsedTimeMinutes} mins (Measured)</span>
                      ) : (
                        <span className="text-slate-400 italic">In transit / active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Organization Approvals */}
      <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>Pending Organization Approvals ({pendingOrgs.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review medical licenses and authorize on-chain participation before organizations can log in or execute transactions.
            </p>
          </div>
        </div>

        {pendingOrgs.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No organization registrations currently pending review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 border-b border-amber-200 font-semibold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Organization Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">License Number</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Wallet Address</th>
                  <th className="py-2.5 px-3 text-right">Approval Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingOrgs.map((org) => (
                  <tr key={org._id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-900">{org.organizationName || org.username}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          org.role === 'blood_bank' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {org.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{org.licenseNumber}</td>
                    <td className="py-3 px-3 text-slate-500">{org.email}</td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                      {org.walletAddress || 'Auto-assign on approval'}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleApprove(org._id, true)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Authorize</span>
                      </button>
                      <button
                        onClick={() => handleApprove(org._id, false)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Authorized Participant Nodes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-slate-700" />
          <span>Authorized Participant Nodes ({approvedOrgs.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Organization</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">License</th>
                <th className="py-2.5 px-3">Wallet Address</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvedOrgs.map((org) => (
                <tr key={org._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-semibold text-slate-900">{org.organizationName || org.username}</td>
                  <td className="py-3 px-3 capitalize text-slate-600">{org.role.replace('_', ' ')}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{org.licenseNumber}</td>
                  <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{org.walletAddress}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Authorized & Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
