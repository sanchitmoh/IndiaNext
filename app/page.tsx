"use client";

import React, { useState, useEffect, memo } from 'react';
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useSpring, useMotionValue, useMotionTemplate, AnimatePresence } from "framer-motion";
import { ArrowRight, Code, Globe, Rocket, Terminal, Zap, Shield, Activity, Clock, Users, ChevronRight, HelpCircle, Trophy, FastForward, Target, Menu, X, ChevronDown } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations/variants";
import "./styles/bounce-slow.css";

// --- Theme Colors ---
const CYAN = "#00CCFF";
const ORANGE = "#FF6600";
const GREEN = "#00FF55";

const glitchVariants = {
    animate: {
      x: [0, -2, 2, -2, 2, 0],
      y: [0, 1, -1, 1, -1, 0],
      filter: [
        "none",
        "hue-rotate(90deg) opacity(0.8)",
        "hue-rotate(-90deg) opacity(0.8)",
        "none"
      ],
      transition: {
        duration: 0.2,
        repeat: Infinity,
        repeatDelay: 5
      }
    }
};

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-white/5 z-[100]">
        <motion.div 
          className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-cyan-400 origin-left shadow-[0_0_15px_rgba(255,102,0,0.6),0_0_5px_rgba(34,211,238,0.4)] relative" 
          style={{ scaleX }} 
        >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-full bg-white blur-sm opacity-50" />
        </motion.div>
      </div>

      <AnimatePresence>
        {loading && <OpeningSequence onComplete={() => setLoading(false)} />}
      </AnimatePresence>
      
      {!loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }}>
          <CyberBackground />
          <Navbar />
          <HeroSection />
          <HighStakesTicker />
          <BountySection />
          <AboutSection />
          <TracksSection />
          <FocusDomainsSection />
          <TimelineSection />
          <SponsorsSection />
          <FAQSection />
          <Footer />
          
          {/* Global UI Effects */}
          <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
        </motion.div>
      )}
    </div>
  );
}



interface HoloCardProps {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactElement;
  desc: string;
  tags: string[];
}

interface TechDetailProps {
  icon: React.ReactElement;
  title: string;
  desc: string;
  accent?: string;
}

// --- Countdown Timer ---
const CountdownTimer = memo(() => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    // Set target to March 16, 2026, 11:00 AM
    const target = new Date("March 16, 2026 11:00:00").getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 md:gap-6 font-mono justify-center mb-12">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="flex flex-col items-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-orange-500/40 blur-sm opacity-100 group-hover:bg-orange-500/60 transition-all duration-300" />
            <div className="relative text-xl sm:text-3xl md:text-5xl font-black text-white bg-white/5 border border-white/20 px-2 md:px-5 py-2 w-14 sm:w-20 md:w-28 flex items-center justify-center rounded-sm backdrop-blur-md">
              <span className="tabular-nums">{String(value).padStart(2, '0')}</span>
            </div>
          </div>
          <span className="text-[7px] md:text-[9px] text-gray-500 mt-2 tracking-[0.3em] font-black uppercase">
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
});
CountdownTimer.displayName = 'CountdownTimer';

