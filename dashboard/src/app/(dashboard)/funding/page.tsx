'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/components/providers/SessionProvider';
import { Wallet, RefreshCcw, History, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '@/components/providers/WalletContext';
import { RELAYER_URL } from '@/lib/config';

// Format a USD value with enough precision to show small amounts
function formatUsd(value: string | number): string {
  const n = parseFloat(value as string) || 0;
  if (n === 0) return '0.00';
  if (n < 0.01) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(2);
}

export default function FundingPage() {
    const [isClient, setIsClient] = useState(false);
    const { user, loading: userLoading } = useUser();
    const { network } = useWallet();
    const [stats, setStats] = useState({
        relayerAddress: 'Loading...',
        relayerStxBalance: '0',
        relayerFeeBalance: '0',
    });
    const [logs, setLogs] = useState<any[]>([]);
    const [adapters, setAdapters] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAdapter, setNewAdapter] = useState({ name: '', address: '', description: '' });

    const fetchAllData = async () => {
        if (!user) return;
        setIsFetching(true);
        try {
            const supabase = (await import('@/lib/supabase/client')).createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            // Clear cache
            await fetch(`${RELAYER_URL}/api/dashboard/cache-clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => {});

            const [statsRes, logsRes, adaptersRes] = await Promise.all([
                fetch(`${RELAYER_URL}/api/dashboard/stats`, { cache: 'no-store', headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${RELAYER_URL}/api/dashboard/logs?network=${network}`, { cache: 'no-store', headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/adapters`, { cache: 'no-store' }),
            ]);

            if (statsRes.ok) {
                const data = await statsRes.json();
                const s = data.networks?.[network] || {};
                setStats({
                    relayerAddress: s.relayerAddress || 'Not Configured',
                    relayerStxBalance: (parseInt(s.relayerStxBalance || '0') / 1_000_000).toFixed(2),
                    relayerFeeBalance: formatUsd(s.relayerFeeBalance || '0'),
                });
            }

            if (logsRes.ok) {
                const logsData = await logsRes.json();
                setLogs(Array.isArray(logsData) ? logsData.slice(0, 5) : []);
            }

            if (adaptersRes.ok) {
                const data = await adaptersRes.json();
                setAdapters(data.adapters || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsFetching(false);
        }
    };

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
                toast.success('Adapter registered successfully!');
                setShowAddModal(false);
                setNewAdapter({ name: '', address: '', description: '' });
                fetchAllData();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to register adapter');
            }
        } catch (error) {
            toast.error('Connection failed');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteAdapter = async (id: string) => {
        if (!confirm('Are you sure you want to remove this adapter?')) return;
        
        try {
            const res = await fetch(`/api/adapters/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Adapter removed');
                fetchAllData();
            }
        } catch (error) {
            toast.error('Failed to remove adapter');
        }
    };

    useEffect(() => {
        setIsClient(true);
        if (!userLoading) fetchAllData();
    }, [network, user, userLoading]);

    if (!isClient) return null;

    return (
        <div className="space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Relayer Status</h1>
                <p className="text-white/40 text-sm font-medium">Monitor your Universal gas abstraction health and manage sponsorship capital.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* STX Balance (Gas Tank) */}
                <div className="glass-card p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
                                    <Wallet className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Gas Tank (STX)</h2>
                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-tight">Used to pay network fees</p>
                                </div>
                            </div>
                            {parseFloat(stats.relayerStxBalance) < 10 && (
                                <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/20 uppercase animate-pulse">Low Funds</span>
                            )}
                        </div>
                        <div className="mb-8">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-white font-mono">{isFetching ? '...' : stats.relayerStxBalance}</span>
                                <span className="text-lg text-white/40 font-bold">STX</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-black rounded-xl border border-white/5">
                            <p className="text-[10px] text-white/20 uppercase font-bold mb-2">Relayer Hot Wallet Address</p>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-xs text-white/60 truncate font-mono">{stats.relayerAddress}</code>
                                <button
                                    onClick={() => navigator.clipboard.writeText(stats.relayerAddress)}
                                    className="text-[10px] font-bold text-white/40 hover:text-white uppercase transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Collected Fees */}
                <div className="glass-card p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20">
                                <RefreshCcw className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Collected Fees</h2>
                                <p className="text-[10px] text-white/40 uppercase font-bold tracking-tight">USD equivalent in relayer wallet</p>
                            </div>
                        </div>
                        <div className="mb-8">
                            <div className="flex baseline gap-2">
                                <span className="text-5xl font-black text-white font-mono">{isFetching ? '...' : stats.relayerFeeBalance}</span>
                                <span className="text-lg text-white/40 font-bold">USD</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-white/[0.02] border border-white/10 rounded-xl">
                        <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-tight">V4 Multi-Tenant Revenue</h4>
                        <p className="text-[10px] text-white/40 leading-relaxed">
                            Fees from your users flow directly to this address. Use these funds to replenish your STX Gas Tank or withdraw at any time.
                        </p>
                    </div>
                </div>
            </div>

            {/* Adapters Section (Replaces History) */}
            <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                        <Activity className="w-4 h-4 text-white/40" />
                        Gasless Adapters (Universal Executors)
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-1.5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded transition-all hover:bg-white/90"
                    >
                        Register Adapter
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isFetching ? (
                        <div className="col-span-full text-center py-12 text-white/10 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                            Loading Adapters...
                        </div>
                    ) : adapters.length === 0 ? (
                        <div className="col-span-full text-center py-16 border border-dashed border-white/5 rounded-2xl">
                            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-4">No Adapters Registered</p>
                            <p className="text-[10px] text-white/10 max-w-xs mx-auto leading-relaxed">
                                Register your contract principal to unlock Universal Gasless features for your custom dApp logic.
                            </p>
                        </div>
                    ) : adapters.map((adapter) => (
                        <div key={adapter.id} className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl hover:bg-white/[0.03] transition-all group relative">
                            <button 
                                onClick={() => handleDeleteAdapter(adapter.id)}
                                className="absolute top-4 right-4 text-white/10 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </button>
                            <div className="mb-4">
                                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">{adapter.name}</h3>
                                <p className="text-[10px] text-white/40 font-medium line-clamp-1">{adapter.description || 'No description'}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
                                    <p className="text-[8px] text-white/20 uppercase font-black mb-1.5 tracking-tighter">Contract Principal</p>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <code className="text-[10px] text-white/60 font-mono truncate">{adapter.address}</code>
                                    </div>
                                </div>
                                <div className="p-2.5 bg-emerald-500/[0.03] rounded-lg border border-emerald-500/10">
                                    <p className="text-[8px] text-emerald-400/40 uppercase font-black mb-1.5 tracking-tighter">Status</p>
                                    <p className="text-[9px] font-bold text-emerald-400">READY FOR V4</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal for adding adapter */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 selection:bg-white/10">
                    <div className="bg-[#050505] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-widest">Register Adapter</h3>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-1">Add your Universal Executor</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddAdapter} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Adapter Name</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="e.g. My-Swap-Adapter"
                                    value={newAdapter.name}
                                    onChange={e => setNewAdapter({...newAdapter, name: e.target.value})}
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Contract Principal</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="SP123...executor-name"
                                    value={newAdapter.address}
                                    onChange={e => setNewAdapter({...newAdapter, address: e.target.value})}
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-white/10 font-mono focus:outline-none focus:border-white/30 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Description (Optional)</label>
                                <textarea 
                                    placeholder="Briefly describe what this adapter executes..."
                                    value={newAdapter.description}
                                    onInput={e => {
                                        const target = e.target as HTMLTextAreaElement;
                                        setNewAdapter({...newAdapter, description: target.value});
                                    }}
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-all min-h-[100px] resize-none"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="submit" disabled={isAdding} className="flex-1 bg-white text-black text-[11px] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-white/90 transition-all disabled:opacity-50">
                                    {isAdding ? 'Processing...' : 'Complete Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
