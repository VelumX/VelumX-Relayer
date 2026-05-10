'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, BarChart3, Activity, CheckCircle2,
    XCircle, RefreshCw, Zap, Users
} from 'lucide-react';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyBucket {
    date: string;       // YYYY-MM-DD
    total: number;
    confirmed: number;
    failed: number;
    pending: number;
    feeUsd: number;
}

interface TopUser {
    userAddress: string;
    count: number;
    lastSeen: string;
}

interface KeyUsage {
    keyId: string;
    keyName: string;
    txCount: number;
    successRate: number;
}

interface AnalyticsData {
    daily: DailyBucket[];
    topUsers: TopUser[];
    keyUsage: KeyUsage[];
    successRate: number;
    avgDailyTx: number;
    peakDay: { date: string; count: number };
    totalRevenue: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUsd(v: number) {
    if (v === 0) return '0.00';
    if (v < 0.01) return v.toFixed(6);
    if (v < 1) return v.toFixed(4);
    return v.toFixed(2);
}

function shortDate(d: string) {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, valueKey, colorClass, height = 120 }: {
    data: DailyBucket[];
    valueKey: keyof DailyBucket;
    colorClass: string;
    height?: number;
}) {
    const values = data.map(d => Number(d[valueKey]));
    const max = Math.max(...values, 1);

    return (
        <div className="flex items-end gap-1" style={{ height }}>
            {data.map((d, i) => {
                const pct = Math.max((Number(d[valueKey]) / max) * 100, 2);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                            style={{ height: `${pct}%` }}
                            className={clsx('w-full rounded-t-sm transition-all duration-300', colorClass, 'group-hover:opacity-100 opacity-70')}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-center whitespace-nowrap shadow-xl">
                                <p className="text-[10px] text-white/40 mb-0.5">{shortDate(d.date)}</p>
                                <p className="text-sm font-bold text-white">{Number(d[valueKey]).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Stacked bar chart ─────────────────────────────────────────────────────────

function StackedBarChart({ data, height = 140 }: { data: DailyBucket[]; height?: number }) {
    const maxTotal = Math.max(...data.map(d => d.total), 1);

    return (
        <div className="flex items-end gap-1" style={{ height }}>
            {data.map((d, i) => {
                const totalPct = Math.max((d.total / maxTotal) * 100, 2);
                const confirmedPct = d.total > 0 ? (d.confirmed / d.total) * 100 : 0;
                const failedPct    = d.total > 0 ? (d.failed    / d.total) * 100 : 0;
                const pendingPct   = 100 - confirmedPct - failedPct;

                return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                        {/* Bar — grows from bottom */}
                        <div
                            style={{ height: `${totalPct}%` }}
                            className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden"
                        >
                            {/* Confirmed (bottom) */}
                            <div style={{ height: `${confirmedPct}%` }} className="w-full bg-emerald-500/70 group-hover:bg-emerald-500/90 transition-colors flex-shrink-0" />
                            {/* Pending (middle) */}
                            <div style={{ height: `${pendingPct}%` }}  className="w-full bg-amber-500/50  group-hover:bg-amber-500/70  transition-colors flex-shrink-0" />
                            {/* Failed (top) */}
                            <div style={{ height: `${failedPct}%` }}   className="w-full bg-rose-500/60   group-hover:bg-rose-500/80   transition-colors flex-shrink-0" />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 whitespace-nowrap shadow-xl min-w-[130px]">
                                <p className="text-[10px] text-white/40 mb-1.5 font-bold">{shortDate(d.date)}</p>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Confirmed</span>
                                        <span className="text-[10px] font-bold text-white">{d.confirmed}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-[10px] text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Pending</span>
                                        <span className="text-[10px] font-bold text-white">{d.pending}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-[10px] text-rose-400"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Failed</span>
                                        <span className="text-[10px] font-bold text-white">{d.failed}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const { network } = useWallet();
    const { logs, stats, isLoading: statsLoading } = useStats();
    const [range, setRange] = useState<7 | 14 | 30>(30);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Build analytics from logs (client-side computation)
    const buildAnalytics = useCallback(() => {
        const now = new Date();
        const days = Array.from({ length: range }, (_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (range - 1 - i));
            return d.toISOString().split('T')[0];
        });

        const networkLogs = logs.filter(l => (l.network || 'mainnet') === network);

        const daily: DailyBucket[] = days.map(date => {
            const dayLogs = networkLogs.filter(l => l.createdAt.startsWith(date));
            const confirmed = dayLogs.filter(l => l.status === 'Confirmed' || l.status === 'Success').length;
            const failed = dayLogs.filter(l => l.status === 'Failed').length;
            const pending = dayLogs.filter(l => l.status === 'Pending').length;
            return { date, total: dayLogs.length, confirmed, failed, pending, feeUsd: 0 };
        });

        const totalTx = networkLogs.length;
        const confirmedTx = networkLogs.filter(l => l.status === 'Confirmed' || l.status === 'Success').length;
        const failedTx = networkLogs.filter(l => l.status === 'Failed').length;
        const successRate = totalTx > 0 ? (confirmedTx / totalTx) * 100 : 0;
        const avgDailyTx = totalTx / range;

        // Top users
        const userMap = new Map<string, { count: number; lastSeen: string }>();
        networkLogs.forEach(l => {
            const existing = userMap.get(l.userAddress);
            if (!existing || l.createdAt > existing.lastSeen) {
                userMap.set(l.userAddress, {
                    count: (existing?.count || 0) + 1,
                    lastSeen: l.createdAt,
                });
            } else {
                existing.count++;
            }
        });
        const topUsers: TopUser[] = Array.from(userMap.entries())
            .map(([userAddress, v]) => ({ userAddress, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Key usage
        const keyMap = new Map<string, { name: string; total: number; confirmed: number }>();
        networkLogs.forEach(l => {
            const keyId = l.apiKey?.id || 'unknown';
            const keyName = l.apiKey?.name || 'Unknown Key';
            const existing = keyMap.get(keyId);
            if (!existing) {
                keyMap.set(keyId, { name: keyName, total: 1, confirmed: (l.status === 'Confirmed' || l.status === 'Success') ? 1 : 0 });
            } else {
                existing.total++;
                if (l.status === 'Confirmed' || l.status === 'Success') existing.confirmed++;
            }
        });
        const keyUsage: KeyUsage[] = Array.from(keyMap.entries())
            .map(([keyId, v]) => ({
                keyId,
                keyName: v.name,
                txCount: v.total,
                successRate: v.total > 0 ? (v.confirmed / v.total) * 100 : 0,
            }))
            .sort((a, b) => b.txCount - a.txCount);

        const peakBucket = daily.reduce((best, d) => d.total > best.total ? d : best, daily[0] || { date: '', total: 0 });

        setAnalytics({
            daily,
            topUsers,
            keyUsage,
            successRate,
            avgDailyTx,
            peakDay: { date: peakBucket.date, count: peakBucket.total },
            totalRevenue: 0,
        });
        setIsLoading(false);
    }, [logs, network, range]);

    useEffect(() => {
        if (!statsLoading) buildAnalytics();
    }, [statsLoading, buildAnalytics]);

    async function handleRefresh() {
        setRefreshing(true);
        buildAnalytics();
        setRefreshing(false);
    }

    const networkLogs = logs.filter(l => (l.network || 'mainnet') === network);
    const confirmedCount = networkLogs.filter(l => l.status === 'Confirmed' || l.status === 'Success').length;
    const failedCount = networkLogs.filter(l => l.status === 'Failed').length;
    // Use the authoritative DB count from stats — logs array is capped and may not reflect the full total
    const totalTxCount = stats.networks?.[network]?.totalTransactions ?? networkLogs.length;

    return (
        <div className="space-y-7 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">
                        {network === 'mainnet' ? 'Mainnet' : 'Testnet'} · Analytics
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Analytics</h1>
                    <p className="text-sm text-white/50 mt-1">Transaction volume, success rates, and usage patterns.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Range selector */}
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                        {([7, 14, 30] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                    range === r ? 'bg-white/[0.08] text-white border border-white/10' : 'text-white/35 hover:text-white/60'
                                )}
                            >
                                {r}d
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest disabled:opacity-40"
                    >
                        <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Transactions',
                        value: totalTxCount.toLocaleString(),
                        sub: `last ${range} days`,
                        icon: Activity,
                        color: 'text-white',
                    },
                    {
                        label: 'Success Rate',
                        value: analytics ? `${analytics.successRate.toFixed(1)}%` : '—',
                        sub: `${confirmedCount} confirmed`,
                        icon: CheckCircle2,
                        color: 'text-emerald-400',
                    },
                    {
                        label: 'Failed',
                        value: failedCount.toLocaleString(),
                        sub: networkLogs.length > 0 ? `${((failedCount / networkLogs.length) * 100).toFixed(1)}% failure rate` : '0%',
                        icon: XCircle,
                        color: 'text-rose-400',
                    },
                    {
                        label: 'Avg Daily Volume',
                        value: analytics ? analytics.avgDailyTx.toFixed(1) : '—',
                        sub: 'transactions/day',
                        icon: BarChart3,
                        color: 'text-sky-400',
                    },
                ].map(card => (
                    <div key={card.label} className="glass-card p-5">
                        <div className="flex items-start justify-between mb-4">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{card.label}</p>
                            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                                <card.icon className={clsx('w-3.5 h-3.5', card.color)} />
                            </div>
                        </div>
                        <p className={clsx('text-2xl font-bold tracking-tight stat-value', card.color)}>
                            {isLoading ? <span className="inline-block w-16 h-7 bg-white/5 rounded animate-pulse" /> : card.value}
                        </p>
                        <p className="text-[10px] text-white/30 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Volume chart */}
            <div className="glass-card p-7">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Transaction Volume</h2>
                        <p className="text-xs text-white/40 mt-0.5">Daily breakdown by status</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" />Confirmed</span>
                        <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-sm bg-amber-500/50" />Pending</span>
                        <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2 h-2 rounded-sm bg-rose-500/60" />Failed</span>
                    </div>
                </div>

                {statsLoading && !analytics ? (
                    <div className="h-36 bg-white/[0.02] rounded-lg animate-pulse" />
                ) : (
                    <>
                        <StackedBarChart data={analytics?.daily ?? []} height={140} />
                        {/* X-axis */}
                        <div className="flex mt-2">
                            {(analytics?.daily ?? []).map((d, i) => {
                                const step = range <= 7 ? 1 : range <= 14 ? 2 : 5;
                                const show = i % step === 0 || i === (analytics?.daily.length ?? 0) - 1;
                                return (
                                    <div key={i} className="flex-1 text-center">
                                        {show && (
                                            <span className="text-[9px] text-white/20 font-medium">
                                                {shortDate(d.date)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom grid: Top Users + Key Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Users */}
                <div className="glass-card">
                    <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-3">
                        <Users className="w-4 h-4 text-white/40" />
                        <div>
                            <h2 className="text-sm font-semibold text-white">Top Users</h2>
                            <p className="text-xs text-white/40 mt-0.5">By transaction count</p>
                        </div>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="px-6 py-3 flex items-center gap-3 animate-pulse">
                                    <div className="w-6 h-6 rounded-full bg-white/5" />
                                    <div className="flex-1 h-3 bg-white/5 rounded-full" />
                                    <div className="w-8 h-3 bg-white/5 rounded-full" />
                                </div>
                            ))
                        ) : analytics?.topUsers.length === 0 ? (
                            <div className="px-6 py-10 text-center text-white/30 text-sm">No user data yet.</div>
                        ) : analytics?.topUsers.map((u, i) => {
                            const maxCount = analytics.topUsers[0]?.count || 1;
                            const pct = (u.count / maxCount) * 100;
                            return (
                                <div key={u.userAddress} className="px-6 py-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-[10px] font-bold text-white/20 w-4 text-right">{i + 1}</span>
                                            <code className="text-xs text-white/70 font-mono">
                                                {u.userAddress.substring(0, 10)}…{u.userAddress.slice(-6)}
                                            </code>
                                        </div>
                                        <span className="text-xs font-bold text-white">{u.count} tx</span>
                                    </div>
                                    <div className="ml-6 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            style={{ width: `${pct}%` }}
                                            className="h-full bg-white/20 rounded-full transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Key Usage */}
                <div className="glass-card">
                    <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-3">
                        <Zap className="w-4 h-4 text-white/40" />
                        <div>
                            <h2 className="text-sm font-semibold text-white">API Key Usage</h2>
                            <p className="text-xs text-white/40 mt-0.5">Transactions per key</p>
                        </div>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="px-6 py-4 animate-pulse">
                                    <div className="flex justify-between mb-2">
                                        <div className="h-3 bg-white/5 rounded-full w-32" />
                                        <div className="h-3 bg-white/5 rounded-full w-12" />
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full" />
                                </div>
                            ))
                        ) : analytics?.keyUsage.length === 0 ? (
                            <div className="px-6 py-10 text-center text-white/30 text-sm">No key usage data yet.</div>
                        ) : analytics?.keyUsage.map(k => {
                            const maxTx = analytics.keyUsage[0]?.txCount || 1;
                            const pct = (k.txCount / maxTx) * 100;
                            const srColor = k.successRate >= 90 ? 'text-emerald-400' : k.successRate >= 70 ? 'text-amber-400' : 'text-rose-400';
                            return (
                                <div key={k.keyId} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-white">{k.keyName}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={clsx('text-xs font-bold', srColor)}>{k.successRate.toFixed(0)}%</span>
                                            <span className="text-xs text-white/50">{k.txCount} tx</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            style={{ width: `${pct}%` }}
                                            className="h-full bg-white/25 rounded-full transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Peak day callout */}
            {analytics && analytics.peakDay.count > 0 && (
                <div className="glass-card p-6 flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-white/60" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Peak Day</p>
                        <p className="text-sm font-semibold text-white">
                            {new Date(analytics.peakDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            <span className="text-white/40 font-normal ml-2">—</span>
                            <span className="text-white ml-2">{analytics.peakDay.count} transactions</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