// --- Opening Sequence ---
const OpeningSequence = ({ onComplete }: { onComplete: () => void }) => {
    const [progress, setProgress] = useState(0);
    const [text, setText] = useState("INITIALIZING SYSTEM...");
    
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 2.5;
            });
        }, 25);

        const texts = [
            "ESTABLISHING SECURE CONNECTION...",
            "VERIFYING CREDENTIALS...",
            "BYPASSING FIREWALL...",
            "DECRYPTING MISSION FILES...",
            "ACCESS GRANTED."
        ];
        
        let textIdx = 0;
        const textInterval = setInterval(() => {
            if (textIdx < texts.length) {
                setText(texts[textIdx]);
                textIdx++;
            }
        }, 700);

        setTimeout(onComplete, 2500);

        return () => {
            clearInterval(interval);
            clearInterval(textInterval);
        };
    }, [onComplete]);

    return (
        <motion.div 
            exit={{ opacity: 0, scale: 1.2, filter: "blur(20px)" }}
            transition={{ duration: 1, ease: "circIn" }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center font-mono overflow-hidden"
        >
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-64 md:w-96 relative"
             >
                 <div className="flex justify-between text-[10px] text-green-500 mb-2 font-bold tracking-tighter">
                     <span>PROTOCOL_X_LOADER</span>
                     <span>{Math.round(progress)}%</span>
                 </div>
                 <div className="h-[2px] w-full bg-gray-900 rounded-full overflow-hidden">
                     <motion.div 
                        className="h-full bg-gradient-to-r from-orange-500 to-cyan-500 shadow-[0_0_15px_rgba(255,102,0,0.5)]"
                        style={{ width: progress + "%" } as React.CSSProperties}
                     />
                 </div>
                 <p className="mt-6 text-center text-cyan-400 text-[10px] animate-pulse tracking-[0.3em] font-bold uppercase">{text}</p>
             </motion.div>
             
             {/* Glitch Background Elements */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-white/10 animate-glitch" />
        </motion.div>
    );
};

// --- Components ---

const NAV_LINKS = [
    { label: './ABOUT', href: '#about' },
    { label: './TRACKS', href: '#tracks' },
    { label: './BOUNTY', href: '#bounty' },
    { label: './RULES', href: '/rules' },
    { label: './FAQ', href: '/faq' }
];

const Navbar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-24 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.6, ease: "anticipate" }}
              className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-cyan-400 to-green-500 rounded-lg opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
              <div className="relative w-full h-full border border-white/20 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1">
                <Image src="/logo-new.png" alt="IndiaNext Logo" width={32} height={32} className="object-contain" priority />
              </div>
            </motion.div>
            <div className="flex flex-col">
              <span className="font-black text-lg md:text-xl tracking-tighter leading-none">INDIA<span className="text-orange-500">NEXT</span></span>
              <span className="text-[0.5rem] md:text-[0.55rem] text-gray-500 tracking-[0.3em] md:tracking-[0.4em] font-mono font-bold">DEPLOYMENT_2026</span>
            </div>
          </Link>

          {/* Right side: KES logos (mobile) + hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex items-center gap-2 sm:gap-3">
              <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={44} height={44} className="object-contain sm:w-[52px] sm:h-[52px]" />
              <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={64} height={40} className="object-contain opacity-90 sm:w-[80px] sm:h-[48px]" />
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-sm bg-white/5 active:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} className="text-white" />
            </button>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-10 text-[10px] font-bold text-gray-400 font-mono tracking-widest">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-white transition-colors relative group">
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-orange-500 transition-all group-hover:w-full" />
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

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 z-[70] bg-[#050505] border-l border-white/10 md:hidden flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-white/5">
                <span className="font-mono text-[10px] font-black tracking-[0.5em] text-gray-500 uppercase">NAVIGATION</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-9 h-9 flex items-center justify-center border border-white/10 rounded-sm bg-white/5 active:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} className="text-white" />
                </button>
              </div>

              {/* Nav Links */}
              <div className="flex-1 overflow-y-auto py-6 px-5">
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((link, i) => (
                    <motion.div
                      key={link.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 px-4 py-3.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all rounded-sm group"
                      >
                        <span className="w-6 text-[10px] font-mono font-black text-gray-500 group-hover:text-orange-500 transition-colors">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-xs font-bold tracking-[0.3em] uppercase">{link.label}</span>
                        <ChevronRight size={14} className="ml-auto text-gray-600 group-hover:text-orange-500 transition-colors" />
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Register Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 px-4"
                >
                  <Link
                    href="/register"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 text-black font-mono text-xs font-black tracking-widest uppercase rounded-sm active:scale-95 transition-transform shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                  >
                    REGISTER <ArrowRight size={14} />
                  </Link>
                </motion.div>
              </div>

              {/* Sidebar Footer with KES Logos */}
              <div className="px-5 py-5 border-t border-white/5">
                <div className="flex items-center justify-center gap-4 mb-3">
                  <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={48} height={48} className="object-contain opacity-95" />
                  <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={72} height={40} className="object-contain opacity-90" />
                </div>
                <p className="text-center font-mono text-[8px] text-gray-500 tracking-[0.3em] uppercase font-bold">
                  K.E.S. SHROFF COLLEGE
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const HeroSection = () => {
  // Arrow visibility state
  const [showArrow, setShowArrow] = React.useState(true);
  React.useEffect(() => {
    const onScroll = () => {
      setShowArrow(window.scrollY < 60);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to next section
  const handleArrowClick = () => {
    const nextSection = document.getElementById('bounty');
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative z-10 min-h-screen flex flex-col items-center justify-center pt-24 md:pt-32 px-3 md:px-4 group overflow-hidden select-none">
       {/* Background Light Effects */}
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,204,255,0.05),transparent_60%)]" />
       
       <motion.div 
         initial="hidden"
         animate="visible"
         variants={staggerContainer}
         className="text-center relative z-20 max-w-7xl mx-auto"
       >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-3 px-5 py-2 border border-orange-500/20 bg-orange-500/5 rounded-full mb-10 backdrop-blur-sm">
             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
             <span className="font-mono text-[9px] text-orange-400 tracking-[0.5em] font-black uppercase">Operation: Future Proof India</span>
          </motion.div>

          {/* Main Title with Glitch */}
          <motion.div variants={fadeInUp} className="relative mb-6">
              <motion.h1 
                variants={glitchVariants}
                animate="animate"
                className="text-6xl sm:text-8xl md:text-[16rem] font-black leading-[0.75] tracking-tighter relative z-10 uppercase scale-y-110 italic"
              >
                 <span className="block text-transparent bg-clip-text bg-gradient-to-br from-orange-500 via-white to-green-500 drop-shadow-[0_0_40px_rgba(255,100,0,0.4)]">
                    India<br/>Next
                 </span>
              </motion.h1>
              <div className="absolute inset-0 text-white/5 blur-3xl -z-10 animate-pulse select-none" aria-hidden="true">India Next</div>
          </motion.div>
          
          <motion.h2 
            variants={fadeInUp}
            className="text-xl sm:text-2xl md:text-6xl font-black text-cyan-400 tracking-tighter mb-8 uppercase opacity-90 leading-none"
          >
              <span className="text-white">OUTTHINK</span> THE ALGORITHM
          </motion.h2>

          <motion.div variants={fadeInUp} className="flex flex-col items-center gap-4 mb-12">
              <div className="flex items-center gap-4 text-gray-400 font-mono text-xs md:text-sm tracking-[0.2em] font-bold">
                 <Target size={16} className="text-orange-500" />
                 <span>16.03.2026</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                 <span>MUMBAI_HQ</span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">K.E.S. Shroff College of Arts & Commerce</p>
          </motion.div>

          {/* Countdown Timer */}
          <motion.div variants={fadeInUp}>
             <CountdownTimer />
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center gap-6 mt-4">
              <Link href="/register" className="relative group overflow-hidden active:scale-95 transition-all duration-200 w-auto">
                 <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-green-500 rounded-sm blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
                 <button className="relative px-8 md:px-12 py-4 md:py-6 bg-[#0a0a0a] border border-white/20 rounded-sm leading-none flex items-center justify-center gap-4 md:gap-6 group-hover:bg-zinc-900 transition-all overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.1)]">
                    <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 italic" />
                    <span className="flex flex-col items-start text-left">
                         <span className="text-[0.6rem] md:text-[0.7rem] text-orange-500/70 font-mono tracking-widest mb-1 italic uppercase font-bold group-hover:text-orange-500">ACCESS_PROTOCOLS_V2</span>
                         <span className="text-2xl md:text-4xl text-orange-500 font-black tracking-tight group-hover:text-white transition-colors uppercase drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">Register Now</span>
                    </span>
                    <ChevronRight className="w-6 h-6 md:w-10 md:h-10 text-orange-500 group-hover:translate-x-2 transition-transform" />
                 </button>
              </Link>
          </motion.div>
       </motion.div>

       {/* Bouncing Down Arrow (fixed, right side, hides after scroll, clickable) */}
       {showArrow && (
         <button
           type="button"
           onClick={handleArrowClick}
           className="fixed right-6 bottom-8 z-50 flex flex-col items-center select-none focus:outline-none group"
           style={{ pointerEvents: 'auto' }}
           aria-label="Scroll Down"
         >
           <span className="animate-bounce-slow">
             <ChevronDown size={40} className="text-orange-400 drop-shadow-lg group-active:scale-90 transition-transform" />
           </span>
           <span className="text-xs text-orange-400 font-mono mt-1 tracking-widest bg-black/70 px-2 py-0.5 rounded">Scroll Down</span>
         </button>
       )}
       
       <motion.div 
         initial={{ opacity: 0 }}
         animate={{ opacity: 0.3 }}
         transition={{ delay: 2, duration: 1 }}
         className="absolute bottom-10 left-10 hidden lg:block"
       >
          <div className="flex flex-col gap-2 font-mono text-[8px] text-cyan-700 uppercase font-black tracking-widest">
             <div className="flex items-center gap-2"><div className="w-1 h-1 bg-cyan-700" /> LATENCY: 24MS</div>
             <div className="flex items-center gap-2"><div className="w-1 h-1 bg-cyan-700" /> PACKET_STATUS: NOMINAL</div>
             <div className="flex items-center gap-2"><div className="w-1 h-1 bg-cyan-700" /> ENCRYPTION: SHA-256</div>
          </div>
       </motion.div>
    </section>
  );
};

const HighStakesTicker = () => {
    return (
        <div className="relative z-20 py-16 bg-[#030303] border-y border-white/5 overflow-hidden">
             <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 text-center">
                 {[
                    { label: 'BOUNTY_POOL', value: '₹1 Lakh+', color: 'text-orange-500' },
                    { label: 'RUN_TIME', value: '24H', color: 'text-orange-500' },
                    { label: 'SELECTED_TEAMS', value: '100', color: 'text-green-500' },
                    { label: 'ENTRY_FEE', value: 'FREE', color: 'text-cyan-400' }
                 ].map((stat, i) => (
                     <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + (i * 0.1) }}
                        className="relative group px-2 sm:px-6 border-l border-white/5 first:border-l-0"
                    >
                        <p className="text-gray-400 font-mono text-[7px] sm:text-[9px] mb-2 sm:mb-3 tracking-[0.15em] sm:tracking-[0.2em] font-black">{stat.label}</p>
                        <p className={`text-2xl sm:text-4xl md:text-6xl font-black ${stat.color} tracking-tighter font-mono group-hover:scale-105 transition-transform cursor-default`}>
                            {stat.value}
                        </p>
                    </motion.div>
                 ))}
             </div>
        </div>
    )
}

const AboutSection = () => (
    <section id="about" className="py-20 md:py-40 px-4 md:px-6 relative z-10 bg-black overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-orange-500/5 to-transparent -z-10" />
        <div className="max-w-7xl mx-auto">
             <div className="grid lg:grid-cols-2 gap-12 md:gap-24 items-center">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeInUp}
                 >
                     <div className="inline-block px-4 py-1.5 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-mono text-[10px] tracking-[0.4em] font-black mb-8 uppercase italic">./MISSION_BRIEFING</div>
                     <h2 className="text-4xl sm:text-6xl md:text-[5.5rem] font-black mb-10 tracking-tighter uppercase leading-[0.85]">
                        The Code That <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-blue-600 shadow-glow">Survives Tomorrow</span>
                     </h2>
                     <p className="text-gray-400 leading-relaxed text-lg sm:text-2xl mb-10 font-bold tracking-tight">
                        We aren&apos;t just hacking for a day; we are building for the decade. <span className="text-orange-500">IndiaNext</span> is a National-Level Innovation Challenge empowering 400+ developers to build solutions for Bharat 2.0.
                     </p>
                     <div className="p-8 border-l-4 border-orange-600 bg-white/5 rounded-sm backdrop-blur-sm">
                        <p className="text-white text-sm font-mono tracking-widest uppercase italic font-black">
                           MISSION HOST: K.E.S. SHROFF COLLEGE (AUTONOMOUS)
                        </p>
                        <p className="text-gray-400 text-[10px] font-mono mt-2 tracking-widest uppercase">NAAC &apos;A&apos; GRADE | QS I-GAUGE GOLD RATING | MUMBAI, MH</p>
                     </div>
                 </motion.div>
                 
                 <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={staggerContainer}
                    className="grid sm:grid-cols-2 gap-6"
                 >
                     <TechDetail icon={<Trophy />} title="₹1 LAKH+" desc="PRIZE REWARD" accent={ORANGE} />
                     <TechDetail icon={<Clock />} title="24 HOURS" desc="NON-STOP DEV" accent={GREEN} />
                     <TechDetail icon={<Users />} title="100 TEAMS" desc="ELITE SQUAD" accent={CYAN} />
                     <TechDetail icon={<Zap />} title="FREE" desc="SYSTEM ENTRY" accent="#FFF" />
                 </motion.div>
             </div>
        </div>
    </section>
);

