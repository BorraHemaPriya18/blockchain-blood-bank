import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileText,
  Filter,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  User,
  Search,
} from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/audit', { params });
      if (res.data.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-2">
            <FileText className="w-7 h-7 text-slate-800" />
            <span>Comprehensive System Audit Trail</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable chronological logging of all administrative actions, clinical state transitions, and user logins.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          >
            <option value="">All Actions</option>
            <option value="DONOR_REGISTERED">DONOR_REGISTERED</option>
            <option value="ORGANIZATION_APPROVED">ORGANIZATION_APPROVED</option>
            <option value="BLOOD_UNIT_REGISTERED">BLOOD_UNIT_REGISTERED</option>
            <option value="SCREENING_PASSED">SCREENING_PASSED</option>
            <option value="SCREENING_FAILED">SCREENING_FAILED</option>
            <option value="BLOOD_UNITS_ALLOCATED">BLOOD_UNITS_ALLOCATED</option>
            <option value="BLOOD_UNIT_DISPATCHED">BLOOD_UNIT_DISPATCHED</option>
            <option value="BLOOD_UNIT_RECEIVED">BLOOD_UNIT_RECEIVED</option>
            <option value="BLOOD_UNIT_TRANSFUSED">BLOOD_UNIT_TRANSFUSED</option>
            <option value="EMERGENCY_TRANSFER_REQUESTED">EMERGENCY_TRANSFER_REQUESTED</option>
            <option value="EMERGENCY_TRANSFER_COMPLETED">EMERGENCY_TRANSFER_COMPLETED</option>
            <option value="BLOOD_UNIT_DISCARDED">BLOOD_UNIT_DISCARDED</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Details / Blockchain Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 font-sans">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-sans">{log.actorUsername || 'System'}</td>
                    <td className="py-3 px-4 text-slate-500 font-sans capitalize">{log.actorRole || 'System'}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{log.entityId || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[200px]">
                      {log.blockchainTxHash ? (
                        <span className="text-purple-700" title={log.blockchainTxHash}>
                          Tx: {log.blockchainTxHash.slice(0, 16)}...
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans">
                          {log.details ? JSON.stringify(log.details) : 'Database state update'}
                        </span>
                      )}
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
