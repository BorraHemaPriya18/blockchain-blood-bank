import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Droplet,
  PlusCircle,
  FlaskConical,
  PackageCheck,
  Truck,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function BloodBankDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [pendingUnits, setPendingUnits] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, unitsRes, requestsRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/blood-units?status=collected'),
        api.get('/requests?status=pending'),
      ]);

      if (metricsRes.data.success) setMetrics(metricsRes.data.data);
      if (unitsRes.data.success) setPendingUnits(unitsRes.data.units || []);
      if (requestsRes.data.success) setActiveRequests(requestsRes.data.requests || []);
    } catch (err) {
      console.error('Error fetching blood bank dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickScreen = async (unitId, status) => {
    try {
      await api.put(`/blood-units/${unitId}/screening`, {
        screeningStatus: status,
        notes: status === 'passed' ? 'Rapid serology screen passed.' : 'Pathogen reactive. Quarantined.',
      });
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating screening');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              Authorized Blood Bank Node
            </span>
            <span className="text-xs text-slate-500 font-mono">License: {user?.licenseNumber || 'BB-LIC-9021'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {user?.organizationName || 'Blood Bank Portal'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage unit collection, laboratory serology validation, inventory availability, and cold-chain dispatches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/units/register"
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center space-x-2 text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Blood Unit</span>
          </Link>
          <Link
            to="/requests"
            className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <PackageCheck className="w-4 h-4 text-purple-600" />
            <span>Allocate Requests</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Units Managed</span>
            <Droplet className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{metrics?.totalUnits ?? '--'}</div>
          <div className="text-xs text-slate-500 mt-1">Across all storage statuses</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Screening</span>
            <FlaskConical className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600">{metrics?.pendingScreening ?? '--'}</div>
          <div className="text-xs text-slate-500 mt-1">Requires lab approval</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Hospital Requests</span>
            <PackageCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold text-purple-600">
            {metrics?.pendingRequests ?? metrics?.activeRequests ?? '--'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.emergencyRequests ? `${metrics.emergencyRequests} Emergency` : '0 Emergency'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Expiring in 7 Days</span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-rose-600">{metrics?.expiringSoon ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Wastage prevention alert</div>
        </div>
      </div>

      {/* Available Stock Grid By Blood Group */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Droplet className="w-5 h-5 text-rose-600" />
            <span>Available Blood Stock by Group (Passed Screening)</span>
          </h2>
          <Link to="/inventory" className="text-xs font-semibold text-rose-600 hover:text-rose-700">
            Open Full Inventory &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => {
            const count = metrics?.groupBreakdown?.[bg] ?? 0;
            const isLow = count < 2;
            return (
              <div
                key={bg}
                className={`p-3 rounded-xl border ${
                  isLow ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="text-xs font-extrabold text-slate-700">{bg}</div>
                <div className={`text-2xl font-black mt-1 ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                  {count}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                  {isLow ? 'Low Stock' : 'Units'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Laboratory Serology Validation Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <FlaskConical className="w-5 h-5 text-amber-500" />
              <span>Laboratory Serology Screening Queue</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Units in this queue cannot be allocated to hospital requests until approved by authorized lab staff.
            </p>
          </div>
          <span className="text-xs font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
            {pendingUnits.length} Awaiting Screening
          </span>
        </div>

        {pendingUnits.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No blood units currently pending screening.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Blood Group</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Collection Date</th>
                  <th className="py-2.5 px-3">Donor ID</th>
                  <th className="py-2.5 px-3 text-right">Serology Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUnits.map((u) => (
                  <tr key={u.unitId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                    <td className="py-3 px-3 font-bold text-rose-700">{u.bloodGroup}</td>
                    <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                    <td className="py-3 px-3 text-slate-500">{new Date(u.collectionDate).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{u.donorRefId}</td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleQuickScreen(u.unitId, 'passed')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold inline-flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pass & Stock</span>
                      </button>
                      <button
                        onClick={() => handleQuickScreen(u.unitId, 'failed')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold inline-flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Fail (Quarantine)</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