const TracksSection = () => {
    return (
        <section id="tracks" className="py-20 md:py-40 relative z-10 bg-[#020202]">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-24 text-center"
                >
                    <h2 className="text-4xl sm:text-6xl md:text-9xl font-black mb-6 uppercase tracking-tighter italic">Choose Your Battlefield</h2>
                    <div className="flex items-center justify-center gap-4 text-orange-500 font-mono text-[10px] tracking-[0.5em] font-black uppercase">
                        <div className="w-12 h-px bg-orange-500/30" />
                        SELECT_MISSION_TYPE
                        <div className="w-12 h-px bg-orange-500/30" />
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-8 md:gap-16">
                    <HoloCard 
                        title="TRACK A: THE SOLVERS"
                        subtitle="SURPRISE_CHALLENGE (70 SLOTS)"
                        accent={ORANGE}
                        icon={<Terminal />}
                        desc="A secret Problem Statement revealed at H-Hour (11:00 AM). High stakes, low sleep, pure logic."
                        tags={["Algorithm Wizards", "Execution Specialists"]}
                    />
                    <HoloCard 
                        title="TRACK B: THE VISIONARIES"
                        subtitle="OPEN_INNOVATION (30 SLOTS)"
                        accent={GREEN}
                        icon={<Rocket />}
                        desc="Bring your startup vision to life. No slides, no talk—just code the MVP that changes everything."
                        tags={["Aspiring Founders", "Product Engineers"]}
                    />
                </div>
            </div>
        </section>
    )
}

