import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Building2, Wallet, LogOut, Heart, Phone, MapPin } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                  {user?.role?.replace('_', ' ')}
                </span>
                {user?.isApproved && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    Verified
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">{user?.username}</h1>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center space-x-1.5 transition-colors self-start"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Account Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Assigned Role</span>
            <div className="font-bold text-slate-800 capitalize text-sm">{user?.role?.replace('_', ' ')}</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Organization Name</span>
            <div className="font-bold text-slate-800 text-sm">
              {user?.organizationName || profile?.fullName || 'Individual Donor'}
            </div>
          </div>

          {user?.licenseNumber && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Regulatory License #</span>
              <div className="font-mono font-bold text-slate-800 text-sm">{user.licenseNumber}</div>
            </div>
          )}

          {user?.donorRefId && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Cryptographic Donor Ref ID</span>
              <div className="font-mono font-bold text-rose-700 text-sm">{user.donorRefId}</div>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-xl space-y-1 sm:col-span-2">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Ethereum Wallet Address</span>
            <div className="font-mono text-xs text-slate-800 font-semibold break-all">
              {user?.walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'}
            </div>
          </div>
        </div>

        {/* If Donor: show linked clinical metadata */}
        {profile && (
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Heart className="w-4 h-4 text-rose-600" />
              <span>Off-Chain Confidential Donor Profile</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl">
                <span className="text-slate-500 text-[10px]">Blood Group:</span>
                <div className="font-black text-rose-700 text-base">{profile.bloodGroup}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px]">Gender:</span>
                <div className="font-bold text-slate-800">{profile.gender}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px]">Total Donations:</span>
                <div className="font-bold text-slate-800">{profile.totalDonations}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px]">Identity Verified:</span>
                <div className="font-bold text-emerald-700">Yes (Photo & ID)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
