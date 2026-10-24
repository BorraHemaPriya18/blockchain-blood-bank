import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Droplet, ShieldCheck, Activity, LogOut, User, Menu, X, Link as LinkIcon } from 'lucide-react';
import api from '../services/api';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chainConnected, setChainConnected] = useState(null);

  useEffect(() => {
    checkChain();
    const interval = setInterval(checkChain, 20000);
    return () => clearInterval(interval);
  }, []);

  const checkChain = async () => {
    try {
      const res = await api.get('/audit/blockchain-explorer');
      setChainConnected(res.data.connection?.connected ?? false);
    } catch {
      setChainConnected(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin':
        return '/admin-dashboard';
      case 'blood_bank':
        return '/bloodbank-dashboard';
      case 'hospital':
        return '/hospital-dashboard';
      case 'donor':
        return '/donor-dashboard';
      default:
        return '/';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-white shadow-md shadow-rose-200 group-hover:scale-105 transition-transform">
              <Droplet className="w-6 h-6 fill-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-rose-600 transition-colors">
                Blood<span className="text-rose-600">Chain</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 -mt-1">
                Permissioned Supply Ledger
              </span>
            </div>
          </Link>

          {/* Center Links (when authenticated) */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-3 text-sm font-medium text-slate-600">
              <Link
                to={getDashboardPath()}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.includes('dashboard')
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/inventory"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname === '/inventory'
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Inventory
              </Link>
              <Link
                to="/requests"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.startsWith('/requests')
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Requests
              </Link>
              <Link
                to="/transfers"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname.startsWith('/transfers')
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Emergency Transfers
              </Link>
              <Link
                to="/explorer"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname === '/explorer'
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Explorer
              </Link>
              <Link
                to="/analytics"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  location.pathname === '/analytics'
                    ? 'text-rose-600 bg-rose-50 font-semibold'
                    : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Analytics
              </Link>
            </nav>
          )}

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {/* Blockchain Node Status Pill */}
            <div
              title={
                chainConnected === true
                  ? 'Local Ethereum node synchronized (Ethers.js connected)'
                  : chainConnected === false
                  ? 'Blockchain offline or waiting on local Hardhat RPC'
                  : 'Verifying blockchain connection...'
              }
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                chainConnected === true
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : chainConnected === false
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  chainConnected === true
                    ? 'bg-emerald-500 animate-pulse'
                    : chainConnected === false
                    ? 'bg-amber-400'
                    : 'bg-slate-300'
                }`}
              ></span>
              <span className="font-mono text-[11px]">
                {chainConnected === true ? 'Hardhat :8545 Active' : 'Simulation Mode'}
              </span>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-medium text-slate-700"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="max-w-[120px] truncate">{user.username}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600">
                    {user.role}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register-donor"
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
                >
                  Donate Blood
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2">
          {isAuthenticated ? (
            <>
              <Link
                to={getDashboardPath()}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Dashboard
              </Link>
              <Link
                to="/inventory"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Digital Blood Inventory
              </Link>
              <Link
                to="/requests"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Hospital Blood Requests
              </Link>
              <Link
                to="/transfers"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Emergency Transfers
              </Link>
              <Link
                to="/explorer"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Blockchain Ledger Explorer
              </Link>
              <Link
                to="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                Analytics & Reports
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600"
              >
                My Account
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-rose-600 hover:bg-rose-50"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign In
              </Link>
              <Link
                to="/register-donor"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-rose-600 hover:bg-rose-50 font-semibold"
              >
                Register as Blood Donor
              </Link>
              <Link
                to="/register-org"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Register Organization (Blood Bank / Hospital)
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