const FocusDomainsSection = () => (
    <section className="py-20 md:py-40 relative z-10 bg-black border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-4xl sm:text-5xl md:text-[8rem] font-black mb-10 md:mb-20 uppercase tracking-tighter italic leading-none opacity-90">Focus Domains</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                {[
                    { title: "TrustTech", desc: "Digital Sovereignty", icon: <Shield /> },
                    { title: "Sustain AI", desc: "Climate Optimization", icon: <Zap /> },
                    { title: "BioDigital", desc: "Next-Gen Wellness", icon: <Activity /> },
                    { title: "FutureWork", desc: "Next-Gen Skilling", icon: <Code /> },
                    { title: "RuralFin", desc: "Digital Inclusion", icon: <Globe /> }
                ].map((domain, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -10, scale: 1.02 }}
                        className="p-6 md:p-10 border border-white/10 bg-[#050505] rounded-sm hover:border-cyan-500 transition-all text-left relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            {React.cloneElement(domain.icon, { size: 100 })}
                        </div>
                        <div className="mb-8 text-cyan-400 scale-125 origin-left">{domain.icon}</div>
                        <h4 className="font-black text-2xl mb-3 text-white uppercase tracking-tighter leading-tight">{domain.title}</h4>
                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-[0.2em] font-bold">{domain.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

const BountySection = () => (
    <section id="bounty" className="py-20 md:py-40 relative z-10 bg-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-32 relative">
                <motion.h2 
                    initial={{ opacity: 0, scale: 1.5 }}
                    whileInView={{ opacity: 0.05, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    className="text-[6rem] sm:text-[10rem] md:text-[15rem] font-black leading-none tracking-tighter uppercase absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full select-none pointer-events-none italic"
                >
                    BOUNTY
                </motion.h2>
                <h2 className="text-5xl sm:text-7xl md:text-[10rem] font-black uppercase tracking-tighter relative z-10 leading-none">The Bounty</h2>
                <div className="inline-block px-6 sm:px-12 py-4 sm:py-6 bg-orange-600 text-white font-mono text-xl sm:text-3xl md:text-6xl tracking-tighter mt-8 md:mt-12 uppercase font-black italic shadow-[0_0_60px_rgba(234,88,12,0.6)] animate-pulse">
                   TOTAL POOL: ₹1,00,000+
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 md:gap-16 mb-12 md:mb-20">
                <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="p-6 sm:p-8 md:p-12 border-2 border-orange-500/20 bg-orange-500/5 rounded-sm relative group overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-[8rem] font-black select-none group-hover:opacity-20 transition-opacity italic">01</div>
                    <h3 className="text-2xl sm:text-4xl font-black mb-8 md:mb-12 flex items-center gap-3 sm:gap-5 italic">
                        <Terminal size={40} className="text-orange-500" />
                        THE SOLVERS
                    </h3>
                    <div className="space-y-8">
                        {[
                            { label: "COMMANDER (1ST)", prize: "₹40,000", color: "text-orange-500" },
                            { label: "LIEUTENANT (2ND)", prize: "₹20,000", color: "text-white" },
                            { label: "SPECIALIST (3RD)", prize: "₹10,000", color: "text-white" }
                        ].map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 sm:p-6 border border-white/10 bg-black group-hover:border-orange-500/30 transition-colors">
                                <span className="font-mono text-[10px] sm:text-xs text-gray-400 tracking-[0.15em] sm:tracking-[0.3em] font-black">{p.label}</span>
                                <span className={`text-2xl sm:text-3xl md:text-4xl font-black ${p.color} font-mono tracking-tighter`}>{p.prize}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="p-6 sm:p-8 md:p-12 border-2 border-green-500/20 bg-green-500/5 rounded-sm relative group overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-[8rem] font-black select-none group-hover:opacity-20 transition-opacity italic">02</div>
                    <h3 className="text-2xl sm:text-4xl font-black mb-8 md:mb-12 flex items-center gap-3 sm:gap-5 italic">
                        <Rocket size={40} className="text-green-500" />
                        THE VISIONARIES
                    </h3>
                    <div className="space-y-8">
                        {[
                            { label: "ARCHITECT (1ST)", prize: "₹20,000", color: "text-green-500" },
                            { label: "STRATEGIST (2ND)", prize: "₹10,000", color: "text-white" }
                        ].map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 sm:p-6 border border-white/10 bg-black group-hover:border-green-500/30 transition-colors">
                                <span className="font-mono text-[10px] sm:text-xs text-gray-400 tracking-[0.15em] sm:tracking-[0.3em] font-black">{p.label}</span>
                                <span className={`text-2xl sm:text-3xl md:text-4xl font-black ${p.color} font-mono tracking-tighter`}>{p.prize}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {["Incubation Support", "Internship Referrals", "Cloud Credits", "Elite SWAG"].map((perk, i) => (
                    <motion.div 
                        key={i} 
                        whileHover={{ y: -5 }}
                        className="px-4 sm:px-8 py-4 sm:py-6 border border-white/10 bg-[#050505] rounded-sm text-center group"
                    >
                        <span className="text-xs font-mono text-gray-400 tracking-[0.4em] uppercase font-black group-hover:text-cyan-400 transition-colors italic">{perk}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

const TimelineSection = () => {
    const sectionRef = React.useRef(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start center", "end center"]
    });

    const [realTimePercent, setRealTimePercent] = useState(0);

    const timelineEvents = [
        // Day 1
        { id: 1, event: "Check-in & Breakfast", timestamp: new Date("2026-03-16T08:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "08:00 – 09:00 AM", desc: "ARRIVAL & FUEL UP", icon: <Globe /> },
        { id: 2, event: "Opening Ceremony", timestamp: new Date("2026-03-16T09:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "09:00 – 09:30 AM", desc: "MISSION BRIEFING", icon: <Rocket /> },
        { id: 3, event: "Idea Discussion", timestamp: new Date("2026-03-16T09:30:00"), date: "MAR 16, 2026", day: "DAY 1", time: "09:30 – 10:30 AM", desc: "STRATEGY SESSION", icon: <Target /> },
        { id: 4, event: "Development Start", timestamp: new Date("2026-03-16T11:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "11:00 AM – 02:00 PM", desc: "BUILD SEQUENCE INITIATED", icon: <FastForward /> },
        { id: 5, event: "Lunch Break", timestamp: new Date("2026-03-16T14:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "02:00 – 05:00 PM", desc: "SUPPLY DROP I", icon: <Activity /> },
        { id: 6, event: "Mentorship Round 1", timestamp: new Date("2026-03-16T19:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "07:00 – 09:00 PM", desc: "TACTICAL SYNC", icon: <Users /> },
        { id: 7, event: "Night Dinner", timestamp: new Date("2026-03-16T21:00:00"), date: "MAR 16, 2026", day: "DAY 1", time: "09:00 PM – 12:00 AM", desc: "SUPPLY DROP II", icon: <Activity /> },
        // Day 2
        { id: 8, event: "Breakfast", timestamp: new Date("2026-03-17T07:00:00"), date: "MAR 17, 2026", day: "DAY 2", time: "07:00 – 08:00 AM", desc: "MORNING FUEL", icon: <Activity /> },
        { id: 9, event: "Mentorship Round 2", timestamp: new Date("2026-03-17T08:00:00"), date: "MAR 17, 2026", day: "DAY 2", time: "08:00 – 10:00 AM", desc: "FINAL STRATEGY SYNC", icon: <Users /> },
        { id: 10, event: "Development End", timestamp: new Date("2026-03-17T11:00:00"), date: "MAR 17, 2026", day: "DAY 2", time: "11:00 AM", desc: "CODE FREEZE", icon: <Shield /> },
        { id: 11, event: "Prize Distribution", timestamp: new Date("2026-03-17T13:00:00"), date: "MAR 17, 2026", day: "DAY 2", time: "01:00 PM onwards", desc: "VICTORY PROTOCOL", icon: <Trophy /> }
    ];

    useEffect(() => {
        const calculateProgress = () => {
            const now = new Date(); 
            const start = timelineEvents[0].timestamp;
            const end = timelineEvents[timelineEvents.length - 1].timestamp;
            
            if (now < start) setRealTimePercent(0);
            else if (now > end) setRealTimePercent(100);
            else {
                const total = end.getTime() - start.getTime();
                const current = now.getTime() - start.getTime();
                setRealTimePercent((current / total) * 100);
            }
        };

        calculateProgress();
        const interval = setInterval(calculateProgress, 60000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    const _scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

    return (
        <section id="timeline" ref={sectionRef} className="py-24 md:py-60 relative z-10 bg-[#020202] overflow-hidden">
            <div className="max-w-5xl mx-auto px-4 md:px-6 relative">
                <div className="mb-16 md:mb-32 flex flex-col items-center">
                    <p className="text-orange-500 font-mono text-[10px] tracking-[0.5em] sm:tracking-[1em] mb-4 uppercase font-black italic">{"// MISSION_CHRONOLOGY"}</p>
                    <h2 className="text-4xl sm:text-6xl md:text-9xl font-black text-center uppercase tracking-tighter italic leading-none">The Roadmap</h2>
                </div>

                <div className="relative">
                    {/* Background Line (Ghost) */}
                    <div className="absolute left-10 md:left-1/2 top-0 bottom-0 w-[2px] bg-white/5 -translate-x-1/2 hidden md:block" />
                    
                    {/* Live Progress Bar (Based on Real Time) */}
                    <div className="absolute left-10 md:left-1/2 top-0 bottom-0 w-[2px] bg-white/10 -translate-x-1/2 z-10 hidden md:block">
                        <div 
                            className="absolute top-0 w-full bg-gradient-to-b from-orange-500 via-orange-500/50 to-orange-500/0 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(255,102,0,0.3)]"
                            style={{ height: `${realTimePercent}%` }}
                        />
                    </div>

                    {/* Real-time "NOW" Pointer */}
                    {realTimePercent > 0 && realTimePercent < 100 && (
                        <div 
                            className="absolute left-10 md:left-1/2 -translate-x-1/2 z-40 hidden md:flex items-center transition-all duration-1000 ease-linear"
                            style={{ top: `${realTimePercent}%` }}
                        >
                            <div className="w-10 h-10 border border-orange-500 rounded-full animate-ping absolute -left-[19px]" />
                            <div className="ml-8 bg-orange-500 text-black px-2 py-0.5 text-[8px] font-black font-mono skew-x-[-12deg] shadow-[4px_4px_0_rgba(255,255,255,0.1)]">
                                MISSION_IN_PROGRESS
                            </div>
                        </div>
                    )}

                    {/* Mobile Line */}
                    <div className="absolute left-[39px] top-0 bottom-0 w-px bg-white/5 md:hidden" />

                    <div className="space-y-24 relative">
                        {timelineEvents.map((item, i) => {
                            const isPast = new Date() > item.timestamp;
                            const _isNext = !isPast && (i === 0 || new Date() > timelineEvents[i-1].timestamp);

                            return (
                                <motion.div 
                                    key={i}
                                    initial="hidden"
                                    whileInView="visible"
                                    viewport={{ once: false, amount: 0.3 }}
                                    variants={{
                                        hidden: { opacity: 0, x: i % 2 === 0 ? -120 : 120 },
                                        visible: { 
                                            opacity: 1, 
                                            x: 0,
                                            transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
                                        }
                                    }}
                                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className={`relative flex items-center gap-4 sm:gap-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} ${isPast ? 'opacity-40' : 'opacity-100'}`}
                                >
                                    {/* Center Point */}
                                    <div className={`absolute left-10 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#020202] border-2 ${isPast ? 'border-gray-800' : 'border-orange-500'} z-30 flex items-center justify-center`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-gray-800' : 'bg-orange-500 animate-pulse'}`} />
                                    </div>

                                    {/* Content Side */}
                                    <div className="flex-1 pl-20 md:pl-0">
                                        <div className={`flex flex-col ${i % 2 === 0 ? 'md:items-end md:text-right' : 'md:items-start md:text-left'}`}>
                                            <div className="flex items-center gap-4 mb-3">
                                                {i % 2 !== 0 && (
                                                    <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${isPast ? 'border-white/5 text-gray-800' : 'border-orange-500/50 text-orange-500'} bg-white/[0.02]`}>
                                                        {React.isValidElement(item.icon) && React.cloneElement(item.icon as React.ReactElement<{size: number}>, { size: 18 })}
                                                    </div>
                                                )}
                                                <div className="space-y-0.5">
                                                    <span className={`block font-mono text-[7px] sm:text-[9px] font-black tracking-wider sm:tracking-widest uppercase ${isPast ? 'text-gray-600' : 'text-orange-500'}`}>
                                                        {item.day} • {item.date} • {item.time}
                                                    </span>
                                                    <h3 className={`text-xl sm:text-3xl font-black uppercase tracking-tighter italic ${isPast ? 'text-gray-500' : 'text-white'}`}>{item.event}</h3>
                                                </div>
                                                {i % 2 === 0 && (
                                                    <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${isPast ? 'border-white/5 text-gray-800' : 'border-orange-500/50 text-orange-500'} bg-white/[0.02]`}>
                                                        {React.isValidElement(item.icon) && React.cloneElement(item.icon as React.ReactElement<{size: number}>, { size: 18 })}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-gray-400 font-mono text-[9px] uppercase tracking-[0.3em] font-bold max-w-xs">{item.desc}</p>
                                        </div>
                                    </div>

                                    {/* Time Side */}
                                    <div className="hidden md:flex flex-1 flex-col justify-center">
                                        <div className={`p-4 ${i % 2 === 0 ? 'text-left pl-12' : 'text-right pr-12'}`}>
                                            <span className={`text-5xl font-black font-mono italic transition-colors uppercase select-none ${isPast ? 'text-white/5' : 'text-white/20 opacity-100 group-hover:text-white/40'}`}>
                                                {item.time}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="md:hidden absolute top-[-24px] left-[60px]">
                                         <span className={`text-[11px] font-mono font-black tracking-widest ${isPast ? 'text-gray-500' : 'text-orange-500/80'}`}>{item.time}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

const SponsorsSection = () => (
    <section className="py-20 md:py-40 relative z-10 bg-[#020202] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
            <p className="text-gray-300 font-mono text-xs sm:text-sm tracking-[0.4em] sm:tracking-[1em] mb-12 md:mb-20 uppercase font-black italic select-none">{"// STRATEGIC_BACKING_INITIATIVE"}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {([
                    { name: "Sponsor Alpha", status: "LINK_ACTIVE" },
                    { name: "Partner Bravo", status: "LINK_ACTIVE" },
                    { name: "Node Delta", status: "LINK_ACTIVE" }
                ] as { name: string; status: string; image?: string }[]).map((brand, i) => (
                    <motion.div 
                        key={i}
                        whileHover={{ y: -5, borderColor: "rgba(255,102,0,0.5)", backgroundColor: "rgba(255,102,0,0.05)" }}
                        className="h-44 sm:h-48 border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center p-8 grayscale hover:grayscale-0 transition-all cursor-crosshair group relative overflow-hidden rounded-sm"
                    >
                         <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20 group-hover:border-orange-500 transition-colors" />
                         <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20 group-hover:border-orange-500 transition-colors" />
                         
                         {brand.image ? (
                            <div className="mb-2 flex items-center justify-center flex-1">
                                <Image src={brand.image} alt={brand.name} width={160} height={48} className="object-contain" />
                            </div>
                         ) : (
                             <span className="text-gray-200 font-mono text-sm sm:text-base tracking-widest font-black uppercase group-hover:text-white transition-colors mb-3">
                                {brand.name}
                             </span>
                         )}
                         <span className="text-xs font-mono text-gray-400 tracking-[0.3em] font-bold uppercase group-hover:text-orange-500 transition-all">
                            {brand.status}
                         </span>
                         
                         <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/0 via-transparent to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-orange-500/5 transition-all" />
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

const FAQSection = () => (
    <section className="py-20 md:py-40 relative z-10 bg-black">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-left">
            <div className="mb-12 md:mb-24">
                <h2 className="text-5xl sm:text-7xl md:text-[8rem] font-black uppercase tracking-tighter italic leading-none mb-4">Protocols</h2>
                <p className="text-cyan-500 font-mono text-[10px] tracking-[0.5em] uppercase font-black">SYSTEM_QUERY_HANDLING</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                {[
                    { q: "Registration Fees?", a: "Negative. IndiaNext is mission-critical and free for all elite teams selected." },
                    { q: "Team Structure?", a: "2 to 4 operatives per squad. Inter-college alliances are authorized." },
                    { q: "Pre-built Code?", a: "Unauthorized. All systems must be engineered on-site. Timestamp audit in effect." },
                    { q: "Equipment Loadout?", a: "Bring your own hardware (Laptops, Chargers). Power grids and Wi-Fi uplink provided." }
                ].map((faq, i) => (
                    <motion.div 
                        key={i} 
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="p-6 sm:p-10 border border-white/10 bg-[#030303] hover:border-cyan-500/50 transition-all group"
                    >
                        <div className="flex items-start gap-6 mb-6">
                            <HelpCircle className="text-cyan-500 shrink-0 mt-1" size={24} />
                            <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tight italic group-hover:text-white transition-colors">{faq.q}</h4>
                        </div>
                        <p className="text-gray-400 leading-relaxed pl-8 sm:pl-12 text-sm font-bold tracking-tight">
                           {faq.a}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

const Footer = () => (
    <footer className="py-16 md:py-32 border-t border-white/10 bg-black relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-16 items-start mb-16 md:mb-24 text-left">
                <div className="col-span-1 sm:col-span-2">
                    <div className="flex items-center gap-6 sm:gap-10 mb-8 md:mb-12">
                        <Image src="/kessc-logo-Photoroom.png" alt="KES Logo" width={80} height={80} className="object-contain md:w-[110px] md:h-[110px]" />
                        <Image src="/KES 90 years logo in PNG format-01.png" alt="KES 90 Years" width={130} height={70} className="object-contain md:w-[180px] md:h-[100px]" />
                    </div>
                    <h4 className="font-black text-2xl sm:text-4xl mb-6 md:mb-8 uppercase tracking-tighter italic">K.E.S. Shroff College</h4>
                    <p className="text-gray-400 font-mono text-xs leading-relaxed uppercase tracking-[0.2em] font-black">
                        Autonomous | NAAC &apos;A&apos; Grade (3.58 CGPA)<br/>
                        QS I-Gauge Gold | Best College Award (University of Mumbai)<br/>
                        Mumbai, MH 400067, IN
                    </p>
                </div>
                <div>
                   <h4 className="text-gray-400 font-mono text-xs uppercase tracking-[0.5em] mb-12 font-black">DIRECTORIES</h4>
                   <div className="flex flex-col gap-6 text-xs font-black tracking-widest uppercase">
                        <Link href="/rules" className="text-gray-400 hover:text-orange-500 transition-colors italic">./RULEBOOK_v1.0</Link>
                        <Link href="/rules#conduct" className="text-gray-400 hover:text-orange-500 transition-colors italic">./CONDUCT_PROTOCOL</Link>
                        <Link href="/sponsors" className="text-gray-400 hover:text-orange-500 transition-colors italic">./SPONSOR_DECK</Link>
                   </div>
                </div>
                <div>
                   <h4 className="text-gray-400 font-mono text-xs uppercase tracking-[0.5em] mb-12 font-black">COMMS_LINK</h4>
                   <div className="flex flex-col gap-5 text-xs font-black">
                        <a href="mailto:hackathon@kessc.edu.in" className="text-cyan-400 hover:text-white transition-colors underline decoration-cyan-400/30">HACKATHON@KESSC.EDU.IN</a>
                        <p className="text-white tracking-widest italic">+91 75068 54879</p>
                        <p className="text-gray-400 mt-4 text-xs border border-white/5 py-2 px-4 inline-block">@KES_SHROFF_COLLEGE</p>
                   </div>
                </div>
            </div>
            <div className="pt-10 md:pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-10">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 relative rounded-sm border border-white/20 overflow-hidden grayscale group hover:grayscale-0 transition-all">
                        <Image src="/logo-new.png" alt="Logo" width={48} height={48} className="object-cover" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-2xl tracking-tighter uppercase leading-none">IndiaNext</span>
                        <span className="text-xs font-mono text-gray-400 font-bold uppercase tracking-widest">Global_Protocol_v2.0.26</span>
                    </div>
                </div>
                <p className="text-gray-400 text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.5em] font-black uppercase text-center">&copy; 2026 INDIANEXT // DECRYPTED_MISSION_DATA_SECURE</p>
            </div>
        </div>
    </footer>
);

// --- Subcomponents ---

const HoloCard = ({ title, subtitle, accent, icon, desc, tags }: HoloCardProps) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - rect.left);
        y.set(e.clientY - rect.top);
    };

    return (
        <motion.div 
            onMouseMove={handleMouseMove}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -10 }}
            className="group relative min-h-[400px] sm:min-h-[500px] bg-[#050505] border border-white/5 p-6 sm:p-8 md:p-12 overflow-hidden backdrop-blur-sm text-left transition-colors hover:border-white/10"
        >
            <motion.div 
                className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition duration-500"
            >
                <div
                  className="w-full h-full"
                  style={
                    {
                      background: useMotionTemplate`
                        radial-gradient(
                          800px circle at ${x}px ${y}px,
                          ${accent}20,
                          transparent 80%
                        )
                      `,
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                    } as unknown as React.CSSProperties
                  }
                />
            </motion.div>
            
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/10" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/10" />

            <div className="relative z-10 flex flex-col h-full">
                <div className="w-24 h-24 mb-12 flex items-center justify-center border border-white/10 bg-white/5 rounded-sm relative group-hover:scale-110 transition-transform">
                     {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<{ size?: number; style?: React.CSSProperties }>, { size: 48, style: { color: accent } })}
                     <div className="absolute inset-0 bg-white/5 animate-pulse" />
                </div>

                <div className="mb-4 font-mono text-[10px] font-black tracking-[0.5em]" style={{ color: accent }}>{subtitle}</div>
                <h3 className="text-3xl sm:text-5xl md:text-6xl font-black mb-6 sm:mb-10 text-white uppercase tracking-tighter leading-[0.8] italic">{title}</h3>
                
                <p className="text-gray-400 text-base sm:text-xl mb-8 sm:mb-12 leading-tight flex-grow font-bold tracking-tight">{desc}</p>
                
                <div className="flex flex-col gap-6 mt-auto">
                    <div className="flex flex-wrap gap-3">
                        {tags.map((t: string) => (
                            <span key={t} className="px-4 py-1.5 border border-white/5 text-[9px] font-mono text-gray-400 uppercase tracking-widest bg-black font-black italic">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

const TechDetail = ({ icon, title, desc, accent = CYAN }: TechDetailProps) => (
    <motion.div 
        variants={fadeInUp}
        whileHover={{ x: 10 }}
        className="flex items-start gap-4 sm:gap-6 p-5 sm:p-8 border border-white/5 bg-white/5 transition-all group rounded-sm text-left relative overflow-hidden"
    >
        <div className="absolute top-0 left-0 w-1 h-0 bg-orange-500 group-hover:h-full transition-all duration-300" style={{ backgroundColor: accent }} />
        <div className="transition-all group-hover:translate-x-1 group-hover:scale-110" style={{ color: accent }}>{icon}</div>
        <div>
            <h4 className="font-black text-2xl sm:text-3xl mb-1 uppercase tracking-tighter text-white italic">{title}</h4>
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-[0.3em] font-black">{desc}</p>
        </div>
    </motion.div>
);

const CyberBackground = memo(() => (
    <div className="fixed inset-0 z-0 bg-[#000000] overflow-hidden will-change-auto">
        {/* Deep Space Base */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0d0d1a_0%,#000000_100%)]" />
        
        {/* Dynamic Nebulas — Pure CSS animations (no JS overhead) */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-orange-600 rounded-full blur-[200px] mix-blend-screen animate-[nebula-pulse_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-green-600 rounded-full blur-[200px] mix-blend-screen animate-[nebula-pulse_15s_ease-in-out_2s_infinite]" />

        {/* Moving Grid Floor */}
        <div 
            className="absolute bottom-[-10%] left-[-50%] right-[-50%] h-[80vh] bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [transform:rotateX(75deg)] origin-bottom opacity-30"
        />
        
        {/* Subtle Horizontal Scanline */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />
    </div>
));
CyberBackground.displayName = 'CyberBackground';
