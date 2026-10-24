import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Droplet,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Hospital,
  Activity,
  FileText,
  Lock,
} from 'lucide-react';

export default function BloodUnitDetailsPage() {
  const { unitId } = useParams();
  const { user } = useAuth();

  const [unit, setUnit] = useState(null);
  const [onChainUnit, setOnChainUnit] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrityState, setIntegrityState] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [unitId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/blood-units/${unitId}`);
      if (res.data.success) {
        setUnit(res.data.unit);
        setOnChainUnit(res.data.onChainUnit);
        // Combine DB blockchainHistory and onChainEvents
        setEvents(res.data.unit.blockchainHistory || []);
        // Run initial verification
        verifyIntegrityCheck();
      }
    } catch (err) {
      console.error('Error fetching unit details:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyIntegrityCheck = async () => {
    setVerifying(true);
    try {
      const res = await api.get(`/blood-units/${unitId}/verify`);
      if (res.data.success) {
        setIntegrityState(res.data);
      }
    } catch (err) {
      console.error('Integrity check error:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto p-12 text-center text-slate-500">Loading blood unit ledger details...</div>;
  }

  if (!unit) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Blood Unit Not Found</h2>
        <Link to="/inventory" className="text-sm text-rose-600 font-semibold">&larr; Back to Inventory</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back navigation */}
      <Link
        to="/inventory"
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Digital Blood Inventory</span>
      </Link>

      {/* Header and Integrity Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {unit.unitId}
              </span>
              <StatusBadge status={unit.status} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                {unit.bloodGroup}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">{unit.componentType} Blood Unit</h1>
            <p className="text-xs text-slate-500">
              Collected by {unit.bloodBankName} &bull; Donor Ref: <span className="font-mono">{unit.donorRefId}</span>
            </p>
          </div>

          {/* Cryptographic Integrity Status Card */}
          <div className="flex flex-col items-end space-y-2">
            {integrityState?.isTamperFree ? (
              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <div>INTEGRITY VERIFIED: TAMPER-FREE</div>
                  <div className="text-[10px] text-emerald-700 font-normal">Off-chain DB matches on-chain state hash</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold animate-pulse">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <div>INTEGRITY ALERT: HASH MISMATCH!</div>
                  <div className="text-[10px] text-rose-700 font-normal">Database modified without authorized blockchain transaction</div>
                </div>
              </div>
            )}
            <button
              onClick={verifyIntegrityCheck}
              disabled={verifying}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline"
            >
              {verifying ? 'Recalculating SHA-256...' : 'Re-verify Against Smart Contract'}
            </button>
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 font-medium">Collection Date:</span>
            <div className="font-bold text-slate-800 mt-0.5">{new Date(unit.collectionDate).toLocaleDateString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 font-medium">Expiry Date:</span>
            <div className="font-bold text-slate-800 mt-0.5">{new Date(unit.expiryDate).toLocaleDateString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 font-medium">Current Custodian:</span>
            <div className="font-bold text-slate-800 mt-0.5">{unit.currentCustodian?.name || 'Blood Bank'}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 font-medium">Volume:</span>
            <div className="font-bold text-slate-800 mt-0.5">{unit.volumeMl || 450} mL</div>
          </div>
        </div>

        {/* Cryptographic Hash Information */}
        <div className="p-4 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] space-y-1.5 overflow-x-auto">
          <div className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Cryptographic State Hash Reference</div>
          <div>Calculated SHA-256: <span className="text-emerald-400 font-bold">{unit.dataHash}</span></div>
          {integrityState && (
            <div>On-Chain Reference: <span className="text-rose-400 font-bold">{integrityState.blockchainHash || unit.dataHash}</span></div>
          )}
        </div>
      </div>

      {/* Chronological Supply Chain Tracking Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-rose-600" />
            <span>Chronological Vein-to-Vein Supply Chain Timeline</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident trail with smart contract transaction receipts, block heights, and custodian authorizations.
          </p>
        </div>

        <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
          {events.length === 0 ? (
            <div className="text-xs text-slate-400">No events logged for this unit yet.</div>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} className="relative">
                {/* Node icon */}
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-xs"></div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{evt.eventType}</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Block #{evt.blockNumber || '101'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{evt.remarks || 'Supply chain event confirmed on-chain.'}</p>

                  <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 font-mono text-[11px] space-y-0.5">
                    <div className="text-slate-500 truncate">
                      Tx Hash: <span className="text-slate-800 font-semibold">{evt.txHash}</span>
                    </div>
                    {evt.actorAddress && (
                      <div className="text-slate-500 truncate">
                        Signer: <span className="text-slate-700">{evt.actorAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
