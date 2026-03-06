"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, AlertTriangle, Eye, EyeOff, Terminal, ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Theme colors (matching landing page)
const CYAN = "#00CCFF";
const ORANGE = "#FF6600";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before running animations
  useEffect(() => {
    setMounted(true);
  }, []);

  // Boot sequence animation (only runs after mount)
  useEffect(() => {
    if (!mounted) return;

    const lines = [
      "[SYS] Initializing admin terminal...",
      "[NET] Establishing secure connection...",
      "[AUTH] Loading authentication module...",
      "[SEC] CSRF protection: ACTIVE",
      "[SEC] Rate limiting: ACTIVE",
      "[SYS] Admin console ready.",
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < lines.length) {
        const currentLine = lines[index];
        setBootLines((prev) => [...prev, currentLine]);
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => setBootComplete(true), 400);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [mounted]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 429) {
            setError("Too many attempts. Please wait before trying again.");
          } else {
            setError(data.message || "Invalid credentials.");
          }
          return;
        }

        // Success — redirect based on role
        if (data.user?.role === "LOGISTICS") {
          window.location.href = "/admin/logistics";
        } else {
          window.location.href = "/admin";
        }
      } catch {
        setError("Connection failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, password]
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden relative">
      {/* Prevent hydration mismatch - only render after mount */}
      {!mounted ? (
        // Server-side placeholder
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="relative bg-[#0A0A0A] border border-white/[0.06] rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-widest font-bold">
                    SECURE_AUTH_TERMINAL
                  </span>
                </div>
                <Shield size={14} className="text-orange-500/50" />
              </div>
              <div className="p-6 md:p-8">
                <div className="h-64 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-orange-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Client-side content
        <>
          {/* Background grid */}
          <div className="fixed inset-0 z-0">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `
              linear-gradient(rgba(255,102,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,102,0,0.3) 1px, transparent 1px)
            `,
                backgroundSize: "60px 60px",
              }}
            />
            {/* Radial glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
              style={{
                background: `radial-gradient(circle, ${ORANGE}15 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
              style={{
                background: `radial-gradient(circle, ${CYAN}20 0%, transparent 70%)`,
              }}
            />
          </div>

          {/* Scanlines */}
          <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
          <div className="fixed inset-0 pointer-events-none z-[60] opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />

          {/* Content */}
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 flex flex-col items-center"
        >
          <Link href="/" className="flex items-center gap-3 group mb-6">
            <motion.div
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.6, ease: "anticipate" }}
              className="relative w-10 h-10 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-cyan-400 to-green-500 rounded-lg opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
              <div className="relative w-full h-full border border-white/20 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1">
                <Image
                  src="/logo-new.png"
                  alt="IndiaNext Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
            </motion.div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter leading-none">
                INDIA<span className="text-orange-500">NEXT</span>
              </span>
              <span className="text-[0.55rem] text-gray-500 tracking-[0.4em] font-mono font-bold">
                ADMIN_CONSOLE
              </span>
            </div>
          </Link>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="relative group">
            {/* Glow border */}
            <div className="absolute -inset-[1px] bg-gradient-to-b from-orange-500/30 via-white/5 to-cyan-500/20 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative bg-[#0A0A0A] border border-white/[0.06] rounded-lg overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-gray-500 tracking-widest font-bold">
                    SECURE_AUTH_TERMINAL
                  </span>
                </div>
                <Shield size={14} className="text-orange-500/50" />
              </div>

              {/* Boot Sequence */}
              <AnimatePresence>
                {!bootComplete && (
                  <motion.div
                    initial={{ height: "auto" }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 font-mono text-[11px] space-y-1 border-b border-white/[0.06] bg-black/40">
                      {bootLines.map((line, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                          className={
                            line.includes("[SEC]")
                              ? "text-green-400/80"
                              : line.includes("[SYS]")
                              ? "text-cyan-400/80"
                              : "text-gray-500"
                          }
                        >
                          {line}
                        </motion.div>
                      ))}
                      {!bootComplete && bootLines.length < 6 && (
                        <span className="inline-block w-2 h-3.5 bg-orange-500/80 animate-pulse" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Terminal size={14} className="text-orange-500" />
                    <h1 className="text-sm font-mono font-bold text-white tracking-wider">
                      ADMIN LOGIN
                    </h1>
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 mt-1">
                    Authorized personnel only. All access is logged.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400 uppercase">
                      Email Address
                    </label>
                    <div className="relative group/input">
                      <div className="absolute -inset-[1px] bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0 rounded opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@indianext.in"
                        required
                        autoComplete="email"
                        className="relative w-full bg-white/[0.03] border border-white/[0.08] rounded px-4 py-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono font-bold tracking-[0.2em] text-gray-400 uppercase">
                      Password
                    </label>
                    <div className="relative group/input">
                      <div className="absolute -inset-[1px] bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0 rounded opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        className="relative w-full bg-white/[0.03] border border-white/[0.08] rounded px-4 py-3 pr-12 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-red-500/10 border border-red-500/20">
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                          <span className="text-[11px] font-mono text-red-400">
                            {error}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={loading || !email || !password}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="relative w-full group/btn overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 opacity-90 group-hover/btn:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-cyan-500 opacity-0 group-hover/btn:opacity-20 transition-opacity duration-500" />
                    <div className="relative flex items-center justify-center gap-2 px-6 py-3 text-sm font-mono font-bold tracking-wider text-white">
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>AUTHENTICATING...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={14} />
                          <span>ACCESS SYSTEM</span>
                          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </motion.button>
                </form>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-mono text-gray-500">
                        ENCRYPTED CONNECTION
                      </span>
                    </div>
                    <Link
                      href="/"
                      className="text-[10px] font-mono text-gray-500 hover:text-orange-400 transition-colors tracking-wider"
                    >
                      ← MAIN SITE
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-6 text-center"
          >
            <p className="text-[9px] font-mono text-gray-600 tracking-[0.3em] uppercase">
              Protected by rate limiting &bull; CSRF validation &bull; Session encryption
            </p>
          </motion.div>
        </motion.div>
      </div>
        </>
      )}
    </div>
  );
}
