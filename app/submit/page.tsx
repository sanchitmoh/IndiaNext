'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc-client';
import {
  CheckCircle2, XCircle, Github, Globe, Smartphone,
  ArrowLeft, Loader2, Presentation,
  Users, Code2, Lightbulb, Rocket, AlertTriangle,
  Lock, Search,
} from 'lucide-react';

// ── Word Counter ─────────────────────────────────────────────────────────────
function WordCount({ text, max }: { text: string; max: number }) {
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const pct = Math.min((words / max) * 100, 100);
  const over = words > max;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono ${over ? 'text-red-400' : 'text-gray-600'}`}>
        {words}/{max}w
      </span>
    </div>
  );
}

// ── Form Input ──────────────────────────────────────────────────────────────
function FormField({
  label, required, hint, error, children
}: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
        {label}
        {required && <span className="text-orange-400">*</span>}
        {hint && <span className="text-gray-700 normal-case font-normal ml-1">({hint})</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-[10px] font-mono text-red-400">
          <XCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm font-mono bg-[#0d0d0d] border border-white/[0.07] rounded-lg text-gray-200 placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/30 transition-all";
const textareaCls = `${inputCls} resize-none leading-relaxed`;

// ── Step 1: Verify ──────────────────────────────────────────────────────────
function StepVerify({
  onVerified,
}: {
  onVerified: (data: any, email: string) => void;
}) {
  const [shortCode, setShortCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const verify = trpc.team.verifyTeamForSubmission.useMutation({
    onSuccess: (data) => {
      setError('');
      onVerified(data, email);
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    if (!shortCode.trim() || !email.trim()) {
      setError('Both fields are required.');
      return;
    }
    verify.mutate({ shortCode: shortCode.trim().toUpperCase(), leaderEmail: email.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormField label="Team Short Code" required hint="e.g. IND-001">
        <input
          type="text"
          value={shortCode}
          onChange={e => setShortCode(e.target.value.toUpperCase())}
          placeholder="IND-001"
          maxLength={20}
          className={`${inputCls} font-black text-orange-300 tracking-widest`}
          autoFocus
        />
      </FormField>

      <FormField label="Leader Email" required hint="Team leader's registered email">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="leader@example.com"
          className={inputCls}
        />
      </FormField>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs font-mono text-red-300">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={verify.isPending}
        className="w-full py-3 text-sm font-mono font-bold bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {verify.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> VERIFYING...</>
        ) : (
          <><Search className="h-4 w-4" /> VERIFY TEAM</>
        )}
      </button>

      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
        <Lock className="h-3.5 w-3.5 text-gray-600 shrink-0" />
        <p className="text-[10px] font-mono text-gray-600">
          Only the registered team leader can submit. Your email is verified against the registration database.
        </p>
      </div>
    </form>
  );
}

// ── Team Info Card ──────────────────────────────────────────────────────────
function TeamCard({ data }: { data: any }) {
  return (
    <div className="bg-gradient-to-br from-orange-500/5 to-violet-500/5 border border-orange-500/15 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-mono font-black text-white">{data.teamName}</p>
          <p className="text-[10px] font-mono text-orange-400 mt-0.5">{data.shortCode}</p>
        </div>
        <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded border ${data.track === 'IDEA_SPRINT' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-orange-400 bg-orange-500/10 border-orange-500/20'}`}>
          {data.track === 'IDEA_SPRINT' ? '💡 IDEA SPRINT' : '⚡ BUILD STORM'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="h-3 w-3 text-gray-600" />
        {data.members.map((m: any, i: number) => (
          <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${m.role === 'LEADER' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-white/[0.03] text-gray-500 border border-white/[0.06]'}`}>
            {m.name} {m.role === 'LEADER' ? '(Leader)' : ''}
          </span>
        ))}
      </div>
      {data.hasSubmission && (
        <div className="flex items-center gap-2 text-amber-400 text-[10px] font-mono">
          <AlertTriangle className="h-3.5 w-3.5" />
          You have already submitted. Continuing will update your submission.
        </div>
      )}
    </div>
  );
}

