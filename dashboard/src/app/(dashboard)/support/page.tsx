'use client';

import { useState } from 'react';
import {
    MessageSquare,
    Zap,
    BookOpen,
    Github,
    Mail,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ExternalLink,
    Terminal,
    ShieldCheck,
    Blocks,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CONTACT_REASONS = [
    { value: 'integration', label: 'SDK Integration' },
    { value: 'sponsorship', label: 'Sponsorship Policy' },
    { value: 'billing', label: 'Billing & Limits' },
    { value: 'incident', label: 'Incident Report' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'other', label: 'Other' },
];

const RESOURCES = [
    {
        icon: BookOpen,
        label: 'Documentation',
        description: 'Full SDK reference, integration guides, and API specs.',
        href: 'https://docs.velumx.xyz',
        cta: 'Read the docs',
    },
    {
        icon: Github,
        label: 'GitHub',
        description: 'Open issues, browse source code, and track releases.',
        href: 'https://github.com/velumx',
        cta: 'View on GitHub',
    },
    {
        icon: Terminal,
        label: 'SDK Quickstart',
        description: 'Get gasless transactions running in under five minutes.',
        href: 'https://docs.velumx.xyz/quickstart',
        cta: 'Start building',
    },
];

const SLA_TIERS = [
    {
        icon: Zap,
        tier: 'Critical',
        description: 'Relayer down or funds at risk',
        sla: '< 2 hours',
        color: 'text-rose-400',
        bg: 'bg-rose-400/10',
        border: 'border-rose-400/20',
    },
    {
        icon: AlertCircle,
        tier: 'High',
        description: 'Integration blocked or key issues',
        sla: '< 8 hours',
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/20',
    },
    {
        icon: MessageSquare,
        tier: 'Standard',
        description: 'General questions and guidance',
        sla: '< 24 hours',
        color: 'text-sky-400',
        bg: 'bg-sky-400/10',
        border: 'border-sky-400/20',
    },
];

export default function SupportPage() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        reason: '',
        projectUrl: '',
        message: '',
    });
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const isValid = form.name.trim() && form.email.trim() && form.reason && form.message.trim().length >= 20;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setStatus('sending');
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to submit request');
            }

            setStatus('sent');
            toast.success('Request submitted — check your inbox for a confirmation.');
        } catch (err: any) {
            setStatus('error');
            toast.error(err.message || 'Something went wrong. Email support@velumx.xyz directly.');
            setStatus('idle');
        }
    };

    return (
        <div className="space-y-10 pb-16 max-w-5xl">

            {/* Header */}
            <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3">Developer Support</p>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
                    We're in your corner.
                </h1>
                <p className="text-white/40 text-sm leading-relaxed max-w-xl">
                    Whether you're integrating the SDK for the first time or running production traffic at scale —
                    the VelumX team is available to help you ship faster and operate with confidence.
                </p>
            </div>

            {/* SLA Tiers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SLA_TIERS.map(({ icon: Icon, tier, description, sla, color, bg, border }) => (
                    <div key={tier} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex flex-col gap-3">
                        <div className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{tier}</p>
                            <p className="text-xs text-white/40 mt-0.5">{description}</p>
                        </div>
                        <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Response SLA</span>
                            <span className={`text-xs font-bold ${color}`}>{sla}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                {/* Contact Form — 3 cols */}
                <div className="lg:col-span-3 bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-white/60" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white">Open a Support Request</h2>
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-0.5">Direct line to the engineering team</p>
                            </div>
                        </div>
                    </div>

                    {status === 'sent' ? (
                        <div className="p-10 flex flex-col items-center justify-center text-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-white mb-1">Request submitted</p>
                                <p className="text-sm text-white/40 max-w-xs">
                                    Your mail client should have opened. If not, email us directly at{' '}
                                    <a href="mailto:support@velumx.xyz" className="text-sky-400 hover:underline">support@velumx.xyz</a>.
                                </p>
                            </div>
                            <button
                                onClick={() => { setStatus('idle'); setForm({ name: '', email: '', reason: '', projectUrl: '', message: '' }); }}
                                className="mt-2 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                            >
                                Submit another request
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Your Name</label>
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
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Email Address</label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="you@yourproject.xyz"
                                        required
                                        className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Reason for Contact</label>
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
                                    Project URL <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
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
                                    placeholder="Describe your integration, the issue you're facing, or what you're trying to build. The more context you provide, the faster we can help."
                                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
                                />
                                <p className="text-[10px] text-white/20 px-1">Minimum 20 characters. Include any relevant transaction IDs or error messages.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={!isValid || status === 'sending'}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {status === 'sending' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Preparing request...
                                    </>
                                ) : (
                                    <>
                                        Send Request
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Right column — 2 cols */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Direct contact */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Direct Contact</p>
                        <div className="space-y-3">
                            <a
                                href="mailto:support@velumx.xyz"
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white">support@velumx.xyz</p>
                                    <p className="text-[10px] text-white/30">General support & integration help</p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0" />
                            </a>
                            <a
                                href="mailto:security@velumx.xyz"
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-rose-400/10 border border-rose-400/20 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white">security@velumx.xyz</p>
                                    <p className="text-[10px] text-white/30">Vulnerability disclosures only</p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0" />
                            </a>
                        </div>
                    </div>

                    {/* Resources */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Self-Service Resources</p>
                        <div className="space-y-2">
                            {RESOURCES.map(({ icon: Icon, label, description, href, cta }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Icon className="w-3.5 h-3.5 text-white/50" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white">{label}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">{description}</p>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400/70 group-hover:text-sky-400 transition-colors mt-1.5">
                                            {cta} <ExternalLink className="w-2.5 h-2.5" />
                                        </span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Partnership CTA */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center flex-shrink-0">
                                <Blocks className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Building something big?</p>
                                <p className="text-[10px] text-white/40 mt-1 leading-relaxed">
                                    If you're integrating VelumX into a high-volume dApp or protocol, reach out for dedicated onboarding, custom limits, and a direct engineering contact.
                                </p>
                                <a
                                    href="mailto:partnerships@velumx.xyz"
                                    className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-bold text-violet-400/70 hover:text-violet-400 transition-colors uppercase tracking-widest"
                                >
                                    Talk to us <ArrowRight className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
