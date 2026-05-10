'use client';

import { Activity, Users, BatteryCharging, TrendingUp } from 'lucide-react';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';
import clsx from 'clsx';

function formatUsd(value: string | number): string {
    const n = parseFloat(value as string) || 0;
    if (n === 0) return '0.00';
    if (n < 0.01) return n.toFixed(6);
    if (n < 1) return n.toFixed(4);
    return n.toFixed(2);
}

function statusClass(status: string) {
    const s = status === 'Success' ? 'Confirmed' : status;
    if (s === 'Confirmed') return 'text-emerald-400';
    if (s === 'Pending')   return 'text-amber-400';
    return 'text-rose-400';
}

export default function DashboardOverview() {
    const { network: currentNetwork } = useWallet();
    const { stats: statsData, logs, isLoading } = useStats();

    const currentStats = statsData.networks?.[currentNetwork] || {
        totalTransactions: 0,
        totalSponsored: '0',
        relayerAddress: '',
        relayerStxBalance: '0',
        relayerFeeBalance: '0',
        feeToken: 'USD',
    };

    const metricCards = [
        {
            title: 'Gas Sponsored',
            value: '$' + formatUsd(currentStats.totalSponsored),
            unit: 'USD',
            icon: BatteryCharging,
        },
        {
            title: 'Active API Keys',
            value: statsData.activeKeys.toString(),
            unit: 'keys',
            icon: Activity,
        },
        {
            title: 'Transactions',
            value: currentStats.totalTransactions.toString(),
            unit: 'total',
            icon: Users,
        },
    ];

    return (
        <div className="space-y-7 pb-12">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">
                        {currentNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'} · Live
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
                    <p className="text-sm text-white/50 mt-1">Gas abstraction performance for your dApp.</p>
                </div>

                {/* Relayer status pill */}
                {!isLoading && currentStats.relayerAddress && (
                    <div className="flex items-center gap-5 px-5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                        <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Relayer</p>
                            <div className="flex items-center gap-1.5">
                                <span className={clsx(
                                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                    currentNetwork === 'mainnet'
                                        ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]'
                                        : 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.7)]'
                                )} />
                                <code className="text-xs text-white/70 font-mono">
                                    {currentStats.relayerAddress.substring(0, 8)}…{currentStats.relayerAddress.slice(-6)}
                                </code>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-white/[0.08]" />
                        <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">STX Balance</p>
                            <p className="text-xs font-bold text-white font-mono stat-value">
                                {(parseInt(currentStats.relayerStxBalance) / 1_000_000).toFixed(2)}
                                <span className="text-white/40 font-normal ml-1">STX</span>
                            </p>
                        </div>
                        <div className="w-px h-8 bg-white/[0.08]" />
                        <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Revenue</p>
                            <p className="text-xs font-bold text-white font-mono stat-value">
                                ${formatUsd(currentStats.relayerFeeBalance)}
                                <span className="text-white/40 font-normal ml-1">USD</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metricCards.map((card) => (
                    <div key={card.title} className="glass-card p-6">
                        <div className="flex items-start justify-between mb-5">
                            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">{card.title}</p>
                            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                <card.icon className="w-4 h-4 text-white/50" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white tracking-tight stat-value">
                                {isLoading ? (
                                    <span className="inline-block w-16 h-8 bg-white/5 rounded animate-pulse" />
                                ) : card.value}
                            </span>
                            {!isLoading && (
                                <span className="text-sm text-white/35 font-medium">{card.unit}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="glass-card p-7">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Sponsorship Volume</h2>
                        <p className="text-xs text-white/40 mt-0.5">Transactions per day</p>
                    </div>
                    <select className="bg-white/[0.04] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-white/20 transition-colors appearance-none">
                        <option>Last 7 days</option>
                        <option>Last 30 days</option>
                    </select>
                </div>

                <div className="flex items-end justify-between gap-2 h-40 border-b border-l border-white/[0.06] px-2 pb-2 relative">
                    {(() => {
                        const last7Days = Array.from({ length: 7 }, (_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (6 - i));
                            return d.toISOString().split('T')[0];
                        });
                        const totals = last7Days.map(date =>
                            logs.filter(l => l.createdAt.startsWith(date)).length
                        );
                        const max = Math.max(...totals, 1);
                        return totals.map((total, i) => (
                            <div key={i} className="flex-1 h-full flex items-end group">
                                <div
                                    style={{ height: `${Math.max((total / max) * 100, 3)}%` }}
                                    className="w-full rounded-t-sm bg-white/[0.15] group-hover:bg-white/30 transition-colors relative"
                                >
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {total} tx
                                    </div>
                                </div>
                            </div>
                        ));
                    })()}
                    {/* Y-axis labels */}
                    <div className="absolute -left-8 bottom-[33%] text-[9px] text-white/20 font-mono">33%</div>
                    <div className="absolute -left-8 bottom-[66%] text-[9px] text-white/20 font-mono">66%</div>
                </div>

                {/* X-axis */}
                <div className="flex justify-between mt-2 px-2">
                    {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return (
                            <span key={i} className="flex-1 text-center text-[9px] text-white/25 font-medium uppercase tracking-wide">
                                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Recent activity */}
            <div className="glass-card">
                <div className="px-7 py-5 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                        <p className="text-xs text-white/40 mt-0.5">Latest sponsored transactions</p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-white/20" />
                </div>

                <div className="divide-y divide-white/[0.05]">
                    {isLoading ? (
                        <div className="px-7 py-10 text-center text-white/30 text-sm">Loading activity…</div>
                    ) : logs.length === 0 ? (
                        <div className="px-7 py-10 text-center text-white/30 text-sm">No recent activity.</div>
                    ) : logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center justify-between px-7 py-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                                    <Activity className="w-3.5 h-3.5 text-white/40" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{log.type}</p>
                                    <p className="text-xs text-white/40 font-mono mt-0.5">{log.txid.substring(0, 18)}…</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={clsx('text-xs font-bold', statusClass(log.status))}>
                                    {log.status === 'Success' ? 'Confirmed' : log.status}
                                </p>
                                <p className="text-[10px] text-white/30 font-mono mt-0.5">
                                    {new Date(log.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                    { label: 'Analytics',    href: '/analytics',   desc: 'Volume & success rates',   icon: TrendingUp },
                    { label: 'Health',       href: '/health',      desc: 'Service status & alerts',   icon: Activity },
                    { label: 'Rate Limits',  href: '/rate-limits', desc: 'Throttling configuration',  icon: Activity },
                ].map(link => (
                    <a key={link.href} href={link.href} className="glass-card p-5 hover:border-white/20 transition-all group block">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                            <link.icon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
                        </div>
                        <p className="text-sm font-semibold text-white group-hover:text-white transition-colors">{link.label}</p>
                        <p className="text-xs text-white/35 mt-0.5">{link.desc}</p>
                    </a>
                ))}
            </div>

        </div>
    );
}
