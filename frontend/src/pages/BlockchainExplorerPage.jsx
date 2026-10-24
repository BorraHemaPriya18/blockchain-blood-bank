import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Layers,
  Search,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Hash,
  Clock,
  ArrowRight,
  Filter,
  AlertCircle,
  Database,
  Link2,
} from 'lucide-react';

export default function BlockchainExplorerPage() {
  const [data, setData] = useState({ connection: null, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'on-chain', 'database'

  useEffect(() => {
    fetchExplorerData();
  }, []);

  const fetchExplorerData = async (query = '') => {
    setLoading(true);
    try {
      const res = await api.get('/audit/blockchain-explorer', {
        params: { query },
      });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching blockchain explorer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchExplorerData(search);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredTransactions = (data.transactions || []).filter((tx) => {
    if (filterType === 'on-chain') return tx.isConfirmedOnChain;
    if (filterType === 'database') return !tx.isConfirmedOnChain;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
              EVM Hardhat Development Network
            </span>
            <span className="text-xs text-slate-500 font-mono">Consensus: Proof of Authority (PoA)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 flex items-center space-x-2">
            <Layers className="w-7 h-7 text-rose-600" />
            <span>BloodChain Ledger Explorer</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Transparent, tamper-evident audit explorer for smart contract events, genuine transaction hashes, and cryptographic proofs.
          </p>
        </div>
      </div>

      {/* Network Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <span>Blockchain State</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                data.connection?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            ></span>
            <span>{data.connection?.connected ? 'Online & Synced' : 'Offline / Standalone DB'}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">Chain ID: {data.connection?.chainId || '31337'}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Hash className="w-4 h-4 text-purple-600" />
            <span>Latest Block Height</span>
          </div>
          <div className="text-xl font-mono font-bold text-purple-700 mt-2">
            {data.connection?.blockNumber ? `#${data.connection.blockNumber}` : '#--'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Confirmed blocks mined</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs sm:col-span-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <span>Deployed BloodSupplyChain Contract Address</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 mt-2 truncate bg-slate-50 p-2 rounded-lg border border-slate-200">
            {data.connection?.contractAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Solidity 0.8.20 &bull; Role-Based Smart Contract Ledger</div>
        </div>
      </div>

      {/* Search and Ledger Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Tx Hash (0x...), Unit ID (BLD-...), Event, or Block #..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-2 text-xs font-semibold">
          <span className="text-slate-500">Filter:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Records ({data.transactions.length})
          </button>
          <button
            onClick={() => setFilterType('on-chain')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
              filterType === 'on-chain'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>On-Chain Confirmed</span>
          </button>
          <button
            onClick={() => setFilterType('database')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
              filterType === 'database'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Off-Chain Records</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Ledger Transaction Activity ({filteredTransactions.length})
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Chronological audit ordering with cryptographic status verification
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">Querying ledger blocks and events...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No transactions match your search query or filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Verification State</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Unit ID</th>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Block</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Integrity Hash</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-sans">
                      {tx.isConfirmedOnChain ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1 w-max">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>On-Chain Confirmed</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center space-x-1 w-max">
                          <Database className="w-3 h-3 text-amber-600" />
                          <span>Off-Chain Record</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                        {tx.eventType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-rose-700">
                      {tx.unitId && tx.unitId !== 'N/A' ? (
                        <Link to={`/units/${tx.unitId}`} className="hover:underline">
                          {tx.unitId}
                        </Link>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 truncate max-w-[150px]">
                      {tx.txHash ? (
                        <span title={tx.txHash}>{`${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-8)}`}</span>
                      ) : (
                        <span className="text-slate-400 italic font-sans text-[11px]">Pending on-chain sync</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-purple-700 font-bold">
                      {tx.blockNumber ? `#${tx.blockNumber}` : <span className="text-slate-400 font-normal">--</span>}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-700 truncate max-w-[130px]" title={tx.dataHash || ''}>
                      {tx.dataHash ? `${tx.dataHash.slice(0, 10)}...` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      {tx.txHash ? (
                        <button
                          onClick={() => copyToClipboard(tx.txHash)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedHash === tx.txHash ? 'Copied!' : 'Copy Tx'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
