'use client';

import { Search, ExternalLink, Activity, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AgeBreakdown {
    label: string;       // e.g. "2 min 13 sec"
    short: string;       // e.g. "2m 13s"  — shown in the cell
    seconds: number;
}

function getAge(dateStr: string): AgeBreakdown {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));

    if (totalSeconds < 5) return { label: 'just now', short: 'just now', seconds: totalSeconds };

    const s  = totalSeconds % 60;
    const m  = Math.floor(totalSeconds / 60) % 60;
    const h  = Math.floor(totalSeconds / 3600) % 24;
    const d  = Math.floor(totalSeconds / 86400) % 30;
    const mo = Math.floor(totalSeconds / 2592000) % 12;
    const y  = Math.floor(totalSeconds / 31536000);

    if (totalSeconds < 60)   return { label: `${totalSeconds} sec ago`,                    short: `${totalSeconds}s`,         seconds: totalSeconds };
    if (totalSeconds < 3600) return { label: `${m} min ${s} sec ago`,                      short: `${m}m ${s}s`,              seconds: totalSeconds };
    if (totalSeconds < 86400) return { label: `${h} hr ${m} min ago`,                      short: `${h}h ${m}m`,              seconds: totalSeconds };
    if (totalSeconds < 2592000) return { label: `${d} day${d !== 1 ? 's' : ''} ${h} hr ago`, short: `${d}d ${h}h`,            seconds: totalSeconds };
    if (totalSeconds < 31536000) return { label: `${mo} mo ${d} day${d !== 1 ? 's' : ''} ago`, short: `${mo}mo ${d}d`,        seconds: totalSeconds };
    return { label: `${y} yr ${mo} mo ago`,                                                  short: `${y}y ${mo}mo`,           seconds: totalSeconds };
}

/** Tick interval based on age — fast when fresh, slows as tx ages */
function tickInterval(seconds: number): number {
    if (seconds < 60)    return 1_000;    // every second
    if (seconds < 3600)  return 10_000;   // every 10 sec
    if (seconds < 86400) return 60_000;   // every minute
    return 300_000;                        // every 5 min
}

/**
 * Returns a stable color + glow class based on age.
 * Green → sky → slate → dim — never changes once the threshold is crossed.
 */
function freshnessStyle(seconds: number): { dot: string; text: string; pulse: boolean } {
    if (seconds < 15)    return { dot: 'bg-emerald-400 shadow-[0_0_8px_3px_rgba(52,211,153,0.6)]', text: 'text-emerald-400', pulse: true  };
    if (seconds < 60)    return { dot: 'bg-emerald-400/70',                                         text: 'text-emerald-400/80', pulse: true  };
    if (seconds < 300)   return { dot: 'bg-sky-400 shadow-[0_0_6px_2px_rgba(56,189,248,0.4)]',     text: 'text-sky-400',    pulse: false };
    if (seconds < 3600)  return { dot: 'bg-white/40',                                               text: 'text-white/60',   pulse: false };
    if (seconds < 86400) return { dot: 'bg-white/20',                                               text: 'text-white/40',   pulse: false };
    return                      { dot: 'bg-white/10',                                               text: 'text-white/25',   pulse: false };
}

function formatExact(dateStr: string): string {
    return new Date(dateStr).toLocaleString(undefined, {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

// ── Live Age Cell ─────────────────────────────────────────────────────────────

function LiveAge({ dateStr }: { dateStr: string }) {
    const [, tick] = useState(0);
    const [showTooltip, setShowTooltip] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;

        function schedule() {
            if (cancelled) return;
            const { seconds } = getAge(dateStr);
            const delay = tickInterval(seconds);
            timerRef.current = setTimeout(() => {
                if (!cancelled) {
                    tick(n => n + 1);
                    schedule();
                }
            }, delay);
        }

        schedule();
        return () => {
            cancelled = true;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [dateStr]);

    const age   = getAge(dateStr);
    const style = freshnessStyle(age.seconds);

    return (
        <div
            className="relative flex items-center justify-end gap-2 cursor-default select-none"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {/* Freshness dot */}
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-1000 ${style.dot} ${style.pulse ? 'animate-pulse' : ''}`} />

            {/* Age text */}
            <span className={`font-mono text-sm tabular-nums transition-colors duration-1000 ${style.text}`}>
                {age.short}
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute bottom-full right-0 mb-2.5 z-50 pointer-events-none">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 shadow-2xl whitespace-nowrap min-w-[220px]">
                        {/* Full age */}
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Age</p>
                        <p className="text-sm text-white font-semibold mb-3">{age.label}</p>

                        {/* Divider */}
                        <div className="border-t border-white/[0.06] mb-3" />

                        {/* Exact timestamp */}
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Timestamp</p>
                        <p className="text-xs text-white/80 font-mono">{formatExact(dateStr)}</p>
                    </div>
                    {/* Arrow */}
                    <div className="absolute right-4 top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-white/10" />
                </div>
            )}
        </div>
    );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const s = status === 'Success' ? 'Confirmed' : status;

    if (s === 'Confirmed') return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            CONFIRMED
        </span>
    );
    if (s === 'Pending') return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">
            <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
            PENDING
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border bg-rose-500/15 text-rose-400 border-rose-500/30">
            <XCircle className="w-3 h-3" />
            {s.toUpperCase()}
        </span>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionLogsPage() {
    const { network: currentNetwork } = useWallet();
    const { logs, isLoading, refresh } = useStats();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const filtered = search.trim()
        ? logs.filter(l =>
            l.txid.toLowerCase().includes(search.toLowerCase()) ||
            l.userAddress.toLowerCase().includes(search.toLowerCase())
          )
        : logs;

    async function handleRefresh() {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }

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
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest disabled:opacity-40"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
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
                                <th className="px-6 py-4 text-xs font-bold text-white/60 uppercase tracking-widest text-right">Age</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                // Skeleton rows
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-3 bg-white/5 rounded-full w-full" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
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
                                        <StatusBadge status={log.status} />
                                    </td>

                                    {/* Age */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <LiveAge dateStr={log.createdAt} />
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
