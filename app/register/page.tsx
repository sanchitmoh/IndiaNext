import { X, Calendar, Clock, AlertTriangle, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Register() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.05),transparent_60%)]" />
        
        <div className="relative z-10">
          {/* Icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-red-500 to-gray-500 rounded-full blur opacity-30"></div>
              <div className="relative w-24 h-24 bg-[#0a0a0a] border border-red-500/30 rounded-full flex items-center justify-center">
                <X className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
            <span className="text-red-500">Registration</span>
            <br />
            <span className="text-white">Closed</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-400 font-mono tracking-wider mb-8 uppercase">
            ACCESS_DENIED_V1
          </p>

          {/* Message */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <span className="text-red-400 font-mono text-sm tracking-widest uppercase font-bold">
                Registration Period Ended
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed">
              Thank you for your interest in IndiaNext 2026. The registration period has officially closed. 
              We received an overwhelming response from talented participants across the country.
            </p>
          </div>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-500 font-mono uppercase">Event Date</span>
              </div>
              <div className="text-lg font-bold text-white">March 16, 2026</div>
              <div className="text-xs text-gray-600">Mumbai, India</div>
            </div>

            <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-500 font-mono uppercase">Status</span>
              </div>
              <div className="text-lg font-bold text-red-400">Registration Closed</div>
              <div className="text-xs text-gray-600">Preparing for event</div>
            </div>
          </div>

          {/* Contact Info & Login Link */}
          <div className="text-center space-y-4">
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Users className="w-6 h-6 text-cyan-400" />
                <span className="text-cyan-400 font-mono text-sm tracking-widest uppercase font-bold">
                  Already Registered?
                </span>
              </div>
              <p className="text-gray-300 leading-relaxed mb-4">
                If you&apos;re already registered, you can still access your team dashboard to modify team members or add additional members.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-3 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-mono text-sm font-bold tracking-widest uppercase rounded-md transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
              >
                <Users className="w-4 h-4" />
                ACCESS TEAM DASHBOARD
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 font-mono mb-2">
                For other inquiries, contact the organizing team
              </p>
              <p className="text-xs text-gray-600 font-mono tracking-widest">
                K.E.S. SHROFF COLLEGE OF ARTS & COMMERCE
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
