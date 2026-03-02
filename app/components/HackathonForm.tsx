
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { INDIAN_COLLEGES } from '@/lib/data/colleges';
import { INDIAN_DEGREES } from '@/lib/data/degrees';


// ── Types ───────────────────────────────────────
type Answers = Record<string, string | string[] | undefined>;

interface Question {
  id: string;
  type: string;
  question: string;
  subtext?: string;
  text?: string;
  placeholder?: string;
  options?: string[];
  suggestions?: string[];
  sameAsLeaderField?: string;
  required?: boolean;
  isEmail?: boolean;
  noPaste?: boolean;
  guidance?: string;
  condition?: (answers: Answers) => boolean;
}

const QUESTIONS: Question[] = [
  // --- SECTION 1: TRACK SELECTION ---
  {
    id: 'track',
    type: 'choice',
    question: "Choose Competition Track",
    subtext: "Select the track you wish to compete in.",
    options: [
      "IdeaSprint: Build MVP in 24 Hours",
      "BuildStorm: Solve Problem Statement in 24 Hours"
    ],
    required: true,
  },
  
  // --- MISSION BRIEFING (dynamically loaded from API) --
  {
      id: 'buildBrief',
      type: 'dynamic-problem',
      question: "MISSION BRIEFING",
      subtext: "Your assigned problem statement (round-robin distribution).",
      condition: (answers: Answers) => answers.track === "BuildStorm: Solve Problem Statement in 24 Hours",
  },

  // --- SECTION 3: TEAM DETAILS ---
  {
    id: 'teamName',
    type: 'text',
    question: "Team Name",
    placeholder: "e.g. Innovation Squad",
    required: true,
  },
  {
    id: 'teamSize',
    type: 'choice',
    question: "Team Size",
    options: ["2 Members", "3 Members", "4 Members"],
    required: true,
  },

  // --- SECTION 4: TEAM LEADER DETAILS ---
  {
    id: 'leaderName',
    type: 'text',
    question: "Team Leader Full Name",
    placeholder: "Your Full Name",
    required: true,
  },
  {
    id: 'leaderGender',
    type: 'choice',
    question: "Team Leader Gender",
    options: ["Male", "Female", "Other"],
    required: true,
  },
  {
    id: 'leaderEmail',
    type: 'email',
    question: "Team Leader Email ID",
    placeholder: "leader@example.com",
    required: true,
    isEmail: true,
  },
  {
    id: 'leaderMobile',
    type: 'tel',
    question: "Team Leader Mobile Number",
    placeholder: "9876543210", 
    required: true,
  },
  {
    id: 'leaderCollege',
    type: 'combobox',
    question: "College / University Name",
    placeholder: "Search or type your college...",
    suggestions: INDIAN_COLLEGES,
    required: true,
  },
  {
    id: 'leaderDegree',
    type: 'combobox',
    question: "Degree / Course",
    placeholder: "Search or type your degree...",
    suggestions: INDIAN_DEGREES,
    required: true,
  },
  
  // --- SECTION 5: TEAM MEMBER DETAILS ---
  // Member 2
  {
    id: 'member2Name',
    type: 'text',
    question: "Member 2 Full Name",
    placeholder: "Full Name",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["2 Members", "3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member2Gender',
    type: 'choice',
    question: "Member 2 Gender",
    options: ["Male", "Female", "Other"],
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["2 Members", "3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member2Email',
    type: 'email',
    question: "Member 2 Email",
    placeholder: "Email Address",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["2 Members", "3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member2College',
    type: 'combobox',
    question: "Member 2 College Name",
    placeholder: "Search or type college...",
    suggestions: INDIAN_COLLEGES,
    sameAsLeaderField: 'leaderCollege',
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["2 Members", "3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member2Degree',
    type: 'combobox',
    question: "Member 2 Degree/Course",
    placeholder: "Search or type degree...",
    suggestions: INDIAN_DEGREES,
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["2 Members", "3 Members", "4 Members"].includes(answers.teamSize),
  },

  // Member 3
  {
    id: 'member3Name',
    type: 'text',
    question: "Member 3 Full Name",
    placeholder: "Full Name",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member3Gender',
    type: 'choice',
    question: "Member 3 Gender",
    options: ["Male", "Female", "Other"],
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member3Email',
    type: 'email',
    question: "Member 3 Email",
    placeholder: "Email Address",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member3College',
    type: 'combobox',
    question: "Member 3 College Name",
    placeholder: "Search or type college...",
    suggestions: INDIAN_COLLEGES,
    sameAsLeaderField: 'leaderCollege',
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["3 Members", "4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member3Degree',
    type: 'combobox',
    question: "Member 3 Degree/Course",
    placeholder: "Search or type degree...",
    suggestions: INDIAN_DEGREES,
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["3 Members", "4 Members"].includes(answers.teamSize),
  },

  // Member 4
  {
    id: 'member4Name',
    type: 'text',
    question: "Member 4 Full Name",
    placeholder: "Full Name",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member4Gender',
    type: 'choice',
    question: "Member 4 Gender",
    options: ["Male", "Female", "Other"],
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member4Email',
    type: 'email',
    question: "Member 4 Email",
    placeholder: "Email Address",
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member4College',
    type: 'combobox',
    question: "Member 4 College Name",
    placeholder: "Search or type college...",
    suggestions: INDIAN_COLLEGES,
    sameAsLeaderField: 'leaderCollege',
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["4 Members"].includes(answers.teamSize),
  },
  {
    id: 'member4Degree',
    type: 'combobox',
    question: "Member 4 Degree/Course",
    placeholder: "Search or type degree...",
    suggestions: INDIAN_DEGREES,
    required: true,
    condition: (answers: Answers) => typeof answers.teamSize === 'string' && ["4 Members"].includes(answers.teamSize),
  },

  // --- SECTION 6: SUBMISSION DETAILS (TRACK 1) ---
  {
    id: 'ideaTitle',
    type: 'text',
    question: "Idea Title",
    placeholder: "Title of your idea",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'problemStatement',
    type: 'long-text',
    question: "Problem Statement",
    subtext: "Describe the problem clearly in 4–6 lines.",
    placeholder: "The problem we are solving is...",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'proposedSolution',
    type: 'long-text',
    question: "Proposed Solution",
    subtext: "Explain your idea and approach.",
    placeholder: "Our solution is...",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
    noPaste: true,
    guidance: "Suggested Format:\n\n1. The Gap: What is missing today?\n2. The Solution: Your core value proposition.\n3. Implementation: How will you build it?\n4. Feasibility: Why is this possible now?",
  },
  {
    id: 'targetUsers',
    type: 'long-text',
    question: "Target Users / Beneficiaries",
    placeholder: "e.g. Students, Hospitals, Small Businesses",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'expectedImpact',
    type: 'long-text',
    question: "Expected Impact",
    placeholder: "Social or economic impact...",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'techStack',
    type: 'text',
    question: "Technology Stack (Recommended)",
    placeholder: "e.g. React, Python, AI/ML, Blockchain",
    required: false,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'docLink',
    type: 'url',
    question: "Supporting Documents (Link)",
    subtext: "Upload Idea Deck (PDF), Prototype, or Research to Drive/Dropbox and paste public link here. (Max 10 slides)",
    placeholder: "https://drive.google.com/...",
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
    id: 'ideaRules',
    type: 'checkbox',
    question: "IdeaSprint Rules Acceptance",
    subtext: "You must accept ALL rules to proceed.",
    options: [
      "I confirm that this idea is original and not copied.",
      "I agree that plagiarism will lead to disqualification.",
      "I agree organizers may use idea name for promotion.",
      "I understand judges decision is final.",
      "I agree to maintain respectful communication."
    ],
    required: true,
    condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },
  {
      id: 'ideaAdditionalNotes',
      type: 'long-text',
      question: "Additional Notes / Message",
      placeholder: "Any special requirements...",
      required: false,
      condition: (answers: Answers) => answers.track === "IdeaSprint: Build MVP in 24 Hours",
  },


  // --- SECTION 6: SUBMISSION DETAILS (TRACK 2) ---
  {
    id: 'problemDesc',
    type: 'long-text',
    question: "Problem Statement Description",
    subtext: "Describe how you plan to solve the given problem (without copy-paste).",
    placeholder: "Our approach...",
    required: true,
    condition: (answers: Answers) => answers.track === "BuildStorm: Solve Problem Statement in 24 Hours",
    noPaste: true,
    guidance: "PROBLEM STATEMENT:\nDisaster Response Coordination - Build a real-time, offline-first system to connect flood victims with local rescue teams.\n\nSuggested Response Pattern:\n\n1. Analysis: Breakdown of the specific problem statement.\n2. Technical Approach: Architecture & Stack choice.\n3. Innovation: What makes your fix unique?\n4. Execution Plan: 24-hour timeline strategy.",
  },
  {
    id: 'githubLink',
    type: 'url',
    question: "GitHub Team Repo Link",
    placeholder: "https://github.com/...",
    required: false,
    condition: (answers: Answers) => answers.track === "BuildStorm: Solve Problem Statement in 24 Hours",
  },
  {
    id: 'buildRules',
    type: 'checkbox',
    question: "BuildStorm Rules Acceptance",
    subtext: "You must accept ALL rules to proceed.",
    options: [
      "I agree MVP must be built during 24-hour hackathon.",
      "I agree reused pre-built projects lead to disqualification.",
      "I agree to submit GitHub repo link with full source code.",
      "I agree to submit deployed demo link before deadline.",
      "I agree plagiarism leads to disqualification.",
      "I agree to follow code of conduct.",
      "I agree organizers decision is final."
    ],
    required: true,
    condition: (answers: Answers) => answers.track === "BuildStorm: Solve Problem Statement in 24 Hours",
  },
    {
      id: 'buildAdditionalNotes',
      type: 'long-text',
      question: "Additional Notes / Special Requirements",
      placeholder: "Any special requirements...",
      required: false,
      condition: (answers: Answers) => answers.track === "BuildStorm: Solve Problem Statement in 24 Hours",
  },

  // --- COMMON FINAL SECTION ---
  {
    id: 'consent',
    type: 'checkbox',
    question: "Consent & Declaration",
    subtext: "You must accept all to submit.",
    options: [
      "I confirm all details submitted are correct.",
      "I agree to receive updates via Email/WhatsApp.",
      "I understand participation is subject to verification."
    ],
    required: true,
  },
  {
    id: 'hearAbout',
    type: 'choice',
    question: "How did you hear about INDIANEXT?",
    options: ["Instagram", "College Group", "Friend", "LinkedIn", "Website", "Other"],
    required: true,
  }
];

// Subcomponents

const WelcomeScreen = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-950 text-white relative overflow-hidden font-mono">
     {/* Grid Background */}
     <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

     <div className="z-10 text-center">
        <div className="inline-block border border-orange-500/50 bg-orange-500/10 px-3 py-1 mb-6 text-orange-400 text-xs tracking-[0.2em] uppercase">
            {/* Classified Access */}
            {`// Classified Access`}
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-2 leading-none uppercase">
          India<span className="text-orange-500">Next</span>
        </h1>
        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-12 tracking-widest uppercase">
           <span>IdeaSprint</span>
           <div className="w-1 h-1 bg-slate-500 rounded-full" />
           <span>BuildStorm</span>
        </div>
        
        <button 
          onClick={onStart}
          className="group relative inline-flex items-center justify-center px-10 py-3 font-bold text-white transition-all duration-200 bg-orange-600 font-mono tracking-widest border border-orange-500 hover:bg-orange-500 focus:outline-none ring-offset-2 focus:ring-2"
        >
           [ OPEN_DOSSIER ]
        </button>
     </div>
  </div>
);

const ThankYouScreen = ({ track }: { track: string }) => (
   <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-950 font-mono text-white p-4">
      <div className="w-full max-w-2xl border-2 border-green-500/50 bg-green-500/5 p-8 relative">
         <div className="absolute top-0 right-0 p-2 text-xs text-green-500 border-l border-b border-green-500/50">STATUS: APPROVED</div>
         <div className="text-green-400 text-6xl mb-6">
             <Check size={64} strokeWidth={1.5} />
         </div>
         <h1 className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-tight">Transmission Received</h1>
         <p className="text-lg text-green-400/80 mb-6 leading-relaxed">
           Subject registered for protocol: <strong className="text-white">{track}</strong>.<br/>
           Directives have been forwarded to the designated communication channel (Email).
         </p>

         {/* Community Links */}
         <div className="border border-green-500/30 bg-green-500/5 p-5 mb-8">
           <p className="text-sm text-green-400/70 uppercase tracking-wider mb-4 font-bold">Join the Community</p>
           <div className="flex flex-col sm:flex-row gap-3">
             <a
               href="https://chat.whatsapp.com/JMriiPQLVL92R8CCxBo7Te?mode=gi_t"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#25D366]/10 border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366] hover:text-black transition-colors uppercase text-sm tracking-wider"
             >
               <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
               WhatsApp Group
             </a>
             <a
               href="https://discord.gg/TWjJXRh2vT"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#5865F2]/10 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2] hover:text-white transition-colors uppercase text-sm tracking-wider"
             >
               <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
               Discord Server
             </a>
           </div>
         </div>

         <Link href="/" className="inline-block px-6 py-2 border border-green-500 text-green-400 hover:bg-green-500 hover:text-black transition-colors uppercase text-sm tracking-wider">
             [ Return to HQ ]
         </Link>
      </div>
   </div>
);

// ── Combobox (searchable dropdown + free text) ──
const ComboboxInput = ({ value, onChange, suggestions, placeholder }: {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input (fuzzy: split by space, match all tokens)
  const filtered = React.useMemo(() => {
    if (!value || value.length < 2) return [];
    const tokens = value.toLowerCase().split(/\s+/).filter(Boolean);
    return suggestions
      .filter(s => {
        const lower = s.toLowerCase();
        return tokens.every(t => lower.includes(t));
      })
      .slice(0, 8); // Max 8 suggestions for performance
  }, [value, suggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Auto-focus
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      onChange(filtered[highlightIndex]);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightIndex(-1);
          setIsOpen(true);
        }}
        onFocus={() => { if (value && value.length >= 2) setIsOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder.toUpperCase()}
        autoComplete="off"
        className="w-full bg-transparent border-b-2 border-slate-700 text-xl md:text-2xl py-2 focus:outline-none focus:border-orange-500 transition-colors placeholder-slate-800 font-mono text-orange-400 tracking-wide"
      />

      {/* Dropdown */}
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded shadow-2xl"
        >
          {filtered.map((item, idx) => (
            <li
              key={item}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onChange(item);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={`px-4 py-3 cursor-pointer font-mono text-sm transition-colors ${
                idx === highlightIndex
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {/* Hint text */}
      {value && value.length >= 2 && filtered.length === 0 && isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded text-slate-500 text-xs font-mono">
          No matches — your custom entry will be used
        </div>
      )}
    </div>
  );
};

const InputRenderer = ({ question, value, onChange, onCheckbox, answers, emailVerified, verifiedEmail, onResetVerification, showChangeEmailWarning, onChangeEmailClick, onCancelChangeEmail, assignedProblem, problemLoading, problemError, fetchAssignedProblem }: { 
  question: Question; 
  value: string | string[] | undefined; 
  onChange: (val: string | string[]) => void; 
  onCheckbox: (opt: string) => void; 
  answers: Answers;
  emailVerified?: boolean;
  verifiedEmail?: string | null;
  onResetVerification?: () => void;
  showChangeEmailWarning?: boolean;
  onChangeEmailClick?: () => void;
  onCancelChangeEmail?: () => void;
  assignedProblem?: { id: string; title: string; objective: string; description?: string | null; extensionsRemaining: number } | null;
  problemLoading?: boolean;
  problemError?: string;
  fetchAssignedProblem?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
       if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [question]);

  // Special handling for verified email field
  if (question.id === 'leaderEmail' && emailVerified && verifiedEmail) {
    return (
      <div className="w-full space-y-4">
        {/* Locked Email Display */}
        <div className="flex items-center gap-4 border-2 border-green-500/30 bg-green-500/5 rounded p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-xs uppercase tracking-wider text-green-400 font-bold">Verified</span>
            </div>
            <div className="text-xl md:text-2xl font-mono text-green-400 tracking-wide">
              {verifiedEmail}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            ✓ AUTHENTICATED
          </div>
        </div>

        {/* Warning Dialog */}
        {showChangeEmailWarning ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-900/20 border-2 border-yellow-500/50 rounded p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-yellow-400 uppercase tracking-wider mb-2">
                  Security Warning
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Changing your email address will <strong className="text-yellow-400">invalidate your current verification</strong>. 
                  You will need to:
                </p>
                <ul className="text-slate-400 text-sm space-y-2 mb-4 list-disc list-inside">
                  <li>Enter a new email address</li>
                  <li>Receive a new OTP code</li>
                  <li>Verify the new email before continuing</li>
                </ul>
                <div className="bg-slate-900/50 border border-slate-700 p-3 rounded text-xs text-slate-400 font-mono">
                  <strong className="text-orange-400">Current verified email:</strong> {verifiedEmail}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onResetVerification}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 uppercase tracking-wider text-sm transition-all"
              >
                Yes, Change Email
              </button>
              <button
                onClick={onCancelChangeEmail}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 px-4 uppercase tracking-wider text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Change Email Button */}
            <button
              onClick={onChangeEmailClick}
              className="text-sm text-orange-500 hover:text-orange-400 font-mono uppercase tracking-wider border border-orange-500/30 hover:border-orange-500/50 px-4 py-2 transition-all flex items-center gap-2 group"
            >
              <span>⚠</span>
              <span>Change Email</span>
            </button>

            {/* Info Box */}
            <div className="bg-slate-800/50 border border-slate-700 p-3 text-xs text-slate-400 font-mono">
              <div className="text-orange-400 font-bold mb-1">🔒 SECURITY NOTICE</div>
              Your email has been verified and secured. Changing it will require re-verification.
            </div>
          </>
        )}
      </div>
    );
  }

  if (question.type === 'choice') {
    return (
      <div className="flex flex-col gap-2 max-w-lg w-full">
        {question.options?.map((opt: string, _idx: number) => (
          <OptionButton 
            key={opt} 
            opt={opt} 
            selected={value === opt} 
            onSelect={() => onChange(opt)} 
          />
        ))}
      </div>
    );
  }

  if (question.type === 'checkbox') {
    const selected = value || [];
    const allOptions = question.options || [];
    const allChecked = allOptions.length > 0 && allOptions.every((opt: string) => selected.includes(opt));
    const handleAcceptAll = () => {
      if (allChecked) {
        onChange([]);
      } else {
        onChange([...allOptions]);
      }
    };
    return (
      <div className="flex flex-col gap-2 max-w-xl w-full">
        {/* Accept All button */}
        <button
          onClick={handleAcceptAll}
          className={`self-end px-3 py-1 text-[11px] font-mono uppercase tracking-wider border rounded transition-all mb-1
            ${allChecked
              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-transparent hover:text-slate-400 hover:border-slate-600'
              : 'bg-transparent border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400'}
          `}
        >
          {allChecked ? '✓ All Accepted' : 'Accept All'}
        </button>
        {allOptions.map((opt: string, idx: number) => (
           <button
             key={idx}
             onClick={() => onCheckbox(opt)}
             className={`text-left px-4 py-3 border text-sm md:text-base font-mono transition-all flex items-start gap-4 w-full
                ${selected.includes(opt) 
                    ? 'bg-orange-500/10 border-orange-500 text-white' 
                    : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'}
             `}
           >
             <div className={`mt-0.5 w-5 h-5 flex items-center justify-center shrink-0 border
                ${selected.includes(opt) ? 'bg-orange-500 border-orange-500 text-black' : 'border-slate-600'}
             `}>
               {selected.includes(opt) && <Check size={14} strokeWidth={3} />}
             </div>
             <span className="leading-snug">{opt}</span>
           </button>
        ))}
      </div>
    );
  }

  if (question.type === 'long-text') {
    return (
      <div className="w-full space-y-4">
         {/* Show assigned problem statement in the problem solving area */}
         {question.id === 'problemDesc' && assignedProblem && (
           <div className="bg-slate-900 border border-slate-700 p-4 rounded relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-0.5 bg-orange-500/50" />
             <div className="flex items-center gap-2 text-orange-400 font-bold mb-2 uppercase tracking-widest text-[10px]">
               <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse rounded-full" />
               Your Assigned Problem Statement
             </div>
             <h4 className="text-lg font-mono text-white font-bold mb-1">{assignedProblem.title}</h4>
             <p className="text-sm font-mono text-slate-300 leading-relaxed">
               <span className="text-orange-400 font-bold">Objective: </span>{assignedProblem.objective}
             </p>
             <div className="mt-3 bg-yellow-950/40 border border-yellow-500/20 p-2.5 rounded">
               <p className="text-yellow-300/80 text-xs font-mono leading-relaxed">
                 ⚠ This problem statement is for the <span className="font-bold text-yellow-300">filtering process only</span>. The actual problem statement will be assigned on the day of the event.
               </p>
             </div>
           </div>
         )}

         <div className="flex flex-col md:flex-row gap-6 w-full">
           <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement & HTMLInputElement>}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              onPaste={(e) => {
                  if (question.noPaste) {
                      e.preventDefault();
                      alert("Pasting is disabled for this section. Please type your response.");
                  }
              }}
              placeholder={question.placeholder ? question.placeholder.toUpperCase() : ''}
              className="flex-1 bg-slate-900/50 border border-slate-700 p-4 text-xl font-mono text-white placeholder-slate-700 focus:outline-none focus:border-orange-500 transition-all resize-none h-48 md:h-64 tracking-tight leading-relaxed"
           />
           
           {/* Guidance Panel */}
           {(question.guidance || (question.id === 'problemDesc' && assignedProblem)) && (
               <div className="md:w-64 shrink-0 bg-slate-900 border border-slate-800 p-4 rounded text-sm text-slate-400 font-mono hidden md:block">
                   <div className="text-orange-500 font-bold mb-2 uppercase tracking-wider text-xs border-b border-orange-500/20 pb-1">
                       RESPONSE PATTERN
                   </div>
                   <div className="whitespace-pre-wrap leading-relaxed text-xs">
                       {question.id === 'problemDesc' && assignedProblem
                         ? `PROBLEM STATEMENT:\n${assignedProblem.title} - ${assignedProblem.objective}\n\nSuggested Response Pattern:\n\n1. Analysis: Breakdown of the specific problem statement.\n2. Technical Approach: Architecture & Stack choice.\n3. Innovation: What makes your fix unique?\n4. Execution Plan: 24-hour timeline strategy.`
                         : question.guidance
                       }
                   </div>
                   {question.noPaste && (
                       <div className="mt-4 text-xs text-red-500 border border-red-900/50 bg-red-900/10 p-2 text-center uppercase tracking-widest font-bold">
                           [ NO PASTE ALLOWED ]
                       </div>
                   )}
               </div>
           )}
         </div>
      </div>
    );
  }

  if (question.type === 'tel') {
    return (
      <div className="flex items-center gap-4 border-b-2 border-slate-700 py-2 focus-within:border-orange-500 transition-all">
         <div className="flex items-center gap-2 select-none opacity-80">
            <span className="text-xl">🇮🇳</span>
            <span className="text-xl md:text-2xl text-slate-400 font-mono">+91</span>
         </div>
         <input
            ref={inputRef as React.RefObject<HTMLTextAreaElement & HTMLInputElement>}
            type="tel"
            value={value || ''}
            maxLength={10}
            onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                onChange(val);
            }}
            placeholder="9876543210"
            className="w-full bg-transparent focus:outline-none text-xl md:text-3xl text-orange-400 font-mono tracking-[0.2em] placeholder-slate-800"
         />
      </div>
    );
  }

  if (question.type === 'info') {
      return (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/50" />
              <div className="flex items-center gap-2 text-orange-400 font-bold mb-4 uppercase tracking-widest text-xs">
                  <span className="w-2 h-2 bg-orange-500 animate-pulse rounded-full" />
                  Classified Intelligence
              </div>
              <div className="text-xl md:text-2xl font-mono text-white leading-relaxed whitespace-pre-wrap">
                  {question.text}
              </div>
          </div>
      );
  }

  // Dynamic problem statement (BuildStorm round-robin)
  if (question.type === 'dynamic-problem') {
    return (
      <div className="w-full max-w-2xl">
        {problemLoading && (
          <div className="bg-slate-900 border border-slate-700 p-8 rounded text-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 font-mono text-sm uppercase tracking-wider">Assigning problem statement...</p>
            </div>
          </div>
        )}
        {problemError && (
          <div className="bg-red-950/50 border border-red-500/50 p-6 rounded">
            <p className="text-red-400 font-mono text-sm">{problemError}</p>
            <button
              onClick={() => fetchAssignedProblem?.()}
              className="mt-4 px-4 py-2 border border-orange-500 text-orange-400 text-xs font-mono uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {assignedProblem && !problemLoading && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/50" />
              <div className="flex items-center gap-2 text-orange-400 font-bold mb-4 uppercase tracking-widest text-xs">
                <span className="w-2 h-2 bg-orange-500 animate-pulse rounded-full" />
                Your Assigned Problem Statement
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-mono text-white font-bold mb-3">
                  {assignedProblem.title}
                </h3>
                <div className="text-lg md:text-xl font-mono text-slate-300 leading-relaxed mb-3">
                  <span className="text-orange-400 font-bold">Objective: </span>
                  {assignedProblem.objective}
                </div>
                {assignedProblem.description && (
                  <p className="text-sm font-mono text-slate-400 leading-relaxed border-l-2 border-slate-700 pl-4">
                    {assignedProblem.description}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-yellow-950/40 border border-yellow-500/30 p-4 rounded">
              <p className="text-yellow-400 text-xs font-mono uppercase tracking-wider font-bold mb-1">
                ⚠ Important Note
              </p>
              <p className="text-yellow-300/80 text-sm font-mono leading-relaxed">
                This problem statement is for the <span className="font-bold text-yellow-300">filtering process only</span>. The actual problem statement for the hackathon will be assigned on the day of the event.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'combobox' && question.suggestions) {
    const leaderField = question.sameAsLeaderField;
    const leaderValue = leaderField ? (answers[leaderField] as string) || '' : '';
    const isSameAsLeader = leaderField ? (value as string) === leaderValue && leaderValue !== '' : false;

    return (
      <div className="w-full">
        {leaderField && leaderValue && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none group">
            <span
              className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                isSameAsLeader
                  ? 'bg-orange-500 border-orange-500'
                  : 'border-slate-600 group-hover:border-orange-500/50'
              }`}
              onClick={() => {
                if (isSameAsLeader) {
                  onChange('');
                } else {
                  onChange(leaderValue);
                }
              }}
            >
              {isSameAsLeader && <Check className="w-3 h-3 text-white" />}
            </span>
            <span
              className="text-sm font-mono text-slate-400 group-hover:text-slate-300 transition-colors"
              onClick={() => {
                if (isSameAsLeader) {
                  onChange('');
                } else {
                  onChange(leaderValue);
                }
              }}
            >
              Same as Leader ({leaderValue})
            </span>
          </label>
        )}
        {!isSameAsLeader && (
          <ComboboxInput
            value={(value as string) || ''}
            onChange={onChange}
            suggestions={question.suggestions}
            placeholder={question.placeholder || ''}
          />
        )}
        {isSameAsLeader && (
          <div className="w-full bg-transparent border-b-2 border-orange-500/50 text-xl md:text-2xl py-2 font-mono text-orange-400 tracking-wide opacity-60">
            {leaderValue}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLTextAreaElement & HTMLInputElement>}
      type={question.type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder ? question.placeholder.toUpperCase() : ''}
      className={`w-full bg-transparent border-b-2 border-slate-700 text-xl md:text-2xl py-2 focus:outline-none focus:border-orange-500 transition-colors placeholder-slate-800 font-mono text-orange-400 tracking-wide
      `}
    />
  );
};

const OptionButton = ({ opt, selected, onSelect }: { opt: string; selected: boolean; onSelect: () => void }) => {
   return (
      <button
        onClick={onSelect}
        className={`text-left px-4 py-3 border flex items-center gap-4 w-full transition-all
           ${selected 
             ? 'bg-orange-500 border-orange-500 text-black' 
             : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}
        `}
      >
        <div className={`w-4 h-4 border flex items-center justify-center shrink-0
           ${selected ? 'border-black bg-black' : 'border-slate-600'}
        `}>
          {selected && <div className="w-2 h-2 bg-orange-500" />}
        </div>
        <span className="font-mono text-sm uppercase tracking-wider">{opt}</span>
      </button>
   );
};

export default function HackathonForm() {
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [direction, setDirection] = useState(0);

  // OTP State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [showChangeEmailWarning, setShowChangeEmailWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // BuildStorm: dynamically assigned problem statement
  const [assignedProblem, setAssignedProblem] = useState<{
    id: string;
    title: string;
    objective: string;
    description?: string | null;
    extensionsRemaining: number;
  } | null>(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState("");

  // ✅ NEW: Generate idempotency key once per form session
  const [idempotencyKey] = useState(() => {
    // Use crypto.randomUUID() if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  });

  const totalSteps = QUESTIONS.length;

  // Compute visible step count (questions whose conditions are met)
  const visibleSteps = React.useMemo(() => {
    return QUESTIONS.filter(q => !q.condition || q.condition(answers)).length;
  }, [answers]);

  // Compute visible step index (1-based) for current position
  const visibleStepIndex = React.useMemo(() => {
    let idx = 0;
    for (let i = 0; i <= currentStep; i++) {
      const q = QUESTIONS[i];
      if (!q.condition || q.condition(answers)) idx++;
    }
    return idx;
  }, [currentStep, answers]);

  const currentQuestion = QUESTIONS[currentStep];

  const handleStart = () => setStarted(true);

  // Fetch assigned problem statement from round-robin API
  const fetchAssignedProblem = React.useCallback(async () => {
    setProblemLoading(true);
    setProblemError("");
    try {
      // Get or create anonymous ID for unauthenticated users
      let anonymousId = localStorage.getItem('anonymous_id');
      if (!anonymousId) {
        anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('anonymous_id', anonymousId);
      }

      const res = await fetch('/api/reserve-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Ensure session_token cookie is sent (critical on mobile)
        body: JSON.stringify({
          // Fallback: send sessionId in body for mobile browsers that strip cookies
          sessionId: localStorage.getItem('session_token_fallback') || undefined,
          // For unauthenticated users, send anonymous ID
          anonymousId: localStorage.getItem('session_token_fallback') ? undefined : anonymousId,
        }),
      });
      const response = await res.json();

      if (!response.success) {
        if (response.allFilled) {
          setProblemError("All problem statements have been filled. Registration is currently closed.");
        } else {
          setProblemError(response.message || "Failed to assign problem statement.");
        }
        return;
      }

      if (response.data) {
        setAssignedProblem({
          id: response.data.id,
          title: response.data.title,
          objective: response.data.objective,
          description: response.data.description || null,
          extensionsRemaining: response.data.extensionsRemaining ?? 0,
        });
      }
    } catch (err) {
      setProblemError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setProblemLoading(false);
    }
  }, []);

  // Auto-fetch problem when reaching buildBrief step
  useEffect(() => {
    if (
      currentQuestion?.id === 'buildBrief' &&
      currentQuestion?.type === 'dynamic-problem' &&
      !assignedProblem &&
      !problemLoading
    ) {
      fetchAssignedProblem();
    }
  }, [currentQuestion, assignedProblem, problemLoading, fetchAssignedProblem]);

  // Logic Helpers
  const getNextValidStep = React.useCallback((current: number, dir: number, currentAnswers: Answers) => {
    let nextStep = current + dir;
    while (nextStep >= 0 && nextStep < totalSteps) {
       const q = QUESTIONS[nextStep];
       if (q.condition && !q.condition(currentAnswers)) {
         nextStep += dir;
       } else {
         return nextStep;
       }
    }
    return nextStep;
  }, [totalSteps]);

  const sendOtp = React.useCallback(async () => {
      setLoading(true);
      setErrorMsg("");
      
      try {
          const res = await fetch('/api/send-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ 
                email: answers.leaderEmail,
                purpose: 'REGISTRATION',
                track: answers.track?.includes('IdeaSprint') ? 'IDEA_SPRINT' : 'BUILD_STORM'
              }),
          });
          const response = await res.json();
          
          if (!response.success) {
            setErrorMsg(response.message);
            setLoading(false);
            return;
          }
          
          // Show debug OTP in development
          if (response.debugOtp) {
            console.log('Debug OTP:', response.debugOtp);
            alert(`Development Mode - OTP: ${response.debugOtp}`);
          }
          
          setShowOtpInput(true);
      } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Network error. Please try again.');
      } finally {
          setLoading(false);
      }
  }, [answers.leaderEmail, answers.track]);

  const submitForm = React.useCallback(async () => {
      setLoading(true);

      // Client-side duplicate email check
      const emailFields = [
        answers.leaderEmail,
        answers.member2Email,
        answers.member3Email,
        answers.member4Email,
      ].filter((e): e is string => typeof e === 'string' && e.trim() !== '');

      const normalizedEmails = emailFields.map(e => e.toLowerCase().trim());
      const uniqueEmails = new Set(normalizedEmails);
      if (uniqueEmails.size !== normalizedEmails.length) {
        const dupes = normalizedEmails.filter((e, i) => normalizedEmails.indexOf(e) !== i);
        setErrorMsg(`Duplicate email found: ${dupes[0]}. Each team member must have a unique email.`);
        setLoading(false);
        return;
      }
      
      try {
          // Flatten College Logic
          const finalAnswers = { ...answers };
          // "Same as Leader" college values are already set inline by the combobox checkbox

          if (finalAnswers.track === "IdeaSprint: Build MVP in 24 Hours") finalAnswers.additionalNotes = finalAnswers.ideaAdditionalNotes;
          if (finalAnswers.track === "BuildStorm: Solve Problem Statement in 24 Hours") finalAnswers.additionalNotes = finalAnswers.buildAdditionalNotes;

          // Include assigned problem statement ID for BuildStorm track
          if (assignedProblem?.id && finalAnswers.track === "BuildStorm: Solve Problem Statement in 24 Hours") {
            finalAnswers.assignedProblemStatementId = assignedProblem.id;
          }

          const res = await fetch('/api/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include', // Ensure session cookie is sent for auth
              body: JSON.stringify({
                idempotencyKey,
                ...finalAnswers,
                // Fallback: send sessionId in body for mobile browsers that strip cookies
                sessionId: localStorage.getItem('session_token_fallback') || undefined,
              }),
          });
          
          const response = await res.json();
          
          if (!response.success) {
            setErrorMsg(response.message);
            setLoading(false);
            return;
          }
          
          console.log('Registration successful:', response.data);
          setIsCompleted(true);
      } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Network error. Please try again.');
      } finally {
          setLoading(false);
      }
  }, [answers, idempotencyKey, assignedProblem, setIsCompleted]);

  const handleNext = React.useCallback(async () => {
    // --- VALIDATIONS ---
    const q = currentQuestion;
    let ans = answers[q.id];

    // BuildStorm problem assignment: must have a problem before proceeding
    if (q.type === 'dynamic-problem') {
      if (problemLoading) {
        setErrorMsg("Please wait while your problem statement is being assigned...");
        return;
      }
      if (!assignedProblem) {
        setErrorMsg("Failed to assign problem statement. Please retry.");
        return;
      }
      // Problem assigned — proceed
      const nextStep = getNextValidStep(currentStep, 1, answers);
      if (nextStep < totalSteps) {
        setDirection(1);
        setCurrentStep(nextStep);
        setErrorMsg("");
      } else {
        await submitForm();
      }
      return;
    }

    // Trim string values before validation
    if (typeof ans === 'string') {
        ans = ans.trim();
        // Store trimmed value back
        setAnswers((prev: Answers) => ({ ...prev, [q.id]: ans }));
    }

    // 1. Required Field Check (catches empty + whitespace-only)
    if (q.required) {
        if (!ans || (typeof ans === 'string' && ans.trim().length === 0)) {
            setErrorMsg("Field Required.");
            return;
        }
        if (Array.isArray(ans) && ans.length === 0) {
            setErrorMsg("Field Required.");
            return;
        }
    }

    // 2. Checkbox: Accept ALL
    if (q.type === 'checkbox' && q.required) {
        if (q.options && Array.isArray(ans) && ans.length !== q.options.length) {
            setErrorMsg("Must accept all conditions.");
            return;
        }
    }

    // 3. Phone Validation regex
    if (q.type === 'tel') {
        if (typeof ans !== 'string' || !/^[0-9]{10}$/.test(ans)) {
            setErrorMsg("Invalid Format: 10 Digits Required.");
            return;
        }
        // Block numbers starting with 0-5 (invalid Indian mobiles)
        if (/^[0-5]/.test(ans)) {
            setErrorMsg("Invalid mobile number. Must start with 6-9.");
            return;
        }
    }

    // 4. Email format check (proper regex)
    if (q.type === 'email' || q.id.includes('Email')) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (typeof ans !== 'string' || !emailRegex.test(ans.trim())) {
             setErrorMsg("Invalid Email Format. Enter a valid email (e.g. name@example.com).");
             return;
        }
    }

    // 5. URL validation for link fields
    if (q.type === 'url' && typeof ans === 'string' && ans.trim().length > 0) {
        const urlRegex = /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]$/;
        if (!urlRegex.test(ans.trim())) {
            setErrorMsg("Invalid URL. Must start with http:// or https://");
            return;
        }
    }

    // 6. Name fields: must contain at least one letter, no only-numbers/special-chars
    if ((q.id.includes('Name') && q.type === 'text') && typeof ans === 'string') {
        const trimmed = ans.trim();
        if (trimmed.length < 2) {
            setErrorMsg("Name must be at least 2 characters.");
            return;
        }
        if (!/[a-zA-Z]/.test(trimmed)) {
            setErrorMsg("Name must contain at least one letter.");
            return;
        }
        if (/[^a-zA-Z\s.''-]/.test(trimmed)) {
            setErrorMsg("Name can only contain letters, spaces, dots, and hyphens.");
            return;
        }
    }

    // 7. Team name: min 2 chars, no whitespace-only
    if (q.id === 'teamName' && typeof ans === 'string') {
        const trimmed = ans.trim();
        if (trimmed.length < 2) {
            setErrorMsg("Team name must be at least 2 characters.");
            return;
        }
    }

    // 8. Long text fields: min length for required ones
    if (q.type === 'long-text' && q.required && typeof ans === 'string') {
        const trimmed = ans.trim();
        if (trimmed.length < 10) {
            setErrorMsg("Response too short. Please provide at least 10 characters.");
            return;
        }
    }

    // 9. Idea title min length
    if (q.id === 'ideaTitle' && typeof ans === 'string') {
        const trimmed = ans.trim();
        if (trimmed.length < 3) {
            setErrorMsg("Idea title must be at least 3 characters.");
            return;
        }
    }

    // OTP Logic
    if (currentQuestion.id === 'leaderEmail' && !emailVerified) {
        await sendOtp();
        return;
    }

    const nextStep = getNextValidStep(currentStep, 1, answers);
    
    if (nextStep < totalSteps) {
      setDirection(1);
      setCurrentStep(nextStep);
      setErrorMsg(""); 
    } else {
      await submitForm();
    }
  }, [currentQuestion, answers, emailVerified, currentStep, totalSteps, sendOtp, submitForm, getNextValidStep, assignedProblem, problemLoading]);

  const verifyOtp = React.useCallback(async () => {
      setLoading(true);
      setErrorMsg("");
      
      try {
          const res = await fetch('/api/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include', // Required for Set-Cookie to work on mobile browsers
              body: JSON.stringify({ 
                email: answers.leaderEmail, 
                otp: otpValue,
                purpose: 'REGISTRATION'
              }),
          });
          
          const response = await res.json();
          
          if (!response.success) {
            setErrorMsg(response.message);
            setLoading(false);
            return;
          }
          
          // Session is now stored in HttpOnly cookie by server
          if (response.data?.user) {
            // Only store non-sensitive user info for UI purposes
            localStorage.setItem('user_email', response.data.user.email);
            console.log('OTP verified successfully for:', response.data.user.email);
          }
          // Store session token as fallback for mobile browsers that may ignore Set-Cookie
          if (response.data?.sessionId) {
            localStorage.setItem('session_token_fallback', response.data.sessionId);
            
            // Transfer anonymous reservation to authenticated session
            const anonymousId = localStorage.getItem('anonymous_id');
            if (anonymousId) {
              // Always clean up anonymous ID — whether transfer succeeds or fails,
              // the authenticated session should be used going forward.
              localStorage.removeItem('anonymous_id');
              try {
                const transferRes = await fetch('/api/transfer-reservation', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    anonymousId,
                    sessionId: response.data.sessionId,
                  }),
                });
                const transferData = await transferRes.json();

                // If anonymous reservation expired (race condition),
                // re-reserve using the authenticated session
                if (transferData.needsReReservation) {
                  console.log('Anonymous reservation expired, re-reserving with authenticated session');
                  fetchAssignedProblem();
                }
              } catch (err) {
                console.error('Failed to transfer reservation:', err);
                // Re-reserve using authenticated session as fallback
                fetchAssignedProblem();
              }
            }
          }
          
          setEmailVerified(true);
          setVerifiedEmail(answers.leaderEmail as string); // Store verified email
          setShowOtpInput(false);
          setTimeout(() => {
             const nextStep = getNextValidStep(currentStep, 1, answers);
             setDirection(1);
             setCurrentStep(nextStep);
          }, 500);
      } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'Network error. Please try again.');
      } finally {
          setLoading(false);
      }
  }, [otpValue, currentStep, answers, getNextValidStep, fetchAssignedProblem]);

  const resetVerification = React.useCallback(async () => {
    // Clear verification state
    setEmailVerified(false);
    setVerifiedEmail(null);
    setShowOtpInput(false);
    setOtpValue("");
    setErrorMsg("");
    setShowChangeEmailWarning(false);
    
    // Clear the email answer to force re-entry
    setAnswers((prev: Answers) => ({ ...prev, leaderEmail: '' }));
    
    // Invalidate session cookie by calling logout endpoint
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('user_email');
      localStorage.removeItem('session_token_fallback');
      localStorage.removeItem('anonymous_id');
    } catch (err) {
      console.error('Failed to invalidate session:', err);
    }
  }, []);

  const handleChangeEmailClick = React.useCallback(() => {
    setShowChangeEmailWarning(true);
  }, []);

  const handleCancelChangeEmail = React.useCallback(() => {
    setShowChangeEmailWarning(false);
  }, []);

  const handlePrev = () => {
    if (showOtpInput) { setShowOtpInput(false); return; }
    const prevStep = getNextValidStep(currentStep, -1, answers);
    if (prevStep >= 0) { setDirection(-1); setCurrentStep(prevStep); setErrorMsg(""); }
  };
  const handleAnswer = (value: string | string[]) => { setAnswers((prev: Answers) => ({ ...prev, [QUESTIONS[currentStep].id]: value })); setErrorMsg(""); };
  const handleCheckbox = (option: string) => {
     const currentVals = (answers[currentQuestion.id] as string[]) || [];
     let newVals: string[];
     if (currentVals.includes(option)) newVals = currentVals.filter((v: string) => v !== option);
     else newVals = [...currentVals, option];
     handleAnswer(newVals);
  };

  // Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && started && !isCompleted && !loading) {
        if (showOtpInput) { if (otpValue.length === 6) verifyOtp(); return; }
        if (currentQuestion.type !== 'long-text' && currentQuestion.type !== 'checkbox' && !e.metaKey && !e.ctrlKey) { 
           e.preventDefault();
           if (currentQuestion.required && !answers[currentQuestion.id]) return;
           handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, isCompleted, currentStep, answers, currentQuestion, showOtpInput, otpValue, loading, handleNext, verifyOtp]);


  if (!started) return <WelcomeScreen onStart={handleStart} />;
  if (isCompleted) return <ThankYouScreen track={typeof answers.track === 'string' ? answers.track : ''} />;

  // FOLDER THEME UI
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-slate-100 font-mono p-4">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#3f3f46_1px,transparent_1px),linear-gradient(to_bottom,#3f3f46_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Main Folder Container */}
      <div className="w-full max-w-6xl relative z-10 flex flex-col">
          
          {/* Tabs */}
          <div className="flex pl-8">
              <div className="bg-slate-800 text-orange-500 text-xs font-bold px-6 py-2 rounded-t-lg border-t border-l border-r border-slate-700 tracking-widest uppercase flex items-center gap-2">
                 <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                 Registration Protocol
              </div>
              <div className="bg-slate-900/50 text-slate-600 text-xs font-bold px-6 py-2 rounded-t-lg border-t border-r border-slate-800 tracking-widest uppercase ml-[-1px] z-[-1]">
                 Classified // V.2.0
              </div>
          </div>

          {/* Folder Body */}
          <div className="bg-slate-800 border-2 border-slate-700 rounded-b-lg rounded-tr-lg p-1 shadow-2xl relative min-h-[500px] md:min-h-[600px] flex flex-col">
              {/* Inner 'Paper' or Interface */}
              <div className="bg-slate-900 flex-1 rounded border border-slate-700/50 p-6 md:p-12 relative overflow-hidden flex flex-col">
                 
                 {/* Decor elements */}
                 <div className="absolute top-4 right-4 text-[10px] text-slate-600 font-mono tracking-widest">
                     DOC_ID: {Math.floor(Date.now() / 1000)}
                 </div>
                 <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 font-mono tracking-widest">
                      SECURE CONNECTION ESTABLISHED
                 </div>

                 <AnimatePresence mode="wait" custom={direction}>
                    {!showOtpInput ? (
                       <motion.div
                         key={currentStep}
                         custom={direction}
                         initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
                         transition={{ duration: 0.2 }}
                         className="flex-1 flex flex-col justify-center"
                       >
                           <div className="flex items-center gap-2 mb-6">
                               <span className="text-orange-500 font-bold text-sm bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                   STEP {visibleStepIndex} / {visibleSteps}
                               </span>
                               {currentQuestion.required && <span className="text-red-500 text-xs uppercase tracking-wider">* Mandatory</span>}
                           </div>

                           <h2 className="text-2xl md:text-4xl font-bold mb-2 uppercase tracking-tight text-slate-100">
                               {currentQuestion.question}
                           </h2>
                           
                           {currentQuestion.subtext && (
                               <p className="text-slate-400 text-sm md:text-base mb-8 border-l-2 border-slate-700 pl-4 py-1 italic">
                                   {currentQuestion.subtext}
                               </p>
                           )}

                           <div className="mt-4 mb-8">
                               <InputRenderer 
                                    question={currentQuestion} 
                                    value={answers[currentQuestion.id]} 
                                    onChange={handleAnswer} 
                                    onCheckbox={handleCheckbox}
                                    answers={answers}
                                    emailVerified={emailVerified}
                                    verifiedEmail={verifiedEmail}
                                    onResetVerification={resetVerification}
                                    showChangeEmailWarning={showChangeEmailWarning}
                                    onChangeEmailClick={handleChangeEmailClick}
                                    onCancelChangeEmail={handleCancelChangeEmail}
                                    assignedProblem={assignedProblem}
                                    problemLoading={problemLoading}
                                    problemError={problemError}
                                    fetchAssignedProblem={fetchAssignedProblem}
                               />
                           </div>
                           
                           {errorMsg && (
                               <div className="bg-red-900/20 border-l-2 border-red-500 text-red-400 p-3 mb-6 text-sm font-bold flex items-center gap-2">
                                   <span>[ERROR]</span> {errorMsg}
                               </div>
                           )}

                           <div className="mt-auto flex items-center gap-4">
                               <button 
                                  onClick={handleNext}
                                  className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold uppercase tracking-widest px-8 py-3 clip-path-polygon disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                  disabled={loading}
                               >
                                  {loading ? "PROCESSING..." : "CONFIRM DATA >>"}
                               </button>
                               {currentStep > 0 && (
                                   <button onClick={handlePrev} className="text-slate-500 hover:text-slate-300 text-sm uppercase tracking-wider">
                                       [ BACK ]
                                   </button>
                               )}
                           </div>
                       </motion.div>
                    ) : (
                       <motion.div
                          key="otp"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex-1 flex flex-col justify-center items-center text-center"
                       >
                           <div className="w-16 h-16 border-2 border-orange-500 rounded-full flex items-center justify-center mb-6 animate-pulse text-orange-500">
                               <div className="w-2 h-2 bg-orange-500 rounded-full" />
                           </div>
                           <h2 className="text-2xl font-bold uppercase tracking-widest mb-2">Identity Verification</h2>
                           <p className="text-slate-400 text-sm mb-8">TRANSMITTED KEY TO: {answers.leaderEmail}</p>

                           <input
                            type="text"
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g,''); if(v.length<=6) setOtpValue(v); }}
                            className="bg-slate-950 border-b-2 border-orange-500 w-48 text-center text-3xl tracking-[0.5em] font-mono text-white p-2 focus:outline-none mb-6"
                            placeholder="______"
                           />
                           
                           {errorMsg && <p className="text-red-500 text-xs font-bold mb-4">{errorMsg}</p>}

                           <button 
                                onClick={verifyOtp} 
                                className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 py-2 text-sm uppercase tracking-widest disabled:opacity-50"
                                disabled={otpValue.length !== 6 || loading}
                           >
                               {loading ? "VERIFYING..." : "AUTHENTICATE"}
                           </button>
                       </motion.div>
                    )}
                 </AnimatePresence>

              </div>
          </div>
      </div>
    </div>
  );
}
