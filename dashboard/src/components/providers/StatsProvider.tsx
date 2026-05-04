'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from './SessionProvider';
import { useWallet } from './WalletContext';
import { RELAYER_URL } from '@/lib/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NetworkStats {
    totalTransactions: number;
    totalSponsored: string;
    relayerAddress: string;
    relayerStxBalance: string;
    relayerFeeBalance: string;
    revenueMainnet?: string;
    feeToken: string;
}

export interface StatsData {
    activeKeys: number;
    networks: {
        mainnet: NetworkStats;
        testnet: NetworkStats;
    };
}

export interface LogEntry {
    id: string;
    txid: string;
    type: string;
    userAddress: string;
    status: string;
    createdAt: string;
    network: string;
    apiKey?: any;
}

interface StatsContextValue {
    stats: StatsData;
    logs: LogEntry[];
    adapters: any[];
    isLoading: boolean;
    /** Force a fresh fetch — use sparingly (e.g. after a mutation) */
    refresh: () => Promise<void>;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_NETWORK_STATS: NetworkStats = {
    totalTransactions: 0,
    totalSponsored: '0',
    relayerAddress: '',
    relayerStxBalance: '0',
    relayerFeeBalance: '0',
    feeToken: 'USD',
};

const DEFAULT_STATS: StatsData = {
    activeKeys: 0,
    networks: {
        mainnet: { ...DEFAULT_NETWORK_STATS },
        testnet: { ...DEFAULT_NETWORK_STATS },
    },
};

// ── Context ───────────────────────────────────────────────────────────────────

const StatsContext = createContext<StatsContextValue>({
    stats: DEFAULT_STATS,
    logs: [],
    adapters: [],
    isLoading: true,
    refresh: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function StatsProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: userLoading } = useUser();
    const { network } = useWallet();

    const [stats, setStats] = useState<StatsData>(DEFAULT_STATS);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [adapters, setAdapters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Track whether we've fetched at least once per network so we don't
    // show the loading state again when navigating between pages.
    const fetchedNetworks = useRef<Set<string>>(new Set());
    const isFetchingRef = useRef(false);

    const fetchAll = useCallback(async (force = false) => {
        if (!user) return;
        if (isFetchingRef.current) return;

        // If we already have data for this network and it's not a forced refresh,
        // skip the fetch entirely — data stays on screen instantly.
        if (!force && fetchedNetworks.current.has(network)) return;

        isFetchingRef.current = true;
        // Only show the loading skeleton on the very first load
        if (!fetchedNetworks.current.has(network)) setIsLoading(true);

        try {
            const supabase = (await import('@/lib/supabase/client')).createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const [statsRes, logsRes, adaptersRes] = await Promise.all([
                fetch(`${RELAYER_URL}/api/dashboard/stats`, {
                    cache: 'no-store',
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch(`${RELAYER_URL}/api/dashboard/logs?network=${network}`, {
                    cache: 'no-store',
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch('/api/adapters', { cache: 'no-store' }),
            ]);

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
            if (logsRes.ok) {
                const data = await logsRes.json();
                setLogs(Array.isArray(data) ? data : []);
            }
            if (adaptersRes.ok) {
                const data = await adaptersRes.json();
                setAdapters(data.adapters || []);
            }

            fetchedNetworks.current.add(network);
        } catch (err) {
            console.error('[StatsProvider] Fetch failed:', err);
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [user, network]);

    // Fetch when user is ready or network switches
    useEffect(() => {
        if (!userLoading && user) {
            fetchAll();
        }
    }, [user, userLoading, network, fetchAll]);

    const refresh = useCallback(() => {
        // Clear the cache for the current network so the next fetchAll goes through
        fetchedNetworks.current.delete(network);
        return fetchAll(true);
    }, [network, fetchAll]);

    return (
        <StatsContext.Provider value={{ stats, logs, adapters, isLoading, refresh }}>
            {children}
        </StatsContext.Provider>
    );
}

export function useStats() {
    return useContext(StatsContext);
}
