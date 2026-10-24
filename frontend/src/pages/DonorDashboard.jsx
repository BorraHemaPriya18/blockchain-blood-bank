import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Heart,
  Droplet,
  ShieldCheck,
  Calendar,
  Award,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  SmilePlus,
  Info,
} from 'lucide-react';

export default function DonorDashboard() {
  const { user, profile } = useAuth();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    try {
      const res = await api.get('/blood-units');
      if (res.data.success) {
        setUnits(res.data.units || []);
      }
    } catch (err) {
      console.error('Error fetching donor units:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Donor Header & Badge */}
      <div className="bg-gradient-to-r from-rose-600 to-red-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-rose-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-rose-100">
                  Registered Voluntary Donor
                </span>
                <span className="font-mono text-xs text-rose-100">ID: {user?.donorRefId || 'DNR-REF'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
                Welcome, {profile?.fullName || user?.username}
              </h1>
              <p className="text-rose-100 text-sm mt-1 max-w-xl">
                Thank you for contributing to the decentralized blood supply. Your donations are tracked with
                privacy-preserving blockchain tokens.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-black">{profile?.totalDonations || units.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-rose-200 font-semibold">Total Donations</div>
            </div>
            <div className="h-8 w-px bg-white/20 mx-2"></div>
            <div className="text-center">
              <div className="text-3xl font-black text-rose-200">{profile?.bloodGroup || 'O+'}</div>
              <div className="text-[11px] uppercase tracking-wider text-rose-200 font-semibold">Blood Group</div>
            </div>
          </div>
        </div>
      </div>

      {/* Traceability Status of Donated Blood */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Droplet className="w-5 h-5 text-rose-600" />
              <span>Your Donated Blood Units & Traceability Status</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Follow your blood unit's journey through screening, inventory storage, hospital transit, and patient outcome.
            </p>
          </div>
          <Link
            to="/inventory"
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
          >
            <span>View Public Digital Inventory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading your donation records...</div>
        ) : units.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <Droplet className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm">No donations recorded yet under donor ID {user?.donorRefId}.</p>
            <p className="text-xs text-slate-400">
              When an authorized blood bank collects your blood, your unit will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {units.map((unit) => (
              <div key={unit.unitId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{unit.unitId}</span>
                    <StatusBadge status={unit.status} />
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-50 text-rose-700">
                      {unit.bloodGroup}
                    </span>
                    <span className="text-xs text-slate-500">{unit.componentType}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center space-x-4">
                    <span>Collected: {new Date(unit.collectionDate).toLocaleDateString()}</span>
                    <span>Blood Bank: {unit.bloodBankName}</span>
                    {unit.status === 'transfused' && (
                      <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Transfused to Save a Life</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    to={`/units/${unit.unitId}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1"
                  >
                    <span>Trace Timeline</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Donor Eligibility Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Eligibility Status</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Status: <span className="font-bold text-emerald-600 uppercase">Eligible</span>. Safe interval between whole
            blood donations is 56 days (8 weeks).
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <SmilePlus className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Affective State Check</h3>
          {profile?.affectiveCheck?.enabled ? (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                Detected: <span className="font-bold text-indigo-700">{profile.affectiveCheck.emotionDetected}</span>
                {' '}({(profile.affectiveCheck.confidenceScore * 100).toFixed(0)}% confidence)
                {profile.affectiveCheck.underDuressFlag
                  ? <span className="ml-1 text-rose-600 font-semibold">— Duress flag raised; manual review recommended.</span>
                  : <span className="ml-1 text-emerald-600 font-semibold">— No duress indicators.</span>}
              </p>
              <div className="flex items-start space-x-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>SSRN paper §5 demo only. Facial expressions are never treated as proof of consent and never block genuine donors.</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed">
              Not performed during registration. This optional demo feature (SSRN paper §5) detects potential coercion
              via facial expression analysis. Manual verification always takes precedence.
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Next Suggested Donation</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ready for voluntary donation. Find an authorized blood bank nearby or schedule your next appointment.
          </p>
        </div>
      </div>
    </div>
  );
}
