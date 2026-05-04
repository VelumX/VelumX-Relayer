'use client';

import { Bell, Search, User, LogOut, Globe, TestTube2 } from 'lucide-react';
import { useUser } from '@/components/providers/SessionProvider';
import { useWallet } from '@/components/providers/WalletContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function TopNav() {
    const { user } = useUser();
    const { network, setNetwork } = useWallet();
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            toast.success('Signed out');
            router.push('/auth/signin');
            router.refresh();
        } catch {
            toast.error('Failed to sign out');
        }
    };

    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    return (
        <header className="h-[60px] w-full border-b border-white/[0.07] bg-black/80 backdrop-blur-md flex items-center justify-between px-6 z-10 sticky top-0">

            {/* Search */}
            <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                    type="text"
                    placeholder="Search keys, logs, addresses..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all placeholder:text-white/25"
                />
            </div>

            {/* Network toggle */}
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                <button
                    onClick={() => setNetwork('mainnet')}
                    className={clsx(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                        network === 'mainnet'
                            ? 'bg-white/[0.08] text-white border border-white/10'
                            : 'text-white/35 hover:text-white/60'
                    )}
                >
                    <Globe className="w-3 h-3" />
                    Mainnet
                </button>
                <button
                    onClick={() => setNetwork('testnet')}
                    className={clsx(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                        network === 'testnet'
                            ? 'bg-white/[0.08] text-white border border-white/10'
                            : 'text-white/35 hover:text-white/60'
                    )}
                >
                    <TestTube2 className="w-3 h-3" />
                    Testnet
                </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">

                {/* Notifications */}
                <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all border border-transparent hover:border-white/[0.08]">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white rounded-full" />
                </button>

                <div className="w-px h-5 bg-white/[0.08]" />

                {/* User */}
                {user && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-white/60" />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs font-semibold text-white leading-none">{displayName}</p>
                                <p className="text-[10px] text-white/35 mt-0.5 leading-none">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            title="Sign out"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
