import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import {
  Droplet,
  Search,
  Filter,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

export default function InventoryPage() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [componentType, setComponentType] = useState('');
  const [status, setStatus] = useState('');
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);

  useEffect(() => {
    fetchInventory();
  }, [bloodGroup, componentType, status]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (bloodGroup) params.bloodGroup = bloodGroup;
      if (componentType) params.componentType = componentType;
      if (status) params.status = status;
      if (search) params.search = search;

      const res = await api.get('/blood-units', { params });
      if (res.data.success) {
        setUnits(res.data.units || []);
        setExpiringSoonCount(res.data.expiringSoonCount || 0);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Droplet className="w-7 h-7 text-rose-600 fill-rose-600" />
            <span>Digital Blood Inventory Ledger</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time, verifiable blood stock across all participating blood banks and clinical hospitals.
          </p>
        </div>

        {expiringSoonCount > 0 && (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{expiringSoonCount} unit(s) expiring within 7 days</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Unit ID, Blood Bank, or Donor ID..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="">All Blood Groups</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={componentType}
              onChange={(e) => setComponentType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="">All Components</option>
              <option value="Whole Blood">Whole Blood (35 days)</option>
              <option value="Red Blood Cells">Red Blood Cells (42 days)</option>
              <option value="Platelets">Platelets (5 days)</option>
              <option value="Plasma">Plasma (365 days)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="">All Statuses</option>
              <option value="available">Available in Stock</option>
              <option value="collected">Collected</option>
              <option value="pending_screening">Pending Screening</option>
              <option value="reserved">Reserved</option>
              <option value="dispatched">Dispatched</option>
              <option value="received">Hospital Storage</option>
              <option value="transfused">Transfused</option>
              <option value="quarantined">Quarantined</option>
              <option value="expired">Expired</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading digital inventory...</div>
        ) : units.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Droplet className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-sm">No blood units match the selected filters.</div>
            <div className="text-xs text-slate-400">Try clearing filters or register a new blood unit.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Unit ID</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Component</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Custodian</th>
                  <th className="py-3 px-4">Blockchain Hash</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => {
                  const now = new Date();
                  const exp = new Date(u.expiryDate);
                  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                  const isExpiringSoon = daysLeft <= 7 && daysLeft > 0 && ['available', 'received'].includes(u.status);

                  return (
                    <tr key={u.unitId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <Link to={`/units/${u.unitId}`} className="hover:text-rose-600 hover:underline">
                          {u.unitId}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-sm text-rose-700">{u.bloodGroup}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u.componentType}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className={daysLeft <= 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {exp.toLocaleDateString()}
                          </span>
                          {isExpiringSoon && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              {daysLeft}d left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-[140px]">
                        {u.currentCustodian?.name || u.bloodBankName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={u.dataHash}>
                        {u.dataHash ? `${u.dataHash.slice(0, 10)}...` : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/units/${u.unitId}`}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium inline-flex items-center space-x-1"
                        >
                          <span>Track</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
