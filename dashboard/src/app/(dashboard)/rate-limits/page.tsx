'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Shield, RefreshCw, AlertTriangle, CheckCircle2, Gauge,
    Clock, Zap, Globe, Activity, Info
} from 'lucide-react';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateLimitConfig {
    endpoint: string;
    description: string;
    perKeyLimit: number;
    perIpLimit: number;
    windowMs: number;
    icon: React.ElementType;
}

interface KeyUsageStat {
    keyId: string;
    keyName: string;
    requestsLastMinute: number;
    requestsLastHour: number;
    requestsLastDay: number;
    lastUsedAt: string | null;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const RATE_LIMIT_CONFIGS: RateLimitConfig[] = [
    {
        endpoint: 'POST /api/v1/estimate',
        description: 'Fee estimation requests',
        perKeyLimit: 60,
        perIpLimit: 120,
        windowMs: 60_000,
        icon: Gauge,
    },
    {
        endpoint: 'POST /api/v1/broadcast',
        description: 'Single transaction sponsorship',
        perKeyLimit: 20,
        perIpLimit: 30,
        windowMs: 60_000,
        icon: Zap,
    },
    {
        endpoint: 'POST /api/v1/broadcast/batch',
        description: 'Batch sponsorship (up to 25 txs)',
        perKeyLimit: 5,
        perIpLimit: 10,
        windowMs: 60_000,
        icon: Activity,
    },
    {
        endpoint: 'GET /api/dashboard/*',
        description: 'Dashboard API endpoints',
        perKeyLimit: 120,
        perIpLimit: 200,
        windowMs: 60_000,
        icon: Globe,
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWindow(ms: number) {
    if (ms < 60_000) return `${ms / 1000}s`;
    if (ms < 3_600_000) return `${ms / 60_000}m`;
    return `${ms / 3_600_000}h`;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
    const pct = Math.min((used / limit) * 100, 100);
    const color = pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div style={{ width: `${pct}%` }} className={clsx('h-full rounded-full transition-all duration-500', color)} />
            </div>
            <span className="text-[10px] font-mono text-white/40 w-14 text-right">{used}/{limit}</span>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RateLimitsPage() {
    const [keyStats, setKeyStats] = useState<KeyUsageStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/keys');
            if (res.ok) {
                const data = await res.json();
                const keys = Array.isArray(data.apiKeys) ? data.apiKeys : [];
                // Build mock usage stats from key metadata
                setKeyStats(keys.map((k: any) => ({
                    keyId: k.id,
                    keyName: k.name,
                    requestsLastMinute: 0,
                    requestsLastHour: 0,
                    requestsLastDay: 0,
                    lastUsedAt: k.lastUsedAt,
                })));
            }
        } catch (err) {
            console.error('[RateLimits] Fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    async function handleRefresh() {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    }

    return (
        <div className="space-y-7 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">Security · Throttling</p>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Rate Limits</h1>
                    <p className="text-sm text-white/50 mt-1">Per-key and per-IP request limits protecting your relayer.</p>
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

            {/* Info banner */}
            <div className="glass-card p-5 flex items-start gap-4 border border-sky-500/10 bg-sky-500/[0.02]">
                <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-white mb-1">Redis-backed rate limiting</p>
                    <p className="text-xs text-white/50 leading-relaxed">
                        All limits are enforced per sliding window using Redis (with in-memory fallback).
                        Limits apply independently per API key and per IP address.
                        Exceeding a limit returns HTTP 429 with a <code className="text-white/70">Retry-After</code> header.
                    </p>
                </div>
            </div>

            {/* Endpoint limits table */}
            <div className="glass-card overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-3">
                    <Shield className="w-4 h-4 text-white/40" />
                    <div>
                        <h2 className="text-sm font-semibold text-white">Endpoint Limits</h2>
                        <p className="text-xs text-white/40 mt-0.5">Configured limits per endpoint</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                                <th className="px-6 py-3.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">Endpoint</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">Description</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Per Key</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Per IP</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Window</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {RATE_LIMIT_CONFIGS.map(cfg => (
                                <tr key={cfg.endpoint} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                                                <cfg.icon className="w-3.5 h-3.5 text-white/50" />
                                            </div>
                                            <code className="text-xs text-white/80 font-mono">{cfg.endpoint}</code>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-white/50">{cfg.description}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-sm font-bold text-white">{cfg.perKeyLimit}</span>
                                        <span className="text-xs text-white/30 ml-1">req</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-sm font-bold text-white">{cfg.perIpLimit}</span>
                                        <span className="text-xs text-white/30 ml-1">req</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.07] text-xs font-bold text-white/60">
                                            <Clock className="w-3 h-3" />
                                            {formatWindow(cfg.windowMs)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Per-key usage */}
            <div className="glass-card">
                <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-3">
                    <Activity className="w-4 h-4 text-white/40" />
                    <div>
                        <h2 className="text-sm font-semibold text-white">API Key Status</h2>
                        <p className="text-xs text-white/40 mt-0.5">Last activity per key</p>
                    </div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="px-6 py-4 animate-pulse">
                                <div className="flex justify-between mb-3">
                                    <div className="h-3 bg-white/5 rounded-full w-32" />
                                    <div className="h-3 bg-white/5 rounded-full w-20" />
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full" />
                            </div>
                        ))
                    ) : keyStats.length === 0 ? (
                        <div className="px-6 py-10 text-center text-white/30 text-sm">
                            No API keys found. Generate a key to see usage here.
                        </div>
                    ) : keyStats.map(k => (
                        <div key={k.keyId} className="px-6 py-5 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                                    <span className="text-sm font-semibold text-white">{k.keyName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-white/30">
                                        {k.lastUsedAt
                                            ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                                            : 'Never used'}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        Active
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Broadcast limit', limit: 20, used: k.requestsLastMinute },
                                    { label: 'Estimate limit', limit: 60, used: Math.floor(k.requestsLastMinute * 2) },
                                    { label: 'Batch limit', limit: 5, used: 0 },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-[10px] text-white/40">{item.label}</span>
                                            <span className="text-[10px] text-white/30">per min</span>
                                        </div>
                                        <UsageBar used={item.used} limit={item.limit} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Response codes reference */}
            <div className="glass-card p-6">
                <h2 className="text-sm font-semibold text-white mb-5">Rate Limit Response Headers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { header: 'X-RateLimit-Limit', desc: 'Maximum requests allowed in the window' },
                        { header: 'X-RateLimit-Remaining', desc: 'Requests remaining in the current window' },
                        { header: 'X-RateLimit-Reset', desc: 'Unix timestamp when the window resets' },
                        { header: 'Retry-After', desc: 'Seconds to wait before retrying (on 429)' },
                        { header: 'X-RateLimit-IP-Limit', desc: 'IP-level maximum requests in the window' },
                        { header: 'X-RateLimit-IP-Remaining', desc: 'IP-level requests remaining' },
                    ].map(item => (
                        <div key={item.header} className="surface-inset p-4">
                            <code className="text-xs text-sky-400 font-mono block mb-1">{item.header}</code>
                            <p className="text-xs text-white/50">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
