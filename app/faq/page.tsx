"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  Mail,
  Users,
  Globe,
  Code,
  FileText,
  Video,
  Layout,
  Menu,
  X,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations/variants";

// --- Theme Colors ---
const _CYAN = "#00CCFF";
const _ORANGE = "#FF6600";
const _PURPLE = "#a855f7";

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function FAQPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 selection:text-purple-200 overflow-x-hidden">
      {/* Scroll Progress */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-white/5 z-[100]">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-cyan-400 origin-left shadow-[0_0_15px_rgba(168,85,247,0.6),0_0_5px_rgba(34,211,238,0.4)] relative"
          style={{ scaleX }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-full bg-white blur-sm opacity-50" />
        </motion.div>
      </div>

      {/* Background */}
      <CyberBackground />

      {/* Navbar */}
      <FAQNavbar />

      {/* Hero */}
      <FAQHero />

      {/* FAQ Content */}
      <FAQContent />

      {/* Footer CTA */}
      <FooterCTA />

      {/* Scanlines */}
      <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
      <div className="fixed inset-0 pointer-events-none z-[60] opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────
const FAQ_NAV_LINKS = [
  { label: "./HOME", href: "/" },
  { label: "./RULES", href: "/rules" },
];

const FAQNavbar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <motion.div
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.6, ease: "anticipate" }}
              className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-cyan-400 to-green-500 rounded-lg opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
              <div className="relative w-full h-full border border-white/20 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1">
                <Image src="/logo-new.png" alt="IndiaNext Logo" width={32} height={32} className="object-contain" />
              </div>
            </motion.div>
            <div className="flex flex-col">
              <span className="font-black text-lg md:text-xl tracking-tighter leading-none">
                INDIA<span className="text-orange-500">NEXT</span>
              </span>
              <span className="text-[0.5rem] md:text-[0.55rem] text-gray-500 tracking-[0.3em] md:tracking-[0.4em] font-mono font-bold">DEPLOYMENT_2026</span>
            </div>
          </Link>

          {/* Mobile: KES logos + hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex items-center gap-2 sm:gap-3">
              <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={44} height={44} className="object-contain sm:w-[52px] sm:h-[52px]" />
              <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={64} height={40} className="object-contain opacity-90 sm:w-[80px] sm:h-[48px]" />
            </div>
            <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-sm bg-white/5 active:bg-white/10 transition-colors" aria-label="Open menu">
              <Menu size={20} className="text-white" />
            </button>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-10 text-[10px] font-bold text-gray-400 font-mono tracking-widest">
            {FAQ_NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-white transition-colors relative group">
                {link.label === "./HOME" && <ArrowLeft size={12} className="inline mr-1" />}
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-purple-500 transition-all group-hover:w-full" />
              </Link>
            ))}
            <Link
              href="/register"
              className="group relative px-6 py-2.5 overflow-hidden rounded-sm bg-orange-500 text-black font-black hover:text-white transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)]"
            >
              <div className="absolute inset-0 w-full h-full bg-[#020202] translate-y-[101%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-2 text-[10px] tracking-widest uppercase italic">
                REGISTER <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <div className="flex items-center gap-5 ml-2 pl-6 border-l border-white/10 group/kes cursor-pointer pointer-events-auto">
              <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={72} height={72} className="object-contain group-hover/kes:-translate-y-1 transition-transform duration-300 opacity-100" />
              <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={112} height={64} className="object-contain opacity-90 group-hover/kes:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed top-0 right-0 bottom-0 w-72 z-[70] bg-[#050505] border-l border-white/10 md:hidden flex flex-col">
              <div className="flex items-center justify-between px-5 h-16 border-b border-white/5">
                <span className="font-mono text-[10px] font-black tracking-[0.5em] text-gray-500 uppercase">NAVIGATION</span>
                <button onClick={() => setSidebarOpen(false)} className="w-9 h-9 flex items-center justify-center border border-white/10 rounded-sm bg-white/5 active:bg-white/10 transition-colors" aria-label="Close menu">
                  <X size={18} className="text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-6 px-5">
                <div className="flex flex-col gap-1">
                  {FAQ_NAV_LINKS.map((link, i) => (
                    <motion.div key={link.label} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={link.href} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all rounded-sm group">
                        <span className="w-6 text-[10px] font-mono font-black text-gray-700 group-hover:text-purple-500 transition-colors">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-mono text-xs font-bold tracking-[0.3em] uppercase">{link.label}</span>
                        <ChevronRight size={14} className="ml-auto text-gray-800 group-hover:text-purple-500 transition-colors" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 px-4">
                  <Link href="/register" onClick={() => setSidebarOpen(false)} className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 text-black font-mono text-xs font-black tracking-widest uppercase rounded-sm active:scale-95 transition-transform shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                    REGISTER <ArrowRight size={14} />
                  </Link>
                </motion.div>
              </div>
              <div className="px-5 py-6 border-t border-white/5">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={48} height={48} className="object-contain opacity-100" />
                  <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={80} height={44} className="object-contain opacity-90" />
                </div>
                <p className="text-center font-mono text-[8px] text-gray-700 tracking-[0.3em] uppercase font-bold">K.E.S. SHROFF COLLEGE</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────
const FAQHero = () => (
  <section className="relative z-10 min-h-[60vh] flex flex-col items-center justify-center pt-28 pb-16 px-4">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(168,85,247,0.06),transparent_60%)]" />

    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="text-center relative z-20 max-w-5xl mx-auto"
    >
      {/* Badge */}
      <motion.div variants={fadeInUp} className="inline-flex items-center gap-3 px-5 py-2 border border-purple-500/20 bg-purple-500/5 rounded-full mb-10 backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="font-mono text-[9px] text-purple-400 tracking-[0.5em] font-black uppercase">
          Knowledge Base v1.0
        </span>
      </motion.div>

      {/* Title */}
      <motion.h1 variants={fadeInUp} className="text-6xl md:text-[10rem] font-black leading-[0.8] tracking-tighter uppercase italic mb-6">
        <span className="block text-transparent bg-clip-text bg-gradient-to-br from-purple-500 via-white to-cyan-400 drop-shadow-[0_0_40px_rgba(168,85,247,0.4)]">
          FAQ
        </span>
      </motion.h1>

      <motion.p variants={fadeInUp} className="text-gray-500 text-lg md:text-xl font-bold tracking-tight max-w-2xl mx-auto mb-4">
        Everything you need to know before deploying your mission.
      </motion.p>

      <motion.p variants={fadeInUp} className="text-gray-600 text-sm font-mono tracking-wider">
        
      </motion.p>
    </motion.div>
  </section>
);

