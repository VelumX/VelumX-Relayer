'use client';

import { useState } from 'react';
import { Wallet, RefreshCcw, Activity, Copy, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
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

export default function FundingPage() {
    const { network } = useWallet();
    const { stats, adapters, isLoading, refresh } = useStats();

    const s = stats.networks?.[network] || {};
    const relayerAddress   = s.relayerAddress   || 'Not Configured';
    const relayerStxBalance = (parseInt(s.relayerStxBalance || '0') / 1_000_000).toFixed(2);
    const relayerFeeBalance = formatUsd(s.relayerFeeBalance || '0');
    const isLowFunds = parseFloat(relayerStxBalance) < 10;

    const [isAdding, setIsAdding]       = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAdapter, setNewAdapter]   = useState({ name: '', address: '', description: '' });

    const handleAddAdapter = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        try {
            const res = await fetch('/api/adapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAdapter),
            });
            if (res.ok) {
                toast.success('Adapter registered');
                setShowAddModal(false);
                setNewAdapter({ name: '', address: '', description: '' });
                await refresh();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to register adapter');
            }
        } catch {
            toast.error('Connection failed');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteAdapter = async (id: string) => {
        if (!confirm('Remove this adapter?')) return;
        try {
            const res = await fetch(`/api/adapters/${id}`, { method: 'DELETE' });
            if (res.ok) { toast.success('Adapter removed'); await refresh(); }
        } catch { toast.error('Failed to remove adapter'); }
    };

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

                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-white stat-value">
                                {isLoading ? <span className="inline-block w-24 h-10 bg-white/5 rounded animate-pulse" /> : relayerStxBalance}
                            </span>
                            <span className="text-lg text-white/35 font-medium">STX</span>
                        </div>
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

                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-white stat-value">
                                {isLoading ? <span className="inline-block w-24 h-10 bg-white/5 rounded animate-pulse" /> : relayerFeeBalance}
                            </span>
                            <span className="text-lg text-white/35 font-medium">USD</span>
                        </div>
                    </div>

                    <div className="surface-inset p-4">
                        <h4 className="text-xs font-semibold text-white mb-1.5">Universal Gas Revenue</h4>
                        <p className="text-xs text-white/50 leading-relaxed">
                            Fees collected via the Trait-Forwarding Paymaster. Replenish your Gas Tank or withdraw at any time.
                        </p>
                    </div>
                </div>
            </div>

            {/* Adapters */}
            <div className="glass-card">
                <div className="px-7 py-5 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-white/40" />
                        <div>
                            <h2 className="text-sm font-semibold text-white">Gasless Adapters</h2>
                            <p className="text-xs text-white/40 mt-0.5">Universal Executor contracts</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Register Adapter
                    </button>
                </div>

                <div className="p-7">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                            ))}
                        </div>
                    ) : adapters.length === 0 ? (
                        <div className="text-center py-14 border border-dashed border-white/[0.07] rounded-xl">
                            <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-white/30 mb-1">No adapters registered</p>
                            <p className="text-xs text-white/20 max-w-xs mx-auto leading-relaxed">
                                Register your contract principal to enable Universal Gasless features.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adapters.map((adapter) => (
                                <div key={adapter.id} className="group relative p-5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all">
                                    <button
                                        onClick={() => handleDeleteAdapter(adapter.id)}
                                        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="mb-4">
                                        <h3 className="text-sm font-semibold text-white mb-0.5">{adapter.name}</h3>
                                        <p className="text-xs text-white/40 line-clamp-1">{adapter.description || 'No description'}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="surface-inset px-3 py-2.5">
                                            <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1">Contract Principal</p>
                                            <code className="text-xs text-white/65 font-mono truncate block">{adapter.address}</code>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
                                            <span className="text-xs font-semibold text-emerald-400">Active</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Adapter Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="card-elevated w-full max-w-md">
                        <div className="px-7 py-5 border-b border-white/[0.07] flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-white">Register Adapter</h3>
                                <p className="text-xs text-white/40 mt-0.5">Add a Universal Executor contract</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleAddAdapter} className="p-7 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-widest">Adapter Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. My Swap Adapter"
                                    value={newAdapter.name}
                                    onChange={e => setNewAdapter({...newAdapter, name: e.target.value})}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-widest">Contract Principal</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="SP123...executor-name"
                                    value={newAdapter.address}
                                    onChange={e => setNewAdapter({...newAdapter, address: e.target.value})}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 font-mono focus:outline-none focus:border-white/25 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-widest">Description <span className="text-white/25 normal-case tracking-normal font-normal">(optional)</span></label>
                                <textarea
                                    placeholder="Briefly describe what this adapter executes..."
                                    value={newAdapter.description}
                                    onChange={e => setNewAdapter({...newAdapter, description: e.target.value})}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-all min-h-[90px] resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 rounded-lg border border-white/[0.08] text-sm font-semibold text-white/60 hover:text-white hover:bg-white/[0.05] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 py-3 rounded-lg bg-white text-black text-sm font-bold hover:bg-white/90 transition-all disabled:opacity-50"
                                >
                                    {isAdding ? 'Registering…' : 'Register'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
