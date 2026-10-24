import React from 'react';
import { Link } from 'react-router-dom';
import {
  Droplet,
  Shield,
  Activity,
  Layers,
  Clock,
  ArrowRight,
  CheckCircle2,
  Lock,
  Hospital,
  Building2,
  HeartHandshake,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-white via-rose-50/30 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                <Shield className="w-3.5 h-3.5" />
                <span>Academic Research Implementation: SSRN ID 3879601</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Blockchain in <span className="text-rose-600">Blood Bank</span> Supply Management
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                A tamper-evident, decentralized blood supply chain tracking blood units from donor collection,
                laboratory serology screening, and real-time inventory allocation to hospital cold chain dispatch and
                patient transfusion.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  to="/register-donor"
                  className="px-6 py-3.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex items-center space-x-2"
                >
                  <span>Register as Voluntary Donor</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3.5 rounded-xl font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-sm transition-all"
                >
                  <span>Organization Portal Sign In</span>
                </Link>
              </div>

              {/* Research Base Highlights */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-left">
                <div>
                  <div className="text-2xl font-bold text-slate-900">100%</div>
                  <div className="text-xs text-slate-500 font-medium">Vein-to-Vein Traceability</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">0%</div>
                  <div className="text-xs text-slate-500 font-medium">Double-Allocation Risk</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">&lt; 15 min</div>
                  <div className="text-xs text-slate-500 font-medium">Inter-Hospital Emergency Match</div>
                </div>
              </div>
            </div>

            {/* Interactive Visual Graphic */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-rose-600"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Live Chain State
                    </span>
                  </div>
                  <span className="font-mono text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Smart Contract Synced
                  </span>
                </div>

                {/* Workflow Progression Preview */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800">1. Donor Registration & PII Segregation</div>
                      <div className="text-slate-500 text-[11px]">Auth separated from PII for donor privacy</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800">2. Blood Collection & Cryptographic Hash</div>
                      <div className="text-slate-500 text-[11px]">SHA-256 state hash committed to BloodSupplyChain.sol</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800">3. Lab Screening Serology Gate</div>
                      <div className="text-slate-500 text-[11px]">Requires blood bank approval before inventory availability</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800">4. Hospital Request & Cold Chain Transit</div>
                      <div className="text-slate-500 text-[11px]">Custodian transfer and verified hospital receipt</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to="/explorer"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Open Blockchain Ledger Explorer</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Access Cards */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Four Authorized System Roles</h2>
          <p className="mt-2 text-slate-600">
            Enforced through Solidity smart contract function modifiers and JWT backend RBAC.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Voluntary Donor</h3>
            <p className="text-sm text-slate-600 mt-2">
              Protected identity profile, automated donation history, non-sensitive vein-to-vein tracking identifier.
            </p>
            <Link to="/register-donor" className="mt-4 inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700">
              Register Donor &rarr;
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Blood Bank Staff</h3>
            <p className="text-sm text-slate-600 mt-2">
              Collection logging, laboratory serology validation, inventory approval, allocation, cold chain dispatch.
            </p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700">
              Staff Portal &rarr;
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Hospital className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Hospital Staff</h3>
            <p className="text-sm text-slate-600 mt-2">
              Real-time blood searches, urgent & emergency blood requests, physical receipt confirmation, transfusion outcomes.
            </p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700">
              Hospital Portal &rarr;
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">System Administrator</h3>
            <p className="text-sm text-slate-600 mt-2">
              Organization verification and authorization, blockchain participant control, system-wide audit trail.
            </p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700">
              Admin Portal &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