// ─────────────────────────────────────────────────────────────
// FAQ Item
// ─────────────────────────────────────────────────────────────
interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem = ({ question, answer, index, isOpen, onToggle }: FAQItemProps) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.03 }}
    className={`border rounded-sm overflow-hidden transition-all ${
      isOpen ? "border-purple-500/30 bg-purple-500/[0.03]" : "border-white/5 bg-white/[0.02] hover:border-white/10"
    }`}
  >
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-4 p-5 text-left cursor-pointer group"
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center text-xs font-black font-mono border transition-all ${
          isOpen
            ? "border-purple-500/50 text-purple-400 bg-purple-500/10"
            : "border-white/10 text-gray-600 bg-white/5"
        }`}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
      <span className={`flex-1 font-bold text-sm transition-colors ${
        isOpen ? "text-white" : "text-gray-300 group-hover:text-white"
      }`}>
        {question}
      </span>
      <ChevronDown
        size={16}
        className={`flex-shrink-0 transition-transform duration-300 ${
          isOpen ? "rotate-180 text-purple-400" : "text-gray-600"
        }`}
      />
    </button>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        transition={{ duration: 0.3 }}
        className="px-5 pb-5 pl-[68px]"
      >
        <div className="text-gray-400 text-sm leading-relaxed">{answer}</div>
      </motion.div>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────
// FAQ Content
// ─────────────────────────────────────────────────────────────
const FAQContent = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: { question: string; answer: React.ReactNode }[] = [
    {
      question: "Who can participate in INDIANEXT?",
      answer: (
        <p>
          The hackathon is open to <strong className="text-white">students (undergraduate, postgraduate, diploma)</strong> from
          any recognized institution. Individual participants and teams are welcome.
        </p>
      ),
    },
    {
      question: "What is the maximum team size?",
      answer: (
        <p>
          A team can have <strong className="text-white">1 to 4 members</strong>. Solo participation is allowed.
        </p>
      ),
    },
    {
      question: "Can I participate in both IdeaSprint and BuildStorm?",
      answer: (
        <div>
          <p className="mb-2">No. Each team can register for <strong className="text-white">only one track</strong>:</p>
          <ul className="list-none space-y-1 ml-2">
            <li>💡 IdeaSprint — The Builders Track (Problem → Software Solution)</li>
            <li>⚡ BuildStorm — The Solvers Track (Assigned Problem Statements)</li>
          </ul>
        </div>
      ),
    },
    {
      question: "Is there any registration fee?",
      answer: (
        <p>
          Participation is <strong className="text-white">completely free</strong>. No registration fee is required.
        </p>
      ),
    },
    {
      question: "What domains are allowed?",
      answer: (
        <div>
          <p className="mb-2">Participants can build solutions in:</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {["AI / ML", "Web Development", "Mobile Apps", "Cybersecurity", "Blockchain", "Cloud / DevOps", "Data Science", "FinTech", "HealthTech", "EdTech", "ClimateTech"].map((d) => (
              <span key={d} className="px-3 py-1 text-[10px] font-mono font-black tracking-wider uppercase border border-white/10 bg-white/5 rounded-sm text-gray-400">
                {d}
              </span>
            ))}
          </div>
          <p className="mt-3 text-gray-500 text-xs italic">We are technology-agnostic — innovation matters more than the tech stack.</p>
        </div>
      ),
    },
    {
      question: "Can we use pre-built templates or frameworks?",
      answer: (
        <p>
          Yes. UI kits and frameworks are allowed. However,{" "}
          <strong className="text-white">core logic and implementation must be done during the hackathon</strong> (for BuildStorm).
        </p>
      ),
    },
    {
      question: "Are AI tools like ChatGPT or Copilot allowed?",
      answer: (
        <div>
          <p className="mb-2">Yes, AI tools are allowed for code suggestions, debugging, research, and documentation.</p>
          <p className="text-amber-400 text-xs">
            ⚠️ Participants must understand and explain their implementation. Blind copy-pasting is strictly prohibited.
          </p>
        </div>
      ),
    },
    {
      question: "Will we receive problem statements beforehand (BuildStorm)?",
      answer: (
        <p>
          No. Problem statements or final confirmations will be shared on the{" "}
          <strong className="text-white">event day</strong> or through official communication channels.
        </p>
      ),
    },
    {
      question: "What do IdeaSprint participants need to submit?",
      answer: (
        <ul className="list-none space-y-2">
          <li className="flex items-center gap-2"><FileText size={14} className="text-green-400" /> Idea Deck (Max 10 slides)</li>
          <li className="flex items-center gap-2"><Video size={14} className="text-green-400" /> 3-minute Pitch Video</li>
          <li className="flex items-center gap-2"><Layout size={14} className="text-green-400" /> MVP Architecture / Mockup / wireframes</li>
          <li className="flex items-center gap-2"><Code size={14} className="text-green-400" /> GitHub Repository (Initialized at T-00:00)</li>
        </ul>
      ),
    },
    {
      question: "What do BuildStorm participants need to submit?",
      answer: (
        <ul className="list-none space-y-2">
          <li className="flex items-center gap-2"><Code size={14} className="text-orange-400" /> Functional MVP (Built from scratch)</li>
          <li className="flex items-center gap-2"><Video size={14} className="text-orange-400" /> 3-minute Tech Walkthrough Video</li>
          <li className="flex items-center gap-2"><Code size={14} className="text-orange-400" /> GitHub Repository (Public)</li>
          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-orange-400" /> Fully &apos;Run-Ready&apos; Project for Jury</li>
        </ul>
      ),
    },
    {
      question: "What happens if our project is incomplete?",
      answer: (
        <p>
          A <strong className="text-white">working demo is mandatory</strong> for evaluation. Incomplete or non-functional
          projects may be disqualified.
        </p>
      ),
    },
    {
      question: "How will projects be evaluated?",
      answer: (
        <div className="flex flex-wrap gap-2">
          {["Innovation", "Problem Relevance", "Technical Implementation", "Feasibility", "Scalability", "Presentation"].map((c) => (
            <span key={c} className="px-3 py-1.5 text-[10px] font-mono font-black tracking-wider uppercase border border-cyan-500/20 bg-cyan-500/5 rounded-sm text-cyan-400">
              {c}
            </span>
          ))}
        </div>
      ),
    },
    {
      question: "Who owns the intellectual property of the project?",
      answer: (
        <p>
          <strong className="text-white">Participants retain ownership</strong> of their project. However, organizers may use
          project names, screenshots, or demo clips for promotional purposes.
        </p>
      ),
    },
    {
      question: "Will there be certificates?",
      answer: (
        <div>
          <p>Yes. All eligible participants will receive <strong className="text-white">Participation Certificates</strong>.</p>
          <p className="mt-1">Winners will receive <strong className="text-orange-400">Winner / Runner-Up Certificates</strong>.</p>
        </div>
      ),
    },
    {
      question: "What are the prizes?",
      answer: (
        <div>
          <p className="text-xl font-black text-orange-500 mb-2">🏆 Total Prize Pool: ₹1,00,000++</p>
          <ul className="list-none space-y-1 text-gray-400">
            <li>🎓 Internship Opportunities</li>
            <li>🧠 Mentorship & Incubation Support</li>
            <li>🤝 Startup Networking</li>
            <li>🎁 Swag Kits</li>
          </ul>
        </div>
      ),
    },
    {
      question: "Where can we get updates?",
      answer: (
        <div>
          <p className="mb-2">All updates will be shared via:</p>
          <ul className="list-none space-y-1">
            <li className="flex items-center gap-2"><Mail size={14} className="text-cyan-400" /> Registered Email</li>
            <li className="flex items-center gap-2"><Globe size={14} className="text-cyan-400" />
              <a href="https://www.indianexthackthon.online" className="text-cyan-400 hover:text-white transition-colors underline decoration-cyan-400/30" target="_blank" rel="noopener noreferrer">
                www.indianexthackthon.online
              </a>
            </li>
            <li className="flex items-center gap-2"><Users size={14} className="text-cyan-400" /> Official social media channels</li>
          </ul>
        </div>
      ),
    },
    {
      question: "Who do we contact for support?",
      answer: (
        <p>
          📧 Email:{" "}
          <a href="mailto:hackathon@kessc.edu.in" className="text-orange-400 hover:text-white transition-colors underline decoration-orange-400/30">
            hackathon@kessc.edu.in
          </a>
          <span className="block text-gray-500 text-xs mt-1">Our team will respond within 24–48 hours.</span>
        </p>
      ),
    },
    {
      question: "Can first-year students participate?",
      answer: <p>Yes. <strong className="text-white">All years are welcome</strong> — from first year to final year.</p>,
    },
    {
      question: "Can students from different colleges form a team?",
      answer: <p>Yes. <strong className="text-white">Cross-college teams are allowed</strong> and encouraged.</p>,
    },
    {
      question: "Can we modify our team after registration?",
      answer: (
        <p>
          You can modify your team <strong className="text-white">once</strong> through the dashboard after your initial registration. 
          Changes are logged and once updated, the form will be <strong className="text-amber-400">locked</strong>. 
          For any critical errors after locking, contact support.
        </p>
      ),
    },
  ];

  return (
    <section className="py-24 relative z-10 bg-[#020202] border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <div className="flex items-center justify-center gap-4 font-mono text-[10px] tracking-[0.5em] font-black uppercase text-purple-400 mb-8">
            <div className="w-12 h-px bg-purple-500/30" />
            FREQUENTLY_ASKED_QUESTIONS
            <div className="w-12 h-px bg-purple-500/30" />
          </div>
        </motion.div>

        {/* FAQ Items */}
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              question={faq.question}
              answer={faq.answer}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* Bottom help */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-8 border border-purple-500/20 bg-purple-500/[0.03] rounded-sm text-center"
        >
          <HelpCircle size={28} className="mx-auto mb-4 text-purple-400" />
          <p className="text-gray-300 text-base font-bold mb-2">Still have questions?</p>
          <p className="text-gray-500 text-sm mb-4">
            Our team is here to help. Reach out and we&apos;ll respond within 24–48 hours.
          </p>
          <a
            href="mailto:hackathon@kessc.edu.in"
            className="inline-flex items-center gap-2 px-6 py-3 border border-purple-500/30 bg-purple-500/10 rounded-sm text-purple-400 font-black text-sm tracking-wider uppercase hover:bg-purple-500/20 hover:text-white transition-all"
          >
            <Mail size={16} /> hackathon@kessc.edu.in
          </a>
        </motion.div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────
// Footer CTA
// ─────────────────────────────────────────────────────────────
const FooterCTA = () => (
  <footer className="py-32 border-t border-white/10 bg-black relative z-10">
    <div className="max-w-7xl mx-auto px-6">
      {/* CTA Section */}
      <div className="max-w-4xl mx-auto text-center mb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic mb-6">
            Ready to <span className="text-orange-500">Deploy</span>?
          </h2>
          <p className="text-gray-500 text-lg font-bold tracking-tight mb-12 max-w-xl mx-auto">
            Got your answers? Now join the mission.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="/register"
              className="group relative px-10 py-4 overflow-hidden rounded-sm bg-orange-500 text-black font-black hover:text-white transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)]"
            >
              <div className="absolute inset-0 w-full h-full bg-[#020202] translate-y-[101%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-3 text-sm tracking-widest uppercase italic">
                REGISTER NOW <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/rules"
              className="px-10 py-4 border border-white/10 rounded-sm text-gray-400 font-black text-sm tracking-widest uppercase italic hover:text-white hover:border-white/20 transition-all"
            >
              ← VIEW RULES
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Main Footer Info */}
      <div className="grid md:grid-cols-4 gap-16 items-start mb-24 text-left border-t border-white/5 pt-24">
          <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-10 mb-12">
                  <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={110} height={110} className="object-contain" />
                  <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={180} height={100} className="object-contain" />
              </div>
              <h4 className="font-black text-4xl mb-8 uppercase tracking-tighter italic">K.E.S. Shroff College</h4>
              <p className="text-gray-500 font-mono text-[10px] leading-relaxed uppercase tracking-[0.2em] font-black">
                  Autonomous | NAAC &apos;A&apos; Grade (3.58 CGPA)<br/>
                  QS I-Gauge Gold | Best College Award (University of Mumbai)<br/>
                  Mumbai, MH 400067, IN
              </p>
          </div>
          <div>
             <h4 className="text-gray-700 font-mono text-[10px] uppercase tracking-[0.5em] mb-12 font-black">DIRECTORIES</h4>
             <div className="flex flex-col gap-6 text-[10px] font-black tracking-widest uppercase">
                  <Link href="/" className="text-gray-500 hover:text-orange-500 transition-colors italic">./MISSION_HUB</Link>
                  <Link href="/rules" className="text-gray-500 hover:text-orange-500 transition-colors italic">./RULEBOOK_v1.0</Link>
                  <Link href="/rules#conduct" className="text-gray-500 hover:text-orange-500 transition-colors italic">./CONDUCT_PROTOCOL</Link>
             </div>
          </div>
          <div>
             <h4 className="text-gray-700 font-mono text-[10px] uppercase tracking-[0.5em] mb-12 font-black">COMMS_LINK</h4>
             <div className="flex flex-col gap-5 text-xs font-black">
                  <a href="mailto:hackathon@kessc.edu.in" className="text-cyan-400 hover:text-white transition-colors underline decoration-cyan-400/30">HACKATHON@KESSC.EDU.IN</a>
                  <p className="text-white tracking-widest italic">+91 75068 54879</p>
                  <p className="text-gray-600 mt-4 text-[10px] border border-white/5 py-2 px-4 inline-block">@KES_SHROFF_COLLEGE</p>
             </div>
          </div>
      </div>

      <div className="pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-6">
              <div className="w-12 h-12 relative rounded-sm border border-white/20 overflow-hidden grayscale group hover:grayscale-0 transition-all">
                  <Image src="/Logo.jpg" alt="Logo" width={48} height={48} className="object-cover" />
              </div>
              <div className="flex flex-col">
                  <span className="font-black text-2xl tracking-tighter uppercase leading-none">IndiaNext</span>
                  <span className="text-[10px] font-mono text-gray-700 font-bold uppercase tracking-widest">Global_Protocol_v2.0.26</span>
              </div>
          </div>
          <p className="text-gray-800 text-[8px] font-mono tracking-[0.8em] font-black uppercase text-center">&copy; 2026 INDIANEXT // DECRYPTED_MISSION_DATA_SECURE</p>
      </div>
    </div>
  </footer>
);

// ─────────────────────────────────────────────────────────────
// Cyber Background
// ─────────────────────────────────────────────────────────────
const CyberBackground = () => (
  <div className="fixed inset-0 z-0 bg-[#050505] perspective-1000 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0d0d1a_0%,#000000_100%)]" />
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
      transition={{ duration: 10, repeat: Infinity }}
      className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-600 rounded-full blur-[200px] mix-blend-screen"
    />
    <motion.div
      animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.08, 0.05] }}
      transition={{ duration: 15, repeat: Infinity, delay: 2 }}
      className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-cyan-600 rounded-full blur-[200px] mix-blend-screen"
    />
    <div className="absolute bottom-[-10%] left-[-50%] right-[-50%] h-[80vh] bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [transform:rotateX(75deg)] origin-bottom animate-grid-flow opacity-30" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />
  </div>
);
