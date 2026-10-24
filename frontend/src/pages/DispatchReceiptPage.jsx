import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Truck,
  Package,
  Activity,
  CheckCircle2,
  Clock,
  Droplet,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function DispatchReceiptPage() {
  const { user } = useAuth();
  const [reservedUnits, setReservedUnits] = useState([]);
  const [dispatchedUnits, setDispatchedUnits] = useState([]);
  const [hospitalStock, setHospitalStock] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dispatch modal
  const [dispatchingUnit, setDispatchingUnit] = useState(null);
  const [shipmentRef, setShipmentRef] = useState('');
  const [carrier, setCarrier] = useState('Medical Cold Logistics Express');
  const [temperature, setTemperature] = useState(4.0);

  // Transfusion modal
  const [transfusingUnit, setTransfusingUnit] = useState(null);
  const [patientRefId, setPatientRefId] = useState('PT-ICU-8821');
  const [notes, setNotes] = useState('Cross-matched and administered successfully.');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [resRes, dispRes, hospRes] = await Promise.all([
        api.get('/blood-units?status=reserved'),
        api.get('/blood-units?status=dispatched'),
        api.get('/blood-units?status=received'),
      ]);

      if (resRes.data.success) setReservedUnits(resRes.data.units || []);
      if (dispRes.data.success) setDispatchedUnits(dispRes.data.units || []);
      if (hospRes.data.success) setHospitalStock(hospRes.data.units || []);
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispatch = (u) => {
    setDispatchingUnit(u);
    setShipmentRef(`WAYBILL-${Date.now().toString().slice(-6)}-COLD`);
  };

  const handleExecuteDispatch = async () => {
    if (!dispatchingUnit) return;
    try {
      await api.post(`/dispatch/${dispatchingUnit.unitId}`, {
        shipmentRef,
        carrier,
        temperatureCelsius: Number(temperature),
      });
      alert(`Unit ${dispatchingUnit.unitId} dispatched under cold chain conditions.`);
      setDispatchingUnit(null);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error dispatching unit');
    }
  };

  const handleReceive = async (unitId) => {
    try {
      await api.post(`/dispatch/${unitId}/receive`);
      alert(`Unit ${unitId} custody accepted and verified by hospital.`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error acknowledging receipt');
    }
  };

  const handleExecuteTransfusion = async () => {
    if (!transfusingUnit) return;
    try {
      await api.post(`/dispatch/${transfusingUnit.unitId}/transfuse`, {
        patientRefId,
        clinicalNotes: notes,
      });
      alert(`Transfusion for unit ${transfusingUnit.unitId} recorded permanently.`);
      setTransfusingUnit(null);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording transfusion');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-2">
          <Truck className="w-7 h-7 text-cyan-600" />
          <span>Cold Chain Dispatch & Hospital Receipt Management</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Verifiable transfer of custody from blood bank storage through refrigerated transit to clinical transfusion.
        </p>
      </div>

      {/* 1. Reserved Units Awaiting Dispatch (Blood Bank) */}
      {(user?.role === 'blood_bank' || user?.role === 'admin') && (
        <div className="bg-white rounded-2xl border border-purple-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-purple-600" />
              <span>Reserved Units Awaiting Cold Chain Dispatch ({reservedUnits.length})</span>
            </h2>
          </div>

          {reservedUnits.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">No reserved units waiting to be dispatched.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-purple-50/50 border-b border-purple-200 font-semibold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Unit ID</th>
                    <th className="py-2.5 px-3">Group</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3">Destination Hospital</th>
                    <th className="py-2.5 px-3">Order Ref</th>
                    <th className="py-2.5 px-3 text-right">Dispatch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservedUnits.map((u) => (
                    <tr key={u.unitId} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                      <td className="py-3 px-3 font-bold text-rose-700">{u.bloodGroup}</td>
                      <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{u.reservedHospital?.name || 'Hospital'}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{u.hospitalRequestId}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleOpenDispatch(u)}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch Courier</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. Dispatched Units In Transit (Hospital Acknowledges Receipt) */}
      <div className="bg-white rounded-2xl border border-cyan-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Truck className="w-5 h-5 text-cyan-600" />
            <span>Blood Shipments in Active Transit ({dispatchedUnits.length})</span>
          </h2>
        </div>

        {dispatchedUnits.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">No blood units currently in transit.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyan-50/50 border-b border-cyan-200 font-semibold text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Group & Component</th>
                  <th className="py-2.5 px-3">Carrier / Courier</th>
                  <th className="py-2.5 px-3">Waybill Reference</th>
                  <th className="py-2.5 px-3">Transit Temp</th>
                  <th className="py-2.5 px-3 text-right">Hospital Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatchedUnits.map((u) => (
                  <tr key={u.unitId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {u.bloodGroup} {u.componentType}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{u.shipmentDetails?.carrier}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{u.shipmentDetails?.shipmentRef}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                        {u.shipmentDetails?.temperatureCelsius || 4.0} °C
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {(user?.role === 'hospital' || user?.role === 'admin') && (
                        <button
                          onClick={() => handleReceive(u.unitId)}
                          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept & Receive</span>
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

      {/* 3. Hospital Stored Inventory & Patient Transfusion Administration */}
      {(user?.role === 'hospital' || user?.role === 'admin') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <span>Hospital Stored Units Ready for Clinical Transfusion ({hospitalStock.length})</span>
            </h2>
          </div>

          {hospitalStock.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No units currently in hospital cold storage.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Unit ID</th>
                    <th className="py-2.5 px-3">Blood Group</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Received Time</th>
                    <th className="py-2.5 px-3 text-right">Administration Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hospitalStock.map((u) => (
                    <tr key={u.unitId} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.unitId}</td>
                      <td className="py-3 px-3 font-bold text-rose-700">{u.bloodGroup}</td>
                      <td className="py-3 px-3 text-slate-600">{u.componentType}</td>
                      <td className="py-3 px-3 text-slate-500">{new Date(u.expiryDate).toLocaleDateString()}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {u.shipmentDetails?.receivedAt ? new Date(u.shipmentDetails.receivedAt).toLocaleTimeString() : 'Stored'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setTransfusingUnit(u)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Record Transfusion</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Cold Chain Dispatch for {dispatchingUnit.unitId}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700">Waybill Shipment Reference</label>
                <input
                  type="text"
                  value={shipmentRef}
                  onChange={(e) => setShipmentRef(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Refrigerated Logistics Carrier</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Storage Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchingUnit(null)}
                className="px-4 py-2 border rounded-lg font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDispatch}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfusion Modal */}
      {transfusingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Record Patient Transfusion for {transfusingUnit.unitId}
            </h3>
            <p className="text-slate-600">
              Administering <span className="font-bold text-rose-700">{transfusingUnit.bloodGroup}</span>{' '}
              {transfusingUnit.componentType}. A pseudonymized hash will be committed to the blockchain.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700">Hospital Patient Reference ID</label>
                <input
                  type="text"
                  value={patientRefId}
                  onChange={(e) => setPatientRefId(e.target.value)}
                  placeholder="e.g. PT-ICU-8821"
                  className="mt-1 block w-full px-3 py-2 border rounded-lg font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Patient identity remains confidential; only the SHA-256 hash is recorded on-chain.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Clinical Transfusion Outcome</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setTransfusingUnit(null)}
                className="px-4 py-2 border rounded-lg font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfusion}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Confirm & Seal On-Chain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
