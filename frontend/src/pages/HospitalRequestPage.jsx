import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  PackageCheck,
  PlusCircle,
  Clock,
  Droplet,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Building2,
  Truck,
} from 'lucide-react';

// Compatibility rule check for frontend guidance
function getCompatibleDonorGroups(recipientGroup) {
  switch (recipientGroup) {
    case 'O-': return ['O-'];
    case 'O+': return ['O-', 'O+'];
    case 'A-': return ['O-', 'A-'];
    case 'A+': return ['O-', 'O+', 'A-', 'A+'];
    case 'B-': return ['O-', 'B-'];
    case 'B+': return ['O-', 'O+', 'B-', 'B+'];
    case 'AB-': return ['O-', 'A-', 'B-', 'AB-'];
    case 'AB+': return ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    default: return [recipientGroup];
  }
}

export default function HospitalRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Request Form State
  const [showModal, setShowModal] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [componentType, setComponentType] = useState('Whole Blood');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState('urgent');
  const [patientRefId, setPatientRefId] = useState('PT-SURGERY-101');
  const [targetBankId, setTargetBankId] = useState('');
  const [requiredByDate, setRequiredByDate] = useState(
    new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [remarks, setRemarks] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState(null);

  // Allocation Modal State (for Blood Bank Staff)
  const [allocatingRequest, setAllocatingRequest] = useState(null);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [allocatingLoading, setAllocatingLoading] = useState(false);
  const [allocationSuccessMsg, setAllocationSuccessMsg] = useState(null);

  useEffect(() => {
    fetchRequests();
    fetchBloodBanks();
    if (user?.role === 'blood_bank' || user?.role === 'admin') {
      fetchAvailableStock();
    }
  }, [statusFilter, urgencyFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (urgencyFilter !== 'all') params.urgency = urgencyFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/requests', { params });
      if (res.data.success) {
        setRequests(res.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBloodBanks = async () => {
    try {
      const res = await api.get('/auth/users');
      if (res.data.success) {
        const banks = (res.data.users || []).filter(
          (u) => u.role === 'blood_bank' && u.isApproved
        );
        setBloodBanks(banks);
      }
    } catch (err) {
      console.warn('Could not load blood banks list:', err.message);
    }
  };

  const fetchAvailableStock = async () => {
    try {
      const res = await api.get('/blood-units?status=available');
      if (res.data.success) {
        setAvailableUnits(res.data.units || []);
      }
    } catch (err) {
      console.error('Error fetching available stock:', err);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setError(null);
    setFormLoading(true);

    try {
      const res = await api.post('/requests', {
        bloodGroup,
        componentType,
        quantity: Number(quantity),
        urgency,
        patientRefId,
        bloodBankId: targetBankId || null,
        requiredByDate: requiredByDate ? new Date(requiredByDate).toISOString() : undefined,
        remarks,
      });

      if (res.data.success) {
        setShowModal(false);
        setRemarks('');
        fetchRequests();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error submitting request.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenAllocate = (reqItem) => {
    setAllocatingRequest(reqItem);
    setAllocationSuccessMsg(null);
    const compatibleGroups = getCompatibleDonorGroups(reqItem.bloodGroup);

    // Eligible units matching component and compatible blood groups
    const matching = availableUnits.filter(
      (u) =>
        u.componentType === reqItem.componentType &&
        compatibleGroups.includes(u.bloodGroup)
    );

    // Auto-select up to requested quantity
    const defaultSelected = matching.slice(0, reqItem.quantity).map((u) => u.unitId);
    setSelectedUnits(defaultSelected);
  };

  const handleExecuteAllocation = async () => {
    if (!allocatingRequest || selectedUnits.length === 0) return;
    setAllocatingLoading(true);
    try {
      const res = await api.post(`/requests/${allocatingRequest.requestId}/allocate`, {
        unitIds: selectedUnits,
      });
      if (res.data.success) {
        setAllocationSuccessMsg(res.data.message);
        fetchRequests();
        fetchAvailableStock();
        setTimeout(() => {
          setAllocatingRequest(null);
          setAllocationSuccessMsg(null);
        }, 1500);
      } else {
        alert(res.data.message || (res.data.errors && res.data.errors.join('; ')));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error allocating units');
    } finally {
      setAllocatingLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.requestId?.toLowerCase().includes(q) ||
      r.hospitalName?.toLowerCase().includes(q) ||
      r.bloodBankName?.toLowerCase().includes(q) ||
      r.patientRefId?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-2">
            <PackageCheck className="w-7 h-7 text-purple-600" />
            <span>Hospital Blood Orders & Allocation</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit clinical blood orders with urgency priorities, allocate verified stock, and track supply fulfillment.
          </p>
        </div>

        {(user?.role === 'hospital' || user?.role === 'admin') && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center space-x-2 text-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Blood Request</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Request ID, Hospital, Blood Bank, or Patient Ref..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <span className="font-semibold text-slate-600">Urgency:</span>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium bg-white"
            >
              <option value="all">All Urgencies</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading blood requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-sm">No blood requests match your filters.</div>
            <p className="text-xs text-slate-400">Submit a new request or adjust filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Requesting Hospital</th>
                  <th className="py-3 px-4">Target Blood Bank</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Component</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Allocated Units</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((r) => (
                  <tr key={r.requestId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{r.requestId}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{r.hospitalName}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px]">
                        {r.bloodBankName || 'All Available'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-sm text-rose-700">{r.bloodGroup}</td>
                    <td className="py-3.5 px-4 text-slate-600">{r.componentType}</td>
                    <td className="py-3.5 px-4 font-bold">{r.quantity}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={r.urgency} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                      <div>Req: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</div>
                      <div className="text-slate-400">
                        Due: {r.requiredByDate ? new Date(r.requiredByDate).toLocaleDateString() : 'ASAP'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.allocatedUnits && r.allocatedUnits.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.allocatedUnits.map((uId) => (
                            <Link
                              key={uId}
                              to={`/units/${uId}`}
                              className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-rose-700 font-bold hover:underline"
                            >
                              {uId}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None reserved</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {(user?.role === 'blood_bank' || user?.role === 'admin') && r.status === 'pending' && (
                        <button
                          onClick={() => handleOpenAllocate(r)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Allocate Units
                        </button>
                      )}
                      {r.status === 'approved' && (user?.role === 'blood_bank' || user?.role === 'admin') && (
                        <Link
                          to="/dispatch"
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold text-xs inline-flex items-center space-x-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Submit Hospital Blood Order</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Required Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-rose-700"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Component</label>
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Whole Blood">Whole Blood</option>
                    <option value="Red Blood Cells">Red Blood Cells</option>
                    <option value="Platelets">Platelets</option>
                    <option value="Plasma">Plasma</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Quantity of Units</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Urgency Priority</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="normal">Normal (Routine)</option>
                    <option value="urgent">Urgent (&lt; 24h)</option>
                    <option value="emergency">EMERGENCY (&lt; 2h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Target Blood Bank (Optional)</label>
                <select
                  value={targetBankId}
                  onChange={(e) => setTargetBankId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  <option value="">All Available Blood Banks (Broadcast Open Order)</option>
                  {bloodBanks.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.organizationName || b.username} ({b.licenseNumber || 'Licensed'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Required By Date & Time</label>
                <input
                  type="datetime-local"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Pseudonymized Patient Reference ID</label>
                <input
                  type="text"
                  required
                  value={patientRefId}
                  onChange={(e) => setPatientRefId(e.target.value)}
                  placeholder="e.g. PT-SURGERY-101"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Ensures zero exposed patient PII on public blockchain.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Clinical Indication / Remarks</label>
                <textarea
                  rows="2"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Clinical surgery details, cross-match requirements..."
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocation Modal for Blood Bank */}
      {allocatingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Allocate Units to Request {allocatingRequest.requestId}
              </h3>
              <button
                onClick={() => setAllocatingRequest(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {allocationSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{allocationSuccessMsg}</span>
              </div>
            )}

            <div className="p-3 bg-purple-50 rounded-xl space-y-1">
              <div>
                Hospital: <span className="font-bold text-purple-900">{allocatingRequest.hospitalName}</span>
              </div>
              <div>
                Requirement:{' '}
                <span className="font-bold text-rose-700">{allocatingRequest.bloodGroup}</span>{' '}
                {allocatingRequest.componentType} ({allocatingRequest.quantity} units requested)
              </div>
              <div className="text-[11px] text-purple-700">
                Compatible ABO Groups:{' '}
                <span className="font-mono font-semibold">
                  {getCompatibleDonorGroups(allocatingRequest.bloodGroup).join(', ')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Select Available Compatible Units to Reserve:</span>
                <span className="text-[11px] font-bold text-purple-700">
                  Selected: {selectedUnits.length} / {allocatingRequest.quantity}
                </span>
              </div>

              {availableUnits.filter(
                (u) =>
                  u.componentType === allocatingRequest.componentType &&
                  getCompatibleDonorGroups(allocatingRequest.bloodGroup).includes(u.bloodGroup)
              ).length === 0 ? (
                <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center space-y-2 text-slate-500">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="font-bold text-slate-700">No Compatible Available Units in Stock</div>
                  <p className="text-[11px] text-slate-400">
                    No approved {allocatingRequest.componentType} units matching groups (
                    {getCompatibleDonorGroups(allocatingRequest.bloodGroup).join(', ')}) are currently available.
                  </p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border rounded-xl p-2">
                  {availableUnits
                    .filter(
                      (u) =>
                        u.componentType === allocatingRequest.componentType &&
                        getCompatibleDonorGroups(allocatingRequest.bloodGroup).includes(u.bloodGroup)
                    )
                    .map((u) => {
                      const isSelected = selectedUnits.includes(u.unitId);
                      const isExactMatch = u.bloodGroup === allocatingRequest.bloodGroup;
                      return (
                        <div
                          key={u.unitId}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUnits(selectedUnits.filter((id) => id !== u.unitId));
                            } else {
                              setSelectedUnits([...selectedUnits, u.unitId]);
                            }
                          }}
                          className={`p-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-purple-100/70 border border-purple-300 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-slate-900">{u.unitId}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                {u.bloodGroup}
                              </span>
                              {!isExactMatch && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                  Universal/Compatible
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Exp: {new Date(u.expiryDate).toLocaleDateString()} &bull; Custodian:{' '}
                              {u.currentCustodian?.name || 'Blood Bank'}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : '+ Select'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setAllocatingRequest(null)}
                className="px-4 py-2 border rounded-lg font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedUnits.length === 0 || allocatingLoading}
                onClick={handleExecuteAllocation}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
              >
                {allocatingLoading ? 'Securing on Ledger...' : `Confirm Allocation (${selectedUnits.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
