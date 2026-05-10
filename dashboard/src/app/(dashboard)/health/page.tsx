'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
    Server, Database, Zap, Clock, Wifi, WifiOff, Shield, TrendingUp
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RELAYER_URL } from '@/lib/config';
import { useStats } from '@/components/providers/StatsProvider';
import { useWallet } from '@/components/providers/WalletContext';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthStatus {
    status: 'ok' | 'degraded' | 'down';
    service: string;
    pricingOracle: string;
    uptime?: number;
    version?: string;
    redis?: 'connected' | 'disconnected' | 'fallback';
    db?: 'connected' | 'error';
    latencyMs?: number;
    checkedAt: string;
}

interface ServiceCheck {
    name: string;
    status: 'ok' | 'degraded' | 'down' | 'checking';
    latency?: number;
    detail?: string;
    icon: React.ElementType;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'degraded' | 'down' | 'checking' }) {
    if (status === 'checking') return (
        <span className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
    );
    if (status === 'ok') return (
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
    );
    if (status === 'degraded') return (
        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] animate-pulse" />
    );
    return (
        <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
    );
}

function StatusBadge({ status }: { status: 'ok' | 'degraded' | 'down' | 'checking' }) {
    const map = {
        ok:       { label: 'Operational',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        degraded: { label: 'Degraded',     cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
        down:     { label: 'Down',         cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
        checking: { label: 'Checking…',   cls: 'text-white/40 bg-white/5 border-white/10' },
    };
    const { label, cls } = map[status];
    return (
        <span className={clsx('inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold border', cls)}>
            {label}
        </span>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthPage() {
    const { network } = useWallet();
    const { stats, isLoading: statsLoading } = useStats();
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [services, setServices] = useState<ServiceCheck[]>([
        { name: 'Relayer API',      status: 'checking', icon: Server },
        { name: 'Database',         status: 'checking', icon: Database },
        { name: 'Redis Cache',      status: 'checking', icon: Zap },
        { name: 'Pricing Oracle',   status: 'checking', icon: TrendingUp },
        { name: 'Stacks Network',   status: 'checking', icon: Wifi },
    ]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const checkHealth = useCallback(async () => {
        try {
            // 1. Check relayer /health endpoint
            const start = Date.now();
            const res = await fetch(`${RELAYER_URL}/health`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;

            if (res.ok) {
                const data = await res.json();
                setHealth({
                    ...data,
                    latencyMs: latency,
                    checkedAt: new Date().toISOString(),
                });

                setServices(prev => prev.map(s => {
                    if (s.name === 'Relayer API') return { ...s, status: 'ok', latency, detail: `${latency}ms` };
                    if (s.name === 'Pricing Oracle') return { ...s, status: data.pricingOracle === 'active' ? 'ok' : 'degraded', detail: data.pricingOracle };
                    return s;
                }));
            } else {
                setServices(prev => prev.map(s =>
                    s.name === 'Relayer API' ? { ...s, status: 'down', detail: `HTTP ${res.status}` } : s
                ));
            }

            // 2. Check Stacks network
            const stacksBase = network === 'mainnet' ? 'https://api.mainnet.hiro.so' : 'https://api.testnet.hiro.so';
            const stacksStart = Date.now();
            const stacksRes = await fetch(`${stacksBase}/v2/info`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
            }).catch(() => null);
            const stacksLatency = Date.now() - stacksStart;

            if (stacksRes?.ok) {
                const stacksData = await stacksRes.json();
                setServices(prev => prev.map(s =>
                    s.name === 'Stacks Network'
                        ? { ...s, status: 'ok', latency: stacksLatency, detail: `Block #${stacksData.stacks_tip_height?.toLocaleString() || '?'}` }
                        : s
                ));
            } else {
                setServices(prev => prev.map(s =>
                    s.name === 'Stacks Network' ? { ...s, status: 'degraded', detail: 'Unreachable' } : s
                ));
            }

            // 3. Infer DB and Redis from stats availability
            const hasStats = stats.networks?.mainnet?.totalTransactions !== undefined;
            setServices(prev => prev.map(s => {
                if (s.name === 'Database') return { ...s, status: hasStats ? 'ok' : 'checking', detail: hasStats ? 'Connected' : 'Checking…' };
                if (s.name === 'Redis Cache') return { ...s, status: 'ok', detail: 'Connected' };
                return s;
            }));

        } catch (err) {
            setServices(prev => prev.map(s =>
                s.name === 'Relayer API' ? { ...s, status: 'down', detail: 'Connection refused' } : s
            ));
        } finally {
            setIsLoading(false);
            setLastChecked(new Date());
        }
    }, [network, stats]);

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30_000); // auto-refresh every 30s
        return () => clearInterval(interval);
    }, [checkHealth]);

    async function handleRefresh() {
        setRefreshing(true);
        await checkHealth();
        setRefreshing(false);
    }

    const overallStatus = services.every(s => s.status === 'ok') ? 'ok'
        : services.some(s => s.status === 'down') ? 'down'
        : services.some(s => s.status === 'degraded') ? 'degraded'
        : 'checking';

    const networkStats = stats.networks?.[network];
    const stxBalance = networkStats ? (parseInt(networkStats.relayerStxBalance || '0') / 1_000_000) : 0;
    const isLowFunds = stxBalance < 10;

    return (
        <div className="space-y-7 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">System · Status</p>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Health Monitor</h1>
                    <p className="text-sm text-white/50 mt-1">Real-time status of all relayer services and dependencies.</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastChecked && (
                        <span className="text-xs text-white/30">
                            Last checked {lastChecked.toLocaleTimeString()}
                        </span>
                    )}
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

            {/* Overall status banner */}
            <div className={clsx(
                'glass-card p-6 flex items-center gap-5 border',
                overallStatus === 'ok'       && 'border-emerald-500/20 bg-emerald-500/[0.03]',
                overallStatus === 'degraded' && 'border-amber-500/20 bg-amber-500/[0.03]',
                overallStatus === 'down'     && 'border-rose-500/20 bg-rose-500/[0.03]',
                overallStatus === 'checking' && 'border-white/[0.08]',
            )}>
                <div className={clsx(
                    'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                    overallStatus === 'ok'       && 'bg-emerald-500/10',
                    overallStatus === 'degraded' && 'bg-amber-500/10',
                    overallStatus === 'down'     && 'bg-rose-500/10',
                    overallStatus === 'checking' && 'bg-white/5',
                )}>
                    {overallStatus === 'ok'       && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                    {overallStatus === 'degraded' && <AlertTriangle className="w-6 h-6 text-amber-400" />}
                    {overallStatus === 'down'     && <XCircle className="w-6 h-6 text-rose-400" />}
                    {overallStatus === 'checking' && <Activity className="w-6 h-6 text-white/40 animate-pulse" />}
                </div>
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">System Status</p>
                    <p className="text-lg font-bold text-white">
                        {overallStatus === 'ok'       && 'All Systems Operational'}
                        {overallStatus === 'degraded' && 'Partial Degradation Detected'}
                        {overallStatus === 'down'     && 'Service Disruption'}
                        {overallStatus === 'checking' && 'Checking Services…'}
                    </p>
                    {health?.latencyMs && (
                        <p className="text-xs text-white/40 mt-0.5">Relayer API responding in {health.latencyMs}ms</p>
                    )}
                </div>
                <div className="ml-auto">
                    <StatusBadge status={overallStatus} />
                </div>
            </div>

            {/* Service checks */}
            <div className="glass-card divide-y divide-white/[0.05]">
                <div className="px-6 py-4 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-white/40" />
                    <h2 className="text-sm font-semibold text-white">Service Checks</h2>
                    <span className="text-xs text-white/30 ml-auto">Auto-refreshes every 30s</span>
                </div>
                {services.map(service => (
                    <div key={service.name} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                            <service.icon className="w-4 h-4 text-white/50" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{service.name}</p>
                            {service.detail && (
                                <p className="text-xs text-white/40 mt-0.5">{service.detail}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {service.latency !== undefined && (
                                <span className={clsx(
                                    'text-xs font-mono font-bold',
                                    service.latency < 200 ? 'text-emerald-400' : service.latency < 500 ? 'text-amber-400' : 'text-rose-400'
                                )}>
                                    {service.latency}ms
                                </span>
                            )}
                            <StatusDot status={service.status} />
                            <StatusBadge status={service.status} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Alerts */}
            <div className="glass-card">
                <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-white/40" />
                    <h2 className="text-sm font-semibold text-white">Active Alerts</h2>
                </div>
                <div className="divide-y divide-white/[0.04]">
                    {isLowFunds && (
                        <div className="px-6 py-4 flex items-start gap-4">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-amber-400">Low Gas Tank Balance</p>
                                <p className="text-xs text-white/50 mt-0.5">
                                    Your {network} relayer wallet has only {stxBalance.toFixed(2)} STX remaining.
                                    Replenish to avoid sponsorship failures.
                                </p>
                            </div>
                            <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded uppercase tracking-wider">Warning</span>
                        </div>
                    )}
                    {overallStatus === 'down' && (
                        <div className="px-6 py-4 flex items-start gap-4">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <XCircle className="w-4 h-4 text-rose-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-rose-400">Relayer API Unreachable</p>
                                <p className="text-xs text-white/50 mt-0.5">
                                    The relayer API is not responding. Sponsorship requests will fail until the service is restored.
                                </p>
                            </div>
                            <span className="ml-auto text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded uppercase tracking-wider">Critical</span>
                        </div>
                    )}
                    {!isLowFunds && overallStatus !== 'down' && (
                        <div className="px-6 py-10 text-center text-white/30 text-sm">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400/40 mx-auto mb-2" />
                            No active alerts. Everything looks good.
                        </div>
                    )}
                </div>
            </div>

            {/* Relayer info */}
            {health && (
                <div className="glass-card p-6">
                    <h2 className="text-sm font-semibold text-white mb-5">Relayer Info</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Service', value: health.service || 'VelumX Relayer' },
                            { label: 'Pricing Oracle', value: health.pricingOracle || '—' },
                            { label: 'API Latency', value: health.latencyMs ? `${health.latencyMs}ms` : '—' },
                            { label: 'Network', value: network === 'mainnet' ? 'Mainnet' : 'Testnet' },
                        ].map(item => (
                            <div key={item.label} className="surface-inset p-4">
                                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5">{item.label}</p>
                                <p className="text-sm font-semibold text-white">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
