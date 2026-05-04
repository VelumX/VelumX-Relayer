'use client';

import { Search, Filter, ExternalLink, Activity } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';

function statusBadge(status: string) {
    const s = status === 'Success' ? 'Confirmed' : status;
    if (s === 'Confirmed') {
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (s === 'Pending') {
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    // Failed / Dropped / anything else
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
}

export default function TransactionLogsPage() {
    const { network: currentNetwork } = useWallet();
    const { logs, isLoading } = useStats();
    const [search, setSearch] = useState('');

    const filtered = search.trim()
        ? logs.filter(l =>
            l.txid.toLowerCase().includes(search.toLowerCase()) ||
            l.userAddress.toLowerCase().includes(search.toLowerCase())
          )
        : logs;

    return (
        <div className="space-y-8 pb-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Logs</h1>
                    <p className="text-white/70 text-sm font-medium">All gasless sessions sponsored by your Relayer.</p>
                </div>
            </div>

            <div className="glass-card overflow-hidden !rounded-xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by TxID or address..."
                            className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/30 outline-none"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.01]">
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest">Transaction ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest">User Address</th>
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest">Network</th>
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-white/40 text-sm font-medium">
                                        Fetching logs...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-white/40 text-sm font-medium">
                                        {search ? 'No results match your search.' : 'No transaction data found.'}
                                    </td>
                                </tr>
                            ) : filtered.map((log) => (
                                <tr key={log.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors group">

                                    {/* TxID */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm text-white/80 group-hover:text-white transition-colors">
                                                {log.txid.substring(0, 20)}...
                                            </span>
                                            <ExternalLink className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </td>

                                    {/* Type */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5 text-white/40" />
                                            <span className="text-sm font-semibold text-white">{log.type}</span>
                                        </div>
                                    </td>

                                    {/* User Address */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <code className="text-sm text-white/70 font-mono">
                                            {log.userAddress.substring(0, 12)}...
                                        </code>
                                    </td>

                                    {/* Network */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-bold uppercase text-white/80">
                                            {log.network || currentNetwork}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${statusBadge(log.status)}`}>
                                            {(log.status === 'Success' ? 'Confirmed' : log.status).toUpperCase()}
                                        </span>
                                    </td>

                                    {/* Time */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 text-right font-mono">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
