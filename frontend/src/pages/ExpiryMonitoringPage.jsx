import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  AlertTriangle,
  Clock,
  Trash2,
  ShieldAlert,
  Droplet,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

export default function ExpiryMonitoringPage() {
  const { user } = useAuth();
  const [expiringUnits, setExpiringUnits] = useState([]);
  const [discardedUnits, setDiscardedUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Discard Modal
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [discardReason, setDiscardReason] = useState('Expired beyond acceptable clinical shelf life');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWastageData();
  }, []);

  const fetchWastageData = async () => {
    setLoading(true);
    try {
      const [allRes, discRes] = await Promise.all([
        api.get('/blood-units'),
        api.get('/blood-units?status=discarded'),
      ]);

      if (allRes.data.success) {
        const now = new Date();
        const sevenDays = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

        // Filter units nearing expiry (within 7 days) or already expired
        const nearOrExpired = (allRes.data.units || []).filter(
          (u) =>
            !['transfused', 'discarded'].includes(u.status) &&
            new Date(u.expiryDate) <= sevenDays
        );

        setExpiringUnits(nearOrExpired);
      }

      if (discRes.data.success) {
        setDiscardedUnits(discRes.data.units || []);
      }
    } catch (err) {
      console.error('Error fetching expiry data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDiscard = async () => {
    if (!selectedUnit) return;
    setSubmitting(true);
    try {
      await api.post(`/blood-units/${selectedUnit.unitId}/discard`, {
        reason: discardReason,
      });
      alert(`Unit ${selectedUnit.unitId} safely discarded and permanently logged on-chain.`);
      setSelectedUnit(null);
      fetchWastageData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error discarding unit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-2">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
          <span>Expiry Tracking & Wastage Prevention</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Proactive monitoring of blood component shelf-life, automatic allocation blocks for expired units, and audit-safe
          disposal logging.
        </p>
      </div>

      {/* Expiry Alerts Table */}
      <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>Units Nearing or Past Expiration ({expiringUnits.length})</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            Critical Watchlist
          </span>
        </div>

        {expiringUnits.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No active blood units approaching expiry within the next 7 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 border-b border-amber-200 font-semibold text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Blood Group</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Time Remaining</th>
                  <th className="py-2.5 px-3">Current Custodian</th>
                  <th className="py-2.5 px-3 text-right">Wastage Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringUnits.map((u) => {
                  const now = new Date();
                  const exp = new Date(u.expiryDate);
                  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                  const isExpired = daysLeft <= 0;

                  return (
                    <tr key={u.unitId} className={`hover:bg-slate-50 ${isExpired ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                      <td className="py-3 px-3 font-bold text-rose-700">{u.bloodGroup}</td>
                      <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-3 px-3 font-semibold">{exp.toLocaleDateString()}</td>
                      <td className="py-3 px-3">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {daysLeft} days remaining
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{u.currentCustodian?.name || u.bloodBankName}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedUnit(u)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold inline-flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Record Disposal</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discarded & Wastage Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Trash2 className="w-5 h-5 text-slate-600" />
          <span>Historical Disposal Audit Log ({discardedUnits.length} records preserved)</span>
        </h2>
        <p className="text-xs text-slate-500">
          Disposed and expired units are never deleted; completed disposal records remain tamper-evident on the
          blockchain.
        </p>

        {discardedUnits.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">No blood units discarded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Blood Group</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Disposal Reason</th>
                  <th className="py-2.5 px-3">Responsible Organization</th>
                  <th className="py-2.5 px-3">Disposed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discardedUnits.map((u) => (
                  <tr key={u.unitId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                    <td className="py-3 px-3 font-bold text-slate-700">{u.bloodGroup}</td>
                    <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                    <td className="py-3 px-3 font-medium text-rose-700">{u.discardReason || 'Expired'}</td>
                    <td className="py-3 px-3 text-slate-600">{u.currentCustodian?.name || u.bloodBankName}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {u.discardedAt ? new Date(u.discardedAt).toLocaleDateString() : 'Recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discard Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Authorized Blood Unit Disposal
            </h3>
            <p className="text-slate-600">
              Disposing unit <span className="font-mono font-bold text-slate-900">{selectedUnit.unitId}</span> (
              {selectedUnit.bloodGroup} {selectedUnit.componentType}). This action is irreversible and recorded on the
              blockchain.
            </p>

            <div>
              <label className="font-semibold text-slate-700">Documented Disposal Reason</label>
              <select
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-lg"
              >
                <option value="Expired beyond acceptable clinical shelf life">Expired beyond acceptable clinical shelf life</option>
                <option value="Hemolysis detected upon visual quality inspection">Hemolysis detected upon visual quality inspection</option>
                <option value="Thermal excursion during cold-chain transit">Thermal excursion during cold-chain transit</option>
                <option value="Compromised container or broken seal">Compromised container or broken seal</option>
                <option value="Serology reactive / pathogen screen failed">Serology reactive / pathogen screen failed</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 border rounded-lg font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecuteDiscard}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
              >
                {submitting ? 'Recording On-Chain...' : 'Confirm Disposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
