'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useSpring } from 'framer-motion';
import {
  Download,
  Mail,
  Phone,
  Handshake,
  Eye,
  Users,
  Trophy,
  Globe,
  Rocket,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { fadeInUp, staggerContainer } from '@/lib/animations/variants';

// --- Shared Navbar (same as main site) ---
const NAV_LINKS = [
  { label: './ABOUT', href: '/#about' },
  { label: './TRACKS', href: '/#tracks' },
  { label: './BOUNTY', href: '/#bounty' },
  { label: './RULES', href: '/rules' },
  { label: './FAQ', href: '/faq' },
];

const Navbar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-cyan-400 to-green-500 rounded-lg opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
              <div className="relative w-full h-full border border-white/20 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1">
                <Image
                  src="/logo-new.png"
                  alt="IndiaNext Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg md:text-xl tracking-tighter leading-none">
                INDIA<span className="text-orange-500">NEXT</span>
              </span>
              <span className="text-[0.5rem] md:text-[0.55rem] text-gray-500 tracking-[0.3em] md:tracking-[0.4em] font-mono font-bold">
                DEPLOYMENT_2026
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-sm bg-white/5"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-white transition-colors font-mono text-[11px] tracking-[0.3em] font-black uppercase"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="absolute right-0 top-0 h-full w-72 bg-[#0a0a0a] border-l border-white/10 p-8 flex flex-col"
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="self-end mb-8"
              title="Close menu"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
            <div className="flex flex-col gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-white font-mono text-sm tracking-widest font-bold uppercase"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

// --- Tier Data ---
const TIERS = [
  {
    name: 'TITLE SPONSOR',
    price: '₹50,000+',
    color: '#FFD700',
    perks: [
      'Logo on ALL marketing (posters, banners, website hero)',
      'Title naming rights ("IndiaNext powered by [Brand]")',
      'Dedicated stage time (5-min keynote)',
      'Premium booth at venue',
      'Access to full participant database',
      'Branded swag distribution',
      'Social media features (min 5 posts)',
    ],
  },
  {
    name: 'GOLD SPONSOR',
    price: '₹30,000',
    color: '#FF6600',
    perks: [
      'Logo on website, posters, and banners',
      'Booth at venue',
      '2-min stage mention',
      'Social media features (min 3 posts)',
      'Access to participant resumes',
      'Logo on participant certificates',
    ],
  },
  {
    name: 'SILVER SPONSOR',
    price: '₹15,000',
    color: '#00CCFF',
    perks: [
      'Logo on website and event banners',
      'Social media shoutouts (2 posts)',
      'Flyer distribution at event',
      'Logo on event backdrop',
      'Mention during opening ceremony',
    ],
  },
  {
    name: 'COMMUNITY PARTNER',
    price: 'In-kind / Barter',
    color: '#00FF55',
    perks: [
      'Logo on website (Partners section)',
      'Social media cross-promotion',
      'Mutual audience sharing',
      'Event day visibility',
    ],
  },
];

const STATS = [
  { icon: <Users size={28} />, value: '400+', label: 'DEVELOPERS' },
  { icon: <Trophy size={28} />, value: '₹1L+', label: 'PRIZE POOL' },
  { icon: <Globe size={28} />, value: '24H', label: 'NON-STOP' },
  { icon: <Eye size={28} />, value: '50K+', label: 'SOCIAL REACH' },
];

export default function SponsorsPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden">
      {/* Scroll Progress */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-white/5 z-[100]">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-cyan-400 origin-left"
          style={{ scaleX }}
        />
      </div>

      {/* Background */}
      <div className="fixed inset-0 z-0 bg-[#000000] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0d0d1a_0%,#000000_100%)]" />
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-orange-600 rounded-full blur-[200px] mix-blend-screen animate-[nebula-pulse_10s_ease-in-out_infinite] opacity-[0.05]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-cyan-600 rounded-full blur-[200px] mix-blend-screen animate-[nebula-pulse_15s_ease-in-out_2s_infinite] opacity-[0.05]" />
      </div>

      <Navbar />

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 min-h-[70vh] flex flex-col items-center justify-center pt-28 pb-16 px-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-5xl mx-auto"
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-3 px-5 py-2 border border-orange-500/20 bg-orange-500/5 rounded-full mb-8 backdrop-blur-sm"
          >
            <Handshake size={14} className="text-orange-500" />
            <span className="font-mono text-[9px] text-orange-400 tracking-[0.5em] font-black uppercase">
              Strategic Partnership Program
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl sm:text-7xl md:text-[9rem] font-black leading-[0.8] tracking-tighter uppercase italic mb-6"
          >
            <span className="block text-transparent bg-clip-text bg-gradient-to-br from-orange-500 via-white to-cyan-400">
              SPONSOR
            </span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-white to-orange-500 text-4xl sm:text-5xl md:text-7xl mt-2">
              THE FUTURE
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-gray-400 text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mt-8 font-bold tracking-tight leading-relaxed"
          >
            Partner with <span className="text-orange-500">IndiaNext</span> — Mumbai&apos;s most
            ambitious 24-hour national hackathon at K.E.S. Shroff College.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
          >
            <a
              href="/Sponsor Brochures (A5).pdf"
              download
              className="group relative px-8 py-4 bg-orange-500 text-black font-black text-sm tracking-widest uppercase rounded-sm hover:bg-orange-400 transition-all active:scale-95 flex items-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.3)]"
            >
              <Download size={18} />
              DOWNLOAD BROCHURE
            </a>
            <a
              href="mailto:hackathon@kessc.edu.in?subject=Sponsorship%20Inquiry%20-%20IndiaNext%202026"
              className="px-8 py-4 border border-white/10 text-gray-300 font-black text-sm tracking-widest uppercase rounded-sm hover:text-white hover:border-white/30 transition-all flex items-center gap-3"
            >
              <Mail size={18} />
              GET IN TOUCH
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ QUICK STATS ═══ */}
      <section className="relative z-10 py-16 border-y border-white/5 bg-black/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6 border border-white/5 bg-white/[0.02] rounded-sm"
              >
                <div className="text-orange-500 mb-3 flex justify-center">{stat.icon}</div>
                <p className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
                  {stat.value}
                </p>
                <p className="text-[9px] text-gray-500 font-mono tracking-[0.3em] font-black mt-1">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY SPONSOR ═══ */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-16 md:mb-24"
          >
            <motion.p
              variants={fadeInUp}
              className="text-cyan-500 font-mono text-[10px] tracking-[0.5em] uppercase font-black mb-4"
            >
              {'// VALUE_PROPOSITION'}
            </motion.p>
            <motion.h2
              variants={fadeInUp}
              className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none"
            >
              Why Partner?
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Eye size={32} />,
                title: 'Brand Visibility',
                desc: "Your logo across 400+ developer screens, social media, venue banners, posters, and certificates. Direct exposure to India's next-gen tech talent.",
                color: '#FF6600',
              },
              {
                icon: <Users size={32} />,
                title: 'Talent Pipeline',
                desc: 'Access to a curated pool of elite developers, designers and innovators. Direct resume access and recruitment opportunities.',
                color: '#00CCFF',
              },
              {
                icon: <Rocket size={32} />,
                title: 'Impact & CSR',
                desc: 'Support grassroots innovation in India. Associate your brand with education, technology, and national development.',
                color: '#00FF55',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="p-8 md:p-10 border border-white/5 bg-[#080808] rounded-sm hover:border-white/15 transition-all group"
              >
                <div
                  className="w-16 h-16 flex items-center justify-center border border-white/10 bg-white/5 rounded-sm mb-8 group-hover:scale-110 transition-transform"
                  style={{ color: item.color }}
                >
                  {item.icon}
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight italic mb-4">
                  {item.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed font-bold tracking-tight">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SPONSORSHIP TIERS ═══ */}
      <section className="relative z-10 py-20 md:py-32 bg-[#020202] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-16 md:mb-24"
          >
            <motion.p
              variants={fadeInUp}
              className="text-orange-500 font-mono text-[10px] tracking-[0.5em] uppercase font-black mb-4"
            >
              {'// TIER_PACKAGES'}
            </motion.p>
            <motion.h2
              variants={fadeInUp}
              className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none"
            >
              The Tiers
            </motion.h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TIERS.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative border border-white/5 bg-[#080808] rounded-sm overflow-hidden group hover:border-white/15 transition-all flex flex-col"
              >
                {/* Top accent bar */}
                <div className="h-1 w-full" style={{ backgroundColor: tier.color }} />

                <div className="p-6 md:p-8 flex flex-col flex-1">
                  <p
                    className="font-mono text-[9px] tracking-[0.4em] font-black uppercase mb-2"
                    style={{ color: tier.color }}
                  >
                    {tier.name}
                  </p>
                  <p className="text-3xl md:text-4xl font-black tracking-tighter mb-6">
                    {tier.price}
                  </p>

                  <div className="flex flex-col gap-3 flex-1">
                    {tier.perks.map((perk, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: tier.color }}
                        />
                        <span className="text-gray-400 text-xs font-bold tracking-tight leading-relaxed">
                          {perk}
                        </span>
                      </div>
                    ))}
                  </div>

                  <a
                    href="mailto:hackathon@kessc.edu.in?subject=Sponsorship%20Inquiry%20-%20IndiaNext%202026"
                    className="mt-8 w-full py-3 border text-center font-black text-xs tracking-widest uppercase rounded-sm transition-all hover:text-black flex items-center justify-center gap-2"
                    style={{
                      borderColor: tier.color + '40',
                      color: tier.color,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = tier.color;
                      e.currentTarget.style.color = '#000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = tier.color;
                    }}
                  >
                    <Mail size={14} />
                    INQUIRE
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PDF VIEWER ═══ */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.p
              variants={fadeInUp}
              className="text-cyan-500 font-mono text-[10px] tracking-[0.5em] uppercase font-black mb-4"
            >
              {'// FULL_BROCHURE'}
            </motion.p>
            <motion.h2
              variants={fadeInUp}
              className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none mb-6"
            >
              The Deck
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-gray-500 text-sm font-mono tracking-widest"
            >
              {'SCROLL_TO_VIEW // OR_DOWNLOAD_PDF'}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-white/10 rounded-sm overflow-hidden bg-[#0a0a0a] shadow-[0_0_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <span className="text-[10px] font-mono text-gray-500 tracking-widest font-black uppercase">
                SPONSOR_BROCHURE_V1.PDF
              </span>
              <a
                href="/Sponsor Brochures (A5).pdf"
                download
                className="flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors text-xs font-mono font-bold tracking-wider"
              >
                <Download size={14} />
                DOWNLOAD
              </a>
            </div>
            <iframe
              src="/Sponsor Brochures (A5).pdf"
              className="w-full h-[70vh] md:h-[80vh]"
              title="IndiaNext Sponsor Brochure"
            />
          </motion.div>
        </div>
      </section>

      {/* ═══ CTA FOOTER ═══ */}
      <section className="relative z-10 py-20 md:py-32 bg-[#020202] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none mb-8"
            >
              Let&apos;s Build <span className="text-orange-500">Together</span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-gray-400 text-lg md:text-xl mb-12 font-bold tracking-tight max-w-2xl mx-auto"
            >
              Ready to put your brand in front of India&apos;s sharpest student developers?
              Let&apos;s talk.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <a
                href="mailto:hackathon@kessc.edu.in?subject=Sponsorship%20Inquiry%20-%20IndiaNext%202026"
                className="px-8 py-4 bg-orange-500 text-black font-black text-sm tracking-widest uppercase rounded-sm hover:bg-orange-400 transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.3)]"
              >
                <Mail size={18} />
                HACKATHON@KESSC.EDU.IN
              </a>
              <a
                href="tel:+917506854879"
                className="px-8 py-4 border border-white/10 text-gray-300 font-black text-sm tracking-widest uppercase rounded-sm hover:text-white hover:border-white/30 transition-all flex items-center gap-3"
              >
                <Phone size={18} />
                +91 75068 54879
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="flex items-center justify-center gap-4">
              <Link
                href="/"
                className="text-gray-500 hover:text-white transition-colors font-mono text-xs tracking-widest font-bold uppercase"
              >
                ← BACK TO HOME
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
    </div>
  );
}
