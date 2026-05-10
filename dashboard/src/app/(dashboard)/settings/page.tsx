'use client';

import { useState, useEffect } from 'react';
import {
    User, Mail, Shield, Bell, Globe, Key, Save, AlertTriangle,
    CheckCircle2, Copy, ExternalLink, LogOut, Trash2, Eye, EyeOff
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/components/providers/SessionProvider';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="glass-card overflow-hidden">
            <div className="px-7 py-5 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
            </div>
            <div className="p-7">{children}</div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { user } = useUser();
    const router = useRouter();
    const supabase = createClient();

    const [displayName, setDisplayName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');

    useEffect(() => {
        if (user) {
            setDisplayName(user.user_metadata?.name || user.email?.split('@')[0] || '');
        }
    }, [user]);

    async function handleSaveProfile() {
        if (!displayName.trim()) {
            toast.error('Display name cannot be empty');
            return;
        }
        setIsSavingProfile(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { name: displayName.trim() }
            });
            if (error) throw error;
            toast.success('Profile updated');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setIsSavingProfile(false);
        }
    }

    async function handleChangePassword() {
        if (!newPassword || newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        setIsSavingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast.success('Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update password');
        } finally {
            setIsSavingPassword(false);
        }
    }

    async function handleSignOut() {
        await supabase.auth.signOut();
        router.push('/auth/signin');
    }

    function copyUserId() {
        if (user?.id) {
            navigator.clipboard.writeText(user.id);
            toast.success('User ID copied');
        }
    }

    const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

    return (
        <div className="space-y-7 pb-12 max-w-2xl">

            {/* Header */}
            <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">Account</p>
                <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
                <p className="text-sm text-white/50 mt-1">Manage your account preferences and security.</p>
            </div>

            {/* Profile */}
            <Section title="Profile" description="Your public display name and account info.">
                <div className="space-y-5">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-7 h-7 text-white/40" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">{user?.email}</p>
                            <p className="text-xs text-white/40 mt-0.5">
                                {isOAuthUser ? `Signed in via ${user?.app_metadata?.provider}` : 'Email & Password'}
                            </p>
                        </div>
                    </div>

                    {/* Display name */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-all"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Email</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="email"
                                value={user?.email || ''}
                                readOnly
                                className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white/50 cursor-not-allowed"
                            />
                            <div className="px-3 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                                <Mail className="w-4 h-4 text-white/30" />
                            </div>
                        </div>
                        <p className="text-[10px] text-white/25">Email cannot be changed here. Contact support if needed.</p>
                    </div>

                    {/* User ID */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">User ID</label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-4 py-3 bg-black/40 border border-white/[0.06] rounded-lg text-xs text-white/50 font-mono truncate">
                                {user?.id || '—'}
                            </code>
                            <button
                                onClick={copyUserId}
                                className="p-3 bg-white/[0.04] border border-white/[0.07] rounded-lg text-white/30 hover:text-white hover:bg-white/[0.08] transition-all"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-white/25">This is your Project ID — use it when initializing the VelumX SDK.</p>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-white/90 transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isSavingProfile ? 'Saving…' : 'Save Profile'}
                    </button>
                </div>
            </Section>

            {/* Password */}
            {!isOAuthUser && (
                <Section title="Password" description="Change your account password.">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 pr-10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                                >
                                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Confirm Password</label>
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                className={clsx(
                                    'w-full bg-white/[0.04] border rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none transition-all',
                                    confirmPassword && newPassword !== confirmPassword
                                        ? 'border-rose-500/40 focus:border-rose-500/60'
                                        : 'border-white/[0.08] focus:border-white/25'
                                )}
                            />
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs text-rose-400">Passwords do not match</p>
                            )}
                        </div>

                        <button
                            onClick={handleChangePassword}
                            disabled={isSavingPassword || !newPassword || newPassword !== confirmPassword}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Shield className="w-4 h-4" />
                            {isSavingPassword ? 'Updating…' : 'Update Password'}
                        </button>
                    </div>
                </Section>
            )}

            {/* Session */}
            <Section title="Session" description="Manage your active session.">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Sign out of all devices</p>
                        <p className="text-xs text-white/40 mt-0.5">This will invalidate your current session.</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </Section>

            {/* Danger zone */}
            <div className="glass-card overflow-hidden border border-rose-500/10">
                <div className="px-7 py-5 border-b border-rose-500/10 bg-rose-500/[0.02]">
                    <h2 className="text-sm font-semibold text-rose-400">Danger Zone</h2>
                    <p className="text-xs text-white/40 mt-0.5">Irreversible actions. Proceed with caution.</p>
                </div>
                <div className="p-7">
                    <div className="flex items-start gap-4 p-5 border border-rose-500/10 rounded-xl bg-rose-500/[0.02]">
                        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white mb-1">Delete Account</p>
                            <p className="text-xs text-white/50 mb-4 leading-relaxed">
                                Permanently delete your account and all associated data including API keys, transaction logs, and relayer configuration.
                                This action cannot be undone.
                            </p>
                            {!isDeletingAccount ? (
                                <button
                                    onClick={() => setIsDeletingAccount(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Account
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-white/60">
                                        Type <strong className="text-white">DELETE</strong> to confirm:
                                    </p>
                                    <input
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={e => setDeleteConfirm(e.target.value)}
                                        placeholder="DELETE"
                                        className="w-full bg-rose-500/5 border border-rose-500/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-rose-500/40 transition-all"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setIsDeletingAccount(false); setDeleteConfirm(''); }}
                                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={deleteConfirm !== 'DELETE'}
                                            className="px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            onClick={() => toast.error('Account deletion requires contacting support.')}
                                        >
                                            Permanently Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
