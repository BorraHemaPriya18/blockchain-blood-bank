import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Share2,
  AlertTriangle,
  Hospital,
  Clock,
  CheckCircle2,
  ArrowRight,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function EmergencyTransferPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [compatibleUnits, setCompatibleUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search parameters for emergency compatible stock
  const [searchBloodGroup, setSearchBloodGroup] = useState('O+');
  const [searchComponent, setSearchComponent] = useState('Whole Blood');
  const [searching, setSearching] = useState(false);

  // Request Transfer Modal
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [urgency, setUrgency] = useState('CRITICAL');
  const [reason, setReason] = useState('Emergency trauma surgery shortage');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTransfers();
    searchOtherHospitals();
  }, []);

  const fetchTransfers = async () => {
    try {
      const res = await api.get('/transfers');
      if (res.data.success) {
        setTransfers(res.data.transfers || []);
      }
    } catch (err) {
      console.error('Error fetching emergency transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchOtherHospitals = async () => {
    setSearching(true);
    try {
      const res = await api.get('/transfers/search-compatible', {
        params: { bloodGroup: searchBloodGroup, componentType: searchComponent },
      });
      if (res.data.success) {
        setCompatibleUnits(res.data.units || []);
      }
    } catch (err) {
      console.error('Error searching compatible hospital inventory:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleRequestTransfer = async () => {
    if (!selectedUnit) return;
    setSubmitting(true);
    try {
      const res = await api.post('/transfers', {
        unitId: selectedUnit.unitId,
        urgency,
        reason,
      });

      if (res.data.success) {
        alert('Emergency transfer initiated and broadcasted to supplying hospital!');
        setSelectedUnit(null);
        fetchTransfers();
        searchOtherHospitals();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating emergency transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTransfer = async (transferId) => {
    try {
      const res = await api.post(`/transfers/${transferId}/complete`);
      if (res.data.success) {
        alert(res.data.message);
        fetchTransfers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error completing transfer');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
              Workflow D &bull; Emergency P2P Protocol
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 flex items-center space-x-2">
            <Share2 className="w-7 h-7 text-rose-600" />
            <span>Emergency Inter-Hospital Blood Transfer</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Decentralized hospital-to-hospital direct blood exchange solving emergency transportation delays via
            smart contract validation.
          </p>
        </div>
      </div>

      {/* Emergency Stock Search in Partner Hospitals */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Search className="w-5 h-5 text-rose-600" />
              <span>Search Available Blood Units in Other Registered Hospitals</span>
            </h2>
            <p className="text-xs text-slate-500">
              Locate excess or compatible emergency inventory stored across neighboring clinical networks.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <select
              value={searchBloodGroup}
              onChange={(e) => setSearchBloodGroup(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-rose-700"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <select
              value={searchComponent}
              onChange={(e) => setSearchComponent(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg"
            >
              <option value="Whole Blood">Whole Blood</option>
              <option value="Red Blood Cells">Red Blood Cells</option>
              <option value="Platelets">Platelets</option>
              <option value="Plasma">Plasma</option>
            </select>
            <button
              onClick={searchOtherHospitals}
              disabled={searching}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
            >
              {searching ? 'Searching...' : 'Search Network'}
            </button>
          </div>
        </div>

        {compatibleUnits.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No compatible units currently stored in partner hospitals for {searchBloodGroup} {searchComponent}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {compatibleUnits.map((u) => (
              <div
                key={u.unitId}
                className="p-4 bg-slate-50 hover:bg-rose-50/40 rounded-xl border border-slate-200 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">{u.unitId}</span>
                    <span className="font-extrabold text-sm text-rose-700">{u.bloodGroup}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{u.componentType}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Custodian Hospital: <span className="font-semibold text-slate-800">{u.currentCustodian?.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Expiry: {new Date(u.expiryDate).toLocaleDateString()}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUnit(u)}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Request Emergency Transfer &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Transfers Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-slate-700" />
          <span>Inter-Hospital Emergency Transfer History & Measured Processing Times</span>
        </h2>
        <p className="text-xs text-slate-500">
          Timestamps and elapsed duration measured from actual smart contract transactions (no hypothetical claims).
        </p>

        {transfers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">No emergency transfers logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Transfer ID</th>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Requesting Hospital</th>
                  <th className="py-2.5 px-3">Supplying Hospital</th>
                  <th className="py-2.5 px-3">Urgency</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamps</th>
                  <th className="py-2.5 px-3">Elapsed Time</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
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
                    <td className="py-3 px-3 font-semibold text-slate-900">{t.requestingHospitalName}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{t.supplyingHospitalName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white">
                        {t.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                      <div>Req: {t.timestamps?.requestedAt ? new Date(t.timestamps.requestedAt).toLocaleTimeString() : 'N/A'}</div>
                      {t.timestamps?.completedAt && (
                        <div className="text-emerald-700">Done: {new Date(t.timestamps.completedAt).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {t.elapsedTimeMinutes ? (
                        <span className="font-bold text-emerald-700">{t.elapsedTimeMinutes} mins (Measured)</span>
                      ) : (
                        <span className="text-slate-400 italic">In progress</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {t.status === 'requested' && (
                        <button
                          onClick={() => handleCompleteTransfer(t.transferId)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs cursor-pointer"
                        >
                          Complete Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Emergency Transfer Request
            </h3>
            <p className="text-slate-600">
              Requesting transfer of unit <span className="font-mono font-bold text-slate-900">{selectedUnit.unitId}</span> ({selectedUnit.bloodGroup} {selectedUnit.componentType}) from{' '}
              <span className="font-bold text-slate-800">{selectedUnit.currentCustodian?.name}</span>.
            </p>

            <div>
              <label className="font-semibold text-slate-700">Clinical Emergency Reason</label>
              <textarea
                rows="2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-lg"
              ></textarea>
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
                onClick={handleRequestTransfer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
              >
                {submitting ? 'Broadcasting On-Chain...' : 'Broadcast Emergency Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
