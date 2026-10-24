import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Hospital,
  Droplet,
  PlusCircle,
  Share2,
  Package,
  Activity,
  CheckCircle,
  Clock,
  ArrowRight,
  Truck,
  ShieldCheck,
} from 'lucide-react';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [hospitalStock, setHospitalStock] = useState([]);
  const [requests, setRequests] = useState([]);
  const [dispatchedUnits, setDispatchedUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHospitalData();
  }, []);

  const fetchHospitalData = async () => {
    try {
      const [stockRes, reqRes, dispatchedRes] = await Promise.all([
        api.get('/blood-units?status=received'),
        api.get('/requests'),
        api.get('/blood-units?status=dispatched'),
      ]);

      if (stockRes.data.success) setHospitalStock(stockRes.data.units || []);
      if (reqRes.data.success) setRequests(reqRes.data.requests || []);
      if (dispatchedRes.data.success) setDispatchedUnits(dispatchedRes.data.units || []);
    } catch (err) {
      console.error('Error fetching hospital dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveUnit = async (unitId) => {
    try {
      await api.post(`/dispatch/${unitId}/receive`);
      fetchHospitalData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error receiving unit');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Authorized Hospital Clinical Node
            </span>
            <span className="text-xs text-slate-500 font-mono">License: {user?.licenseNumber || 'HOSP-LIC-101'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {user?.organizationName || 'Hospital Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit clinical blood orders, receive cold-chain shipments, request emergency transfers, and log patient
            transfusions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/requests"
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center space-x-2 text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Blood Request</span>
          </Link>
          <Link
            to="/transfers"
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center space-x-2 text-sm transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Emergency Inter-Hospital Transfer</span>
          </Link>
        </div>
      </div>

      {/* Incoming Cold-Chain Shipments Alert */}
      {dispatchedUnits.length > 0 && (
        <div className="p-5 rounded-2xl bg-cyan-50 border border-cyan-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-cyan-900 font-bold text-sm">
              <Truck className="w-5 h-5 text-cyan-700 animate-bounce" />
              <span>Incoming Cold-Chain Blood Shipments ({dispatchedUnits.length} in transit)</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dispatchedUnits.map((u) => (
              <div key={u.unitId} className="bg-white p-3 rounded-xl border border-cyan-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{u.unitId}</div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-rose-600">{u.bloodGroup}</span> {u.componentType}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Carrier: {u.shipmentDetails?.carrier || 'Medical Courier'}
                  </div>
                </div>
                <button
                  onClick={() => handleReceiveUnit(u.unitId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                >
                  Confirm Receipt
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hospital Local Cold Storage Inventory */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-teal-600" />
              <span>Hospital Blood Bank Cold Storage Inventory ({hospitalStock.length} units stored)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Physically received units ready for cross-matching, transfusion, or emergency inter-hospital transfer.
            </p>
          </div>
          <Link to="/inventory" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Search Network Stock &rarr;
          </Link>
        </div>

        {hospitalStock.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No blood units currently stored in hospital inventory. Submit a blood request to replenish.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Screening Serology</th>
                  <th className="py-2.5 px-3 text-right">Clinical Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospitalStock.map((u) => (
                  <tr key={u.unitId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      <Link to={`/units/${u.unitId}`} className="hover:text-rose-600 underline">
                        {u.unitId}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-700">{u.bloodGroup}</td>
                    <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                    <td className="py-3 px-3 text-slate-500">{new Date(u.expiryDate).toLocaleDateString()}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Passed (HIV/HBV/HCV Negative)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <Link
                        to={`/dispatch`}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold inline-flex items-center space-x-1"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Transfuse Patient</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hospital Blood Requests History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <span>Recent Clinical Blood Orders</span>
          </h2>
          <Link to="/requests" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Manage All Orders &rarr;
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">No blood requests submitted yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.slice(0, 5).map((req) => (
              <div key={req.requestId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">{req.requestId}</span>
                    <StatusBadge status={req.status} />
                    <StatusBadge status={req.urgency} />
                  </div>
                  <div className="text-slate-500 mt-1">
                    Group: <span className="font-bold text-rose-700">{req.bloodGroup}</span> | Component: {req.componentType} | Qty: {req.quantity}
                  </div>
                </div>
                <div className="text-right text-slate-400">
                  <div>Patient Ref: {req.patientRefId}</div>
                  <div className="text-[11px]">{new Date(req.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
