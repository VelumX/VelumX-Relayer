'use client';

import { Wallet, RefreshCcw, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '@/components/providers/WalletContext';
import { useStats } from '@/components/providers/StatsProvider';

function formatUsd(value: string | number): string {
    const n = parseFloat(value as string) || 0;
    if (n === 0) return '0.00';
    if (n < 0.01) return n.toFixed(6);
    if (n < 1) return n.toFixed(4);
    return n.toFixed(2);
}

export default function FundingPage() {
    const { network } = useWallet();
    const { stats, isLoading } = useStats();

    const s = stats.networks?.[network] || {};
    const relayerAddress    = s.relayerAddress   || 'Not Configured';
    const relayerStxBalance = (parseInt(s.relayerStxBalance || '0') / 1_000_000).toFixed(2);
    const relayerFeeBalance = formatUsd(s.relayerFeeBalance || '0');
    const isLowFunds        = parseFloat(relayerStxBalance) < 10;

    return (
        <div className="space-y-7 pb-12">

            {/* Header */}
            <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">Relayer</p>
                <h1 className="text-2xl font-bold tracking-tight text-white">Relayer Status</h1>
                <p className="text-sm text-white/50 mt-1">Monitor gas abstraction health and manage sponsorship capital.</p>
            </div>

            {/* Balance cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Gas Tank */}
                <div className="glass-card p-7 flex flex-col gap-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white/60" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-white">Gas Tank</h2>
                                <p className="text-xs text-white/40 mt-0.5">STX · Network fees</p>
                            </div>
                        </div>
                        {isLowFunds && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                Low Funds
                            </span>
                        )}
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white stat-value">
                            {isLoading ? <span className="inline-block w-24 h-10 bg-white/5 rounded animate-pulse" /> : relayerStxBalance}
                        </span>
                        <span className="text-lg text-white/35 font-medium">STX</span>
                    </div>

                    <div className="surface-inset p-4">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Hot Wallet Address</p>
                        <div className="flex items-center justify-between gap-3">
                            <code className="text-xs text-white/70 font-mono truncate">{relayerAddress}</code>
                            <button
                                onClick={() => { navigator.clipboard.writeText(relayerAddress); toast.success('Copied'); }}
                                className="flex-shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collected Fees */}
                <div className="glass-card p-7 flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                            <RefreshCcw className="w-5 h-5 text-white/60" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Collected Fees</h2>
                            <p className="text-xs text-white/40 mt-0.5">USD equivalent in relayer wallet</p>
                        </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white stat-value">
                            {isLoading ? <span className="inline-block w-24 h-10 bg-white/5 rounded animate-pulse" /> : relayerFeeBalance}
                        </span>
                        <span className="text-lg text-white/35 font-medium">USD</span>
                    </div>

                    <div className="surface-inset p-4">
                        <h4 className="text-xs font-semibold text-white mb-1.5">Universal Gas Revenue</h4>
                        <p className="text-xs text-white/50 leading-relaxed">
                            Fees collected via the Trait-Forwarding Paymaster. Replenish your Gas Tank or withdraw at any time.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
