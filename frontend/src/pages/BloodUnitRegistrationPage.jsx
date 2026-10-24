import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Droplet,
  PlusCircle,
  ShieldCheck,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

const SHELF_LIFE_DAYS = {
  'Whole Blood': 35,
  'Red Blood Cells': 42,
  Platelets: 5,
  Plasma: 365,
};

export default function BloodUnitRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [donorRefId, setDonorRefId] = useState('DNR-2026-001');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [componentType, setComponentType] = useState('Whole Blood');
  const [volumeMl, setVolumeMl] = useState(450);
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [customUnitId, setCustomUnitId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Compute preview expiry
  const colDateObj = new Date(collectionDate || Date.now());
  const expiryPreview = new Date(colDateObj.getTime() + (SHELF_LIFE_DAYS[componentType] || 35) * 24 * 3600 * 1000);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/blood-units', {
        donorRefId,
        bloodGroup,
        componentType,
        volumeMl: Number(volumeMl),
        collectionDate,
        customUnitId: customUnitId || undefined,
      });

      if (res.data.success) {
        navigate(`/units/${res.data.unit.unitId}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error registering blood unit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        to="/bloodbank-dashboard"
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Blood Bank Dashboard</span>
      </Link>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6 sm:p-10 space-y-6">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-200 mb-3">
            <PlusCircle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Record Blood Donation & Register Unit</h1>
          <p className="text-xs text-slate-500 mt-1">
            Logs collection metadata, assigns an immutable unit identifier, calculates component shelf life, and writes
            initial cryptographic integrity hash to the blockchain ledger.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Donor Reference ID</label>
              <input
                type="text"
                required
                value={donorRefId}
                onChange={(e) => setDonorRefId(e.target.value)}
                placeholder="e.g. DNR-2026-001"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-rose-500 focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Pseudonymized donor reference identifier</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Custom Unit ID <span className="text-slate-400 font-normal">(Leave blank to auto-generate)</span>
              </label>
              <input
                type="text"
                value={customUnitId}
                onChange={(e) => setCustomUnitId(e.target.value)}
                placeholder="e.g. BLD-2026-9051"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">ABO/Rh Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-rose-700 focus:ring-rose-500 focus:border-rose-500"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Blood Component Type</label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="Whole Blood">Whole Blood (Standard 35-day shelf life)</option>
                <option value="Red Blood Cells">Red Blood Cells (PRBC - 42-day shelf life)</option>
                <option value="Platelets">Platelets (RDP/SDP - 5-day shelf life)</option>
                <option value="Plasma">Fresh Frozen Plasma (FFP - 365-day shelf life)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Volume (mL)</label>
              <input
                type="number"
                min="100"
                max="600"
                value={volumeMl}
                onChange={(e) => setVolumeMl(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Collection Date</label>
              <input
                type="date"
                required
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Expiry and Safety Preview Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Calculated Expiry Date:</span>
              <span className="font-bold text-slate-900">{expiryPreview.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Responsible Custodian:</span>
              <span className="font-medium text-slate-600">{user?.organizationName || user?.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Initial State:</span>
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Collected (Pending Lab Screening)
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-md shadow-rose-200 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Recording On-Chain & In Database...' : 'Register Blood Unit on Blockchain'}
          </button>
        </form>
      </div>
    </div>
  );
}
