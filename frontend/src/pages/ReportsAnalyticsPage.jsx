import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Download,
  TrendingUp,
  Clock,
  Droplet,
  PieChart as PieIcon,
  Layers,
  Building2,
  PackageCheck,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';

const COLORS = ['#c81e1e', '#f05252', '#0e9f6e', '#3f83f8', '#9061f9', '#ff5a1f', '#e74c3c', '#34495e'];

export default function ReportsAnalyticsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState(null);
  const [reportType, setReportType] = useState('inventory');

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/analytics/dashboard');
      if (res.data.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Authenticated CSV Export Handler
  const handleDownloadReport = async (type = reportType) => {
    setDownloadingType(type);
    try {
      const response = await api.get(`/analytics/export-csv?type=${type}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bloodchain_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading report: ' + (err.response?.data?.message || err.message));
    } finally {
      setDownloadingType(null);
    }
  };

  const bloodGroupChartData = metrics?.groupBreakdown
    ? Object.keys(metrics.groupBreakdown).map((bg) => ({
        group: bg,
        count: metrics.groupBreakdown[bg],
      }))
    : [];

  const componentChartData = metrics?.componentBreakdown
    ? Object.keys(metrics.componentBreakdown).map((comp) => ({
        name: comp,
        value: metrics.componentBreakdown[comp],
      }))
    : [];

  const monthlyTrendsData = metrics?.monthlyTrends || metrics?.stockTrends || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white capitalize">
              {metrics?.role || user?.role || 'System'} Analytics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 flex items-center space-x-2">
            <BarChart3 className="w-7 h-7 text-rose-600" />
            <span>Operational Intelligence & Audit Reports</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Role-specific inventory metrics, fulfillment rates, cold chain integrity, and compliance ledger exports.
          </p>
        </div>

        {/* Report Download Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700 shadow-xs"
          >
            <option value="inventory">Inventory Ledger Report</option>
            <option value="requests">Hospital Orders & Allocation</option>
            <option value="transfers">Emergency P2P Transfers</option>
            <option value="audit">System Audit & Compliance Log</option>
          </select>
          <button
            onClick={() => handleDownloadReport(reportType)}
            disabled={Boolean(downloadingType)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingType ? 'Exporting...' : 'Download CSV'}</span>
          </button>
        </div>
      </div>

      {/* Role-Specific KPI Cards */}
      {metrics?.role === 'admin' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Blood Units</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{metrics.totalUnits ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Available: <span className="font-bold text-emerald-600">{metrics.availableUnits ?? 0}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Order Fulfillment</div>
            <div className="text-3xl font-extrabold text-purple-600 mt-1">{metrics.fulfillmentRate ?? 100}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.fulfilledRequests} of {metrics.totalRequests} fulfilled
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Emergency Protocols</div>
            <div className="text-3xl font-extrabold text-rose-600 mt-1">{metrics.emergencyRequests ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.totalEmergencyTransfers ?? 0} Inter-hospital transfers
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Wastage / Expiry Alert</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{metrics.expiringSoon ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Expiring in 7 days &bull; {metrics.expiredCount ?? 0} expired
            </div>
          </div>
        </div>
      )}

      {metrics?.role === 'blood_bank' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Own Stored Units</div>
            <div className="text-3xl font-extrabold text-rose-600 mt-1">{metrics.totalUnits ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.availableUnits ?? 0} Available for reservation
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lab Serology Queue</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{metrics.pendingScreening ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Awaiting viral testing clearance</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Allocated & Dispatched</div>
            <div className="text-3xl font-extrabold text-purple-600 mt-1">
              {(metrics.reservedUnits || 0) + (metrics.dispatchedUnits || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.dispatchedUnits ?? 0} Cold chain dispatches executed
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Hospital Demand</div>
            <div className="text-3xl font-extrabold text-blue-600 mt-1">{metrics.pendingRequests ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hospital requests awaiting allocation</div>
          </div>
        </div>
      )}

      {metrics?.role === 'hospital' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Orders Submitted</div>
            <div className="text-3xl font-extrabold text-blue-600 mt-1">{metrics.totalRequests ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Fulfilled: <span className="font-bold text-emerald-600">{metrics.fulfilledRequests ?? 0}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Supply Fulfillment Rate</div>
            <div className="text-3xl font-extrabold text-purple-600 mt-1">{metrics.fulfillmentRate ?? 100}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.totalUnitsAllocated ?? 0} of {metrics.totalUnitsRequested ?? 0} units allocated
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hospital Refrigerator Stock</div>
            <div className="text-3xl font-extrabold text-teal-600 mt-1">{metrics.receivedUnitsCount ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Verified received on-site</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Transfusions Logged</div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{metrics.transfusedCount ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Permanent cryptographic audit proof</div>
          </div>
        </div>
      )}

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Blood Group Availability Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Droplet className="w-4 h-4 text-rose-600" />
              <span>
                {metrics?.role === 'hospital' ? 'Hospital In-Stock Units by Group' : 'Available Inventory by Blood Group'}
              </span>
            </h2>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bloodGroupChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#c81e1e" radius={[6, 6, 0, 0]} name="Units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend or Component Breakdown Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>
                {monthlyTrendsData.length > 0 ? 'Monthly Operational Activity Trends' : 'Component Type Distribution'}
              </span>
            </h2>
          </div>

          <div className="h-64">
            {monthlyTrendsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="collections" fill="#0e9f6e" radius={[4, 4, 0, 0]} name="Collections" />
                  {monthlyTrendsData[0]?.requests !== undefined && (
                    <Bar dataKey="requests" fill="#3f83f8" radius={[4, 4, 0, 0]} name="Requests" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : componentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={componentChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {componentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No activity data recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Download Action Cards */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>One-Click Compliance & Regulatory Audit Downloads</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-xs">Inventory Ledger</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Full blood units with ABO/Rh, expiry, screening results, and data hashes.
              </div>
            </div>
            <button
              onClick={() => handleDownloadReport('inventory')}
              className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
            >
              Export Inventory CSV &rarr;
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-xs">Hospital Orders</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Clinical requests, allocated units, urgency status, and turnaround times.
              </div>
            </div>
            <button
              onClick={() => handleDownloadReport('requests')}
              className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
            >
              Export Requests CSV &rarr;
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-xs">Emergency Transfers</div>
              <div className="text-[11px] text-slate-500 mt-1">
                P2P inter-hospital transfers with measured elapsed processing minutes.
              </div>
            </div>
            <button
              onClick={() => handleDownloadReport('transfers')}
              className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
            >
              Export Transfers CSV &rarr;
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-slate-900 text-xs">Audit & Security Log</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Immutable chronological event trail with actors, actions, and blockchain hashes.
              </div>
            </div>
            <button
              onClick={() => handleDownloadReport('audit')}
              className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
            >
              Export Audit Trail CSV &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
