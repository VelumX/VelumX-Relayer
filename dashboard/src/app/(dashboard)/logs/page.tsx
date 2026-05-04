'use client';

import { Search, Filter, ExternalLink, Activity } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';

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
                    <p className="text-white/60 text-sm font-medium">All gasless sessions sponsored by your Relayer.</p>
                </div>
            </div>

            <div className="glass-card overflow-hidden !rounded-xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by TxID or address..."
                            className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20 outline-none"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.01]">
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest">Transaction ID</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest">User Address</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest">Network</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-white/50 uppercase tracking-widest text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-white/30 text-xs font-medium uppercase tracking-widest">
                                        Fetching logs...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-white/30 text-xs font-medium uppercase tracking-widest">
                                        {search ? 'No results match your search.' : 'No transaction data found.'}
                                    </td>
                                </tr>
                            ) : filtered.map((log) => (
                                <tr key={log.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-white/70 group-hover:text-white transition-colors">{log.txid.substring(0, 20)}...</span>
                                            <ExternalLink className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5 text-white/30" />
                                            <span className="text-xs font-bold text-white">{log.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <code className="text-xs text-white/60 font-mono">{log.userAddress.substring(0, 12)}...</code>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-[10px] font-bold uppercase text-white/70">
                                            {log.network || currentNetwork}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold border ${
                                            (log.status === 'Confirmed' || log.status === 'Success')
                                                ? 'bg-white/5 text-white border-white/10'
                                                : log.status === 'Pending'
                                                ? 'bg-white/[0.03] text-white/50 border-white/10'
                                                : 'bg-white/[0.03] text-white/30 border-white/5'
                                        }`}>
                                            {(log.status === 'Success' ? 'Confirmed' : log.status).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-white/50 text-right uppercase tracking-wider font-mono">
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
