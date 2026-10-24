import React from 'react';

const STATUS_CONFIG = {
  collected: { label: 'Collected', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
  pending_screening: { label: 'Pending Lab Screening', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved: { label: 'Approved', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  available: { label: 'Available in Inventory', bg: 'bg-green-100 text-green-800 border-green-300' },
  reserved: { label: 'Reserved for Hospital', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
  dispatched: { label: 'Dispatched (Cold Chain)', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  received: { label: 'Received by Hospital', bg: 'bg-teal-100 text-teal-800 border-teal-300' },
  transfused: { label: 'Transfused to Patient', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  quarantined: { label: 'Quarantined (Failed)', bg: 'bg-orange-100 text-orange-800 border-orange-300' },
  expired: { label: 'Expired', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
  discarded: { label: 'Discarded', bg: 'bg-gray-100 text-gray-800 border-gray-300' },

  // Request statuses
  pending: { label: 'Pending', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  fulfilled: { label: 'Fulfilled', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Rejected', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100 text-gray-800 border-gray-300' },

  // Urgencies
  normal: { label: 'Normal', bg: 'bg-slate-100 text-slate-800 border-slate-300' },
  urgent: { label: 'Urgent', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  emergency: { label: 'EMERGENCY', bg: 'bg-red-600 text-white border-red-700 animate-pulse' },
};

export default function StatusBadge({ status, className = '' }) {
  const normKey = String(status || '').toLowerCase().trim();
  const config = STATUS_CONFIG[normKey] || { label: status || 'Unknown', bg: 'bg-gray-100 text-gray-700 border-gray-300' };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}
    >
      {config.label}
    </span>
  );
}