// ── Step 2: Submission Form ─────────────────────────────────────────────────
function StepForm({
  teamData,
  leaderEmail,
  onSuccess,
  onBack,
}: {
  teamData: any;
  leaderEmail: string;
  onSuccess: (teamName: string) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    githubLink: '',
    presentationLink: '',
    liveUrl: '',
    appDownloadUrl: '',
    solutionQ1: '',
    solutionQ2: '',
    solutionQ3: '',
    solutionQ4: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const topRef = useRef<HTMLFormElement>(null);

  const submit = trpc.team.submitProject.useMutation({
    onSuccess: (data) => onSuccess(data.teamName),
    onError: (e) => {
      setErrors({ _global: e.message });
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  const set = (key: string, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const Q_LIMITS = [
      { key: 'solutionQ1', min: 10, max: 150, label: 'Q1' },
      { key: 'solutionQ2', min: 10, max: 200, label: 'Q2' },
      { key: 'solutionQ3', min: 10, max: 150, label: 'Q3' },
      { key: 'solutionQ4', min: 10, max: 100, label: 'Q4' },
    ];
    const countWords = (t: string) => t.trim() === '' ? 0 : t.trim().split(/\s+/).length;
    const errs: Record<string, string> = {};
    if (!form.githubLink.startsWith('https://github.com/'))
      errs.githubLink = 'Must be a GitHub repository URL (https://github.com/...)';
    if (!form.liveUrl.startsWith('http'))
      errs.liveUrl = 'Must be a valid URL starting with http/https';
    for (const { key, min, max, label } of Q_LIMITS) {
      const w = countWords(form[key as keyof typeof form]);
      if (w < min) errs[key] = `${label} needs at least ${min} words (you have ${w})`;
      else if (w > max) errs[key] = `${label} exceeds ${max}-word limit (${w} words — trim ${w - max})`;
    }
    return errs;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    submit.mutate({
      teamId: teamData.teamId,
      leaderEmail,
      ...form,
      presentationLink: form.presentationLink || undefined,
      appDownloadUrl: form.appDownloadUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" ref={topRef}>
      <TeamCard data={teamData} />

      {errors._global && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs font-mono text-red-300">{errors._global}</p>
        </div>
      )}

      {/* ── Links ── */}
      <section className="space-y-4">
        <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <Code2 className="h-3 w-3" /> PROJECT LINKS
        </h3>

        <FormField label="GitHub Repository" required hint="must be https://github.com/..." error={errors.githubLink}>
          <div className="relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input type="url" value={form.githubLink} onChange={e => set('githubLink', e.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              className={`${inputCls} pl-9 ${errors.githubLink ? 'border-red-500/30 ring-1 ring-red-500/20' : ''}`} />
          </div>
        </FormField>

        <FormField label="Presentation / Slide Deck" hint="Google Drive link — optional">
          <div className="relative">
            <Presentation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input type="url" value={form.presentationLink} onChange={e => set('presentationLink', e.target.value)}
              placeholder="https://drive.google.com/..."
              className={`${inputCls} pl-9`} />
          </div>
        </FormField>
      </section>

      {/* ── Deployment ── */}
      <section className="space-y-4">
        <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <Rocket className="h-3 w-3" /> DEPLOYMENT
        </h3>

        <FormField label="Live Website URL" required hint="deployed app — compulsory" error={errors.liveUrl}>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input type="url" value={form.liveUrl} onChange={e => set('liveUrl', e.target.value)}
              placeholder="https://your-app.vercel.app"
              className={`${inputCls} pl-9 ${errors.liveUrl ? 'border-red-500/30' : ''}`} />
          </div>
        </FormField>

        <FormField label="App Download Link" hint="APK / App Store / Play Store — optional">
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input type="url" value={form.appDownloadUrl} onChange={e => set('appDownloadUrl', e.target.value)}
              placeholder="https://play.google.com/..."
              className={`${inputCls} pl-9`} />
          </div>
        </FormField>
      </section>

      {/* ── Q&A ── */}
      <section className="space-y-5">
        <h3 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <Lightbulb className="h-3 w-3" /> SOLUTION EXPLANATION
        </h3>

        {[
          { key: 'solutionQ1', label: 'Q1. What problem are you solving?', max: 150, required: true },
          { key: 'solutionQ2', label: 'Q2. How does your solution work?', max: 200, required: true },
          { key: 'solutionQ3', label: 'Q3. What makes your solution unique?', max: 150, required: true },
          { key: 'solutionQ4', label: 'Q4. How scalable is your solution?', max: 100, required: true },
        ].map(({ key, label, max, required }) => (
          <FormField key={key} label={label} required={required} hint={`${max} words max`} error={errors[key]}>
            <textarea
              value={form[key as keyof typeof form]}
              onChange={e => set(key, e.target.value)}
              rows={4}
              placeholder={`Write your answer here (up to ${max} words)...`}
              className={`${textareaCls} ${errors[key] ? 'border-red-500/30' : ''}`}
            />
            <WordCount text={form[key as keyof typeof form]} max={max} />
          </FormField>
        ))}
      </section>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="px-4 py-2.5 text-xs font-mono font-bold text-gray-500 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:bg-white/[0.06] transition-all flex items-center gap-2">
          <ArrowLeft className="h-3.5 w-3.5" /> BACK
        </button>
        <button type="submit" disabled={submit.isPending}
          className="flex-1 py-2.5 text-sm font-mono font-bold bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {submit.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> SUBMITTING...</>
          ) : (
            <><Rocket className="h-4 w-4" /> SUBMIT PROJECT</>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Step 3: Confirmation ────────────────────────────────────────────────────
function StepConfirm({ teamName }: { teamName: string }) {
  return (
    <div className="text-center py-8 space-y-6">
      <div className="relative mx-auto w-20 h-20">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
        <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-mono font-black text-white mb-2">SUBMISSION RECEIVED</h2>
        <p className="text-sm font-mono text-gray-400">
          <span className="text-emerald-400 font-bold">{teamName}</span> — your project has been successfully submitted!
        </p>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-5 text-left space-y-2">
        {[
          'Your submission is now under review by the admin team',
          'You&apos;ll receive an update once evaluated',
          'Judges will review your GitHub repo and solution answers',
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-xs font-mono text-gray-400">{t}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-mono text-gray-600">
        Submission ID confirmation will be sent to the team leader&apos;s email.
      </p>
    </div>
  );
}

// ── Steps indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'VERIFY' },
  { n: 2, label: 'SUBMIT' },
  { n: 3, label: 'DONE' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-black transition-all ${
              current > s.n ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : current === s.n ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
              : 'bg-white/[0.02] border-white/[0.08] text-gray-700'
            }`}>
              {current > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className={`text-[8px] font-mono font-bold tracking-widest ${current === s.n ? 'text-orange-400' : current > s.n ? 'text-emerald-600' : 'text-gray-700'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-[1px] flex-1 mx-1 mb-4 transition-all ${current > s.n ? 'bg-emerald-500/30' : 'bg-white/[0.04]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SubmitPage() {
  const [step, setStep] = useState(1);
  const [teamData, setTeamData] = useState<any>(null);
  const [leaderEmail, setLeaderEmail] = useState('');
  const [submittedTeamName, setSubmittedTeamName] = useState('');

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.04),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.04),transparent_50%)] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-orange-400 tracking-widest">INDIANEXT 2026</span>
          </div>
          <h1 className="text-3xl font-mono font-black text-white mb-2">PROJECT SUBMISSION</h1>
          <p className="text-sm font-mono text-gray-500">Submit your hackathon project for review</p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          <StepIndicator current={step} />

          {step === 1 && (
            <StepVerify
              onVerified={(data, email) => {
                setTeamData(data);
                setLeaderEmail(email);
                setStep(2);
              }}
            />
          )}

          {step === 2 && teamData && (
            <StepForm
              teamData={teamData}
              leaderEmail={leaderEmail}
              onSuccess={(name) => { setSubmittedTeamName(name); setStep(3); }}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <StepConfirm teamName={submittedTeamName} />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-gray-700 mt-6">
          K.E.S. Shroff College of Arts & Commerce • IndiaNext Hackathon 2026
        </p>
      </div>
    </main>
  );
}
