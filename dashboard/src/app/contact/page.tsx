'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Mail,
    Github,
    BookOpen,
    Blocks,
    ShieldCheck,
    Zap,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CONTACT_REASONS = [
    { value: 'integration', label: 'SDK Integration' },
    { value: 'partnership', label: 'Partnership & Collaboration' },
    { value: 'sponsorship', label: 'Sponsorship Policy' },
    { value: 'enterprise', label: 'Enterprise / High-Volume' },
    { value: 'other', label: 'Other' },
];

const HIGHLIGHTS = [
    {
        icon: Zap,
        title: 'Gasless by default',
        body: 'Abstract gas fees entirely from your users. One SDK call, zero friction.',
    },
    {
        icon: Blocks,
        title: 'Built for Stacks',
        body: 'Native support for Stacks transactions, SIP-010 tokens, and contract calls.',
    },
    {
        icon: ShieldCheck,
        title: 'Non-custodial',
        body: 'Your relayer wallet, your keys. VelumX never holds your funds.',
    },
];

export default function ContactPage() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        reason: '',
        projectUrl: '',
        message: '',
    });
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const isValid =
        form.name.trim() &&
        form.email.trim() &&
        form.reason &&
        form.message.trim().length >= 20;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setStatus('sending');
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to submit');
            }

            setStatus('sent');
            toast.success('Message sent — we\'ll be in touch shortly.');
        } catch (err: any) {
            setStatus('error');
            toast.error(err.message || 'Something went wrong. Email partnerships@velumx.xyz directly.');
            setStatus('idle');
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <Toaster position="top-right" />

            {/* Nav */}
            <header className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                        <span className="text-xs font-black text-white">V</span>
                    </div>
                    <span className="text-sm font-bold tracking-tight uppercase text-white">VelumX</span>
                </div>
                <div className="flex items-center gap-6">
                    <a
                        href="https://docs.velumx.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Docs
                    </a>
                    <a
                        href="https://github.com/velumx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                    >
                        GitHub
                    </a>
                    <Link
                        href="/auth/signin"
                        className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-colors"
                    >
                        Sign In
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                {/* Left — pitch */}
                <div className="space-y-10">
                    <div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">
                            Get in touch
                        </p>
                        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-5">
                            Let's build the<br />
                            <span className="text-white/40">gasless future</span><br />
                            together.
                        </h1>
                        <p className="text-sm text-white/40 leading-relaxed max-w-sm">
                            Whether you're integrating VelumX into your dApp, exploring a partnership,
                            or running high-volume transactions — we want to hear from you.
                        </p>
                    </div>

                    {/* Feature highlights */}
                    <div className="space-y-4">
                        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                            <div key={title} className="flex items-start gap-4">
                                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4 text-white/50" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{title}</p>
                                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Direct contacts */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Direct contact</p>
                        <a
                            href="mailto:partnerships@velumx.xyz"
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
                                <Mail className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-white">partnerships@velumx.xyz</p>
                                <p className="text-[10px] text-white/30">Partnerships & enterprise integrations</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors" />
                        </a>
                        <a
                            href="mailto:support@velumx.xyz"
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center">
                                <Mail className="w-3.5 h-3.5 text-sky-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-white">support@velumx.xyz</p>
                                <p className="text-[10px] text-white/30">Technical support & SDK questions</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors" />
                        </a>
                        <a
                            href="https://github.com/velumx"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <Github className="w-3.5 h-3.5 text-white/50" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-white">github.com/velumx</p>
                                <p className="text-[10px] text-white/30">Open source SDK & contracts</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors" />
                        </a>
                    </div>
                </div>

                {/* Right — form */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-7 py-5 border-b border-white/[0.06] bg-white/[0.02]">
                        <h2 className="text-sm font-bold text-white">Send us a message</h2>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                            We respond within 24 hours
                        </p>
                    </div>

                    {status === 'sent' ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center gap-5">
                            <div className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-white mb-2">Message received</p>
                                <p className="text-sm text-white/40 max-w-xs leading-relaxed">
                                    The VelumX team will review your message and get back to you at the email you provided.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setStatus('idle');
                                    setForm({ name: '', email: '', reason: '', projectUrl: '', message: '' });
                                }}
                                className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-7 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Name</label>
                                    <input
                                        name="name"
                                        value={form.name}
                                        onChange={handleChange}
                                        placeholder="Satoshi Nakamoto"
                                        required
                                        className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Email</label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="you@project.xyz"
                                        required
                                        className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Reason</label>
                                <select
                                    name="reason"
                                    value={form.reason}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 transition-colors appearance-none"
                                >
                                    <option value="" disabled className="bg-black">Select a category...</option>
                                    {CONTACT_REASONS.map(r => (
                                        <option key={r.value} value={r.value} className="bg-black">{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                    Project URL{' '}
                                    <span className="text-white/20 normal-case tracking-normal font-normal">— optional</span>
                                </label>
                                <input
                                    name="projectUrl"
                                    value={form.projectUrl}
                                    onChange={handleChange}
                                    placeholder="https://yourproject.xyz"
                                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Message</label>
                                <textarea
                                    name="message"
                                    value={form.message}
                                    onChange={handleChange}
                                    rows={5}
                                    required
                                    minLength={20}
                                    placeholder="Tell us about your project, what you're building, and how VelumX fits in. The more context, the better."
                                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
                                />
                                <p className="text-[10px] text-white/20 px-1">Minimum 20 characters.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={!isValid || status === 'sending'}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {status === 'sending' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Message
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/[0.06] px-6 py-6 mt-8">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <p className="text-[11px] text-white/20">
                        © {new Date().getFullYear()} VelumX. Gasless infrastructure for Stacks.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="https://docs.velumx.xyz" target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-white/20 hover:text-white/60 transition-colors">
                            Documentation
                        </a>
                        <a href="https://github.com/velumx" target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-white/20 hover:text-white/60 transition-colors">
                            GitHub
                        </a>
                        <a href="mailto:security@velumx.xyz"
                            className="text-[11px] text-white/20 hover:text-white/60 transition-colors">
                            Security
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
