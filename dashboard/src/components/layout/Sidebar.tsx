'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Key,
    Wallet,
    Activity,
    LifeBuoy,
    BarChart3,
    HeartPulse,
    Shield,
    Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useWallet } from '../providers/WalletContext';

const navGroups = [
    {
        label: 'Main',
        items: [
            { name: 'Overview',         href: '/',            icon: LayoutDashboard },
            { name: 'Analytics',        href: '/analytics',   icon: BarChart3 },
        ],
    },
    {
        label: 'Relayer',
        items: [
            { name: 'API Keys',         href: '/api-keys',    icon: Key },
            { name: 'Relayer Status',   href: '/funding',     icon: Wallet },
            { name: 'Tx Logs',          href: '/logs',        icon: Activity },
        ],
    },
    {
        label: 'System',
        items: [
            { name: 'Health',           href: '/health',      icon: HeartPulse },
            { name: 'Rate Limits',      href: '/rate-limits', icon: Shield },
        ],
    },
    {
        label: 'Account',
        items: [
            { name: 'Settings',         href: '/settings',    icon: Settings },
            { name: 'Support',          href: '/support',     icon: LifeBuoy },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { network } = useWallet();

    return (
        <aside className="w-60 h-full flex flex-col bg-[#000] border-r border-white/[0.07]">

            {/* Logo */}
            <div className="px-5 pt-7 pb-6 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Image src="/velumx-logo.svg" alt="VelumX" width={18} height={18} />
                </div>
                <div>
                    <span className="text-[13px] font-bold tracking-widest text-white uppercase">VelumX</span>
                    <p className="text-[9px] text-white/30 font-medium tracking-widest uppercase mt-0.5">Developer Console</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-5 overflow-y-auto custom-scrollbar pb-4">
                {navGroups.map(group => (
                    <div key={group.label}>
                        <p className="text-[9px] font-bold text-white/25 uppercase tracking-[0.18em] px-3 mb-1.5">{group.label}</p>
                        <div className="space-y-0.5">
                            {group.items.map(({ name, href, icon: Icon }) => {
                                const isActive = pathname === href;
                                return (
                                    <Link key={name} href={href}>
                                        <div className={clsx(
                                            'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                                            isActive
                                                ? 'bg-white/[0.08] text-white'
                                                : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                                        )}>
                                            {isActive && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />
                                            )}
                                            <Icon className={clsx(
                                                'w-[15px] h-[15px] flex-shrink-0 transition-colors',
                                                isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'
                                            )} />
                                            <span className={clsx(
                                                'text-[13px] font-medium tracking-tight',
                                                isActive ? 'font-semibold' : ''
                                            )}>
                                                {name}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Network status */}
            <div className="p-3 mt-auto border-t border-white/[0.05]">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.16em] mb-2.5">Network</p>
                    <div className="flex items-center gap-2">
                        <span className={clsx(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            network === 'mainnet' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                        )} />
                        <span className={clsx(
                            'text-xs font-semibold',
                            network === 'mainnet' ? 'text-emerald-400' : 'text-amber-400'
                        )}>
                            {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                        </span>
                        <span className="ml-auto text-[9px] font-bold text-white/20 uppercase tracking-wider">Live</span>
                    </div>
                </div>
            </div>

        </aside>
    );
}
