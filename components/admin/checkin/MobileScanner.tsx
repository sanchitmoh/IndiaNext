'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Wifi, WifiOff, CheckCircle2, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { useAdminRole } from '../AdminRoleContext';

export default function MobileScanner() {
  const { desk: contextDesk } = useAdminRole();
  const [deskId, setDeskId] = useState<string | null>(() => {
    if (contextDesk) return contextDesk;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_checkin_desk');
    }
    return null;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const lastScanMap = useRef<Map<string, number>>(new Map());

  // Initialize desk from context or localStorage
  useEffect(() => {
    if (contextDesk) {
      setDeskId(contextDesk);
    } else {
      const savedDesk =
        typeof window !== 'undefined' ? localStorage.getItem('admin_checkin_desk') : null;
      if (savedDesk) setDeskId(savedDesk);
    }
  }, [contextDesk]);

  const utils = trpc.useUtils();
  const heartbeat = trpc.admin.sendScannerHeartbeat.useMutation();

  // Heartbeat to keep dashboard updated on scanner presence
  useEffect(() => {
    if (!deskId) return;

    const interval = setInterval(() => {
      heartbeat.mutate({ deskId });
    }, 10000); // Heartbeat every 10s

    // Trigger immediate heartbeat on mount
    heartbeat.mutate({ deskId });

    return () => clearInterval(interval);
  }, [deskId, heartbeat]);

  useEffect(() => {
    if (!deskId) return;

    // Initialize scanner with library (not the scanner UI)
    const scanner = new Html5Qrcode('reader');
    html5QrCode.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 30,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          onScanSuccess,
          (errorMessage) => {
            // Quieter logs for background scanning failures
            if (process.env.NODE_ENV === 'development') {
              console.debug('QR Scan error:', errorMessage);
            }
          }
        );
        setIsScanning(true);
        setCameraError(null);
      } catch (err: any) {
        console.error('Camera Error:', err);
        setCameraError(err.message || 'Could not access camera');
        toast.error('Camera access denied');
      }
    };

    startScanner();
    setIsConnected(true);

    return () => {
      if (html5QrCode.current && html5QrCode.current.isScanning) {
        html5QrCode.current.stop().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskId]);

  const selectDesk = (id: string) => {
    if (contextDesk) return;
    setDeskId(id);
    localStorage.setItem('admin_checkin_desk', id);
  };

  async function onScanSuccess(decodedText: string) {
    if (!deskId || isLoading) return;

    let shortCode = decodedText;
    try {
      if (decodedText.includes('code=')) {
        const url = new URL(decodedText);
        shortCode = url.searchParams.get('code') || decodedText;
      }
    } catch (err) {
      console.warn('URL parsing failed during scan:', err);
    }

    // Per-code 5s cooldown
    const lastTime = lastScanMap.current.get(shortCode) || 0;
    const now = Date.now();
    if (now - lastTime < 5000) return;

    lastScanMap.current.set(shortCode, now);
    setLastScanned(shortCode);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    try {
      setIsLoading(true);
      await utils.admin.getTeamByShortCode.fetch({
        shortCode,
        deskId: deskId || '',
      });
      toast.success(`Team ${shortCode} sent to Dashboard`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to process QR code');
    } finally {
      setIsLoading(false);
    }
  }

  if (!deskId) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 font-mono">
        <div className="w-full max-w-xs space-y-8 text-center">
          <div className="space-y-2">
            <Camera className="h-12 w-12 text-orange-500 mx-auto" />
            <h1 className="text-xl font-bold text-white tracking-widest uppercase">Select_Desk</h1>
            <p className="text-zinc-500 text-[10px]">
              PLEASE BIND THIS DEVICE TO A CHECK-IN STATION
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(contextDesk ? [contextDesk] : ['A', 'B', 'C', 'D']).map((id) => (
              <button
                key={id}
                onClick={() => selectDesk(id)}
                className="py-8 rounded-2xl bg-zinc-900 border border-white/5 hover:border-orange-500 transition-all text-white group"
              >
                <div className="text-3xl font-black group-hover:text-orange-500 transition-colors">
                  {id}
                </div>
                <div className="text-[8px] text-zinc-600 mt-1 uppercase">Station</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-mono overflow-hidden">
      {/* Flash Animation */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="z-10 bg-black border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!contextDesk && (
            <button
              onClick={() => {
                localStorage.removeItem('admin_checkin_desk');
                setDeskId(null);
              }}
              className="p-2 bg-white/5 rounded-lg border border-white/10 active:scale-95 transition-all text-zinc-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-white font-bold tracking-tighter text-[10px] uppercase opacity-50">
              STATION_{deskId}
            </h1>
            <span className="text-orange-500 text-[8px] font-bold tracking-[0.2em]">
              LIVE_SCANNER
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Wifi className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">
                Linked
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400">
              <WifiOff className="h-2.5 w-2.5" />
              <span className="text-[8px] font-bold uppercase tracking-widest">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden">
        {cameraError ? (
          <div className="text-center p-10 space-y-6 max-w-sm">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-bold text-lg tracking-tight">Camera_Access_Required</h2>
              <p className="text-zinc-500 text-xs leading-relaxed">
                We need camera access to scan QR codes. Please ensure you have granted permission in your browser settings.
              </p>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 text-[10px] text-zinc-400 text-left space-y-2">
              <p className="font-bold text-zinc-300">Quick Fix:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Tap the lock icon in the URL bar</li>
                <li>Enable &quot;Camera&quot; permission</li>
                <li>Refresh the page</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:scale-95 rounded-2xl text-[10px] text-white font-black tracking-[0.3em] uppercase transition-all shadow-xl shadow-orange-900/20"
            >
              Retry_Initialization
            </button>
          </div>
        ) : (
          <>
            <div 
              id="reader" 
              className="w-full h-full [&>video]:object-cover [&_div]:!border-none [&_span]:!hidden [&_br]:!hidden" 
            />

            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Scan Box Frame */}
              <div className="relative w-64 h-64">
                {/* Glowing Corners */}
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-orange-500 rounded-tl-2xl shadow-[-5px_-5px_15px_rgba(255,102,0,0.5)]" />
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-orange-500 rounded-tr-2xl shadow-[5px_-5px_15px_rgba(255,102,0,0.5)]" />
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-orange-500 rounded-bl-2xl shadow-[-5px_5px_15px_rgba(255,102,0,0.5)]" />
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-orange-500 rounded-br-2xl shadow-[5px_5px_15px_rgba(255,102,0,0.5)]" />

                {/* Scanning Beam */}
                <motion.div
                  animate={{ 
                    top: ['5%', '95%', '5%'],
                    opacity: [0.6, 1, 0.6]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-4 right-4 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(255,102,0,0.8)] z-20"
                />
                
                {/* Clean cutout effect */}
                <div className="absolute inset-0 border-2 border-white/5 rounded-2xl" />
              </div>

              <div className="mt-12 text-center space-y-4 px-6">
                <p className="text-[10px] font-black text-white/50 tracking-[0.4em] uppercase">
                  Align_QR_Code_In_Frame
                </p>
                <div className="h-0.5 w-6 bg-orange-500/20 mx-auto rounded-full" />
              </div>
            </div>
          </>
        )}

        {/* Status Indicator */}
        <div className="absolute bottom-32 flex flex-col items-center gap-4 w-full pointer-events-none z-30">
          <AnimatePresence>
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900/90 border border-orange-500/30 rounded-full shadow-2xl"
              >
                <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                <span className="text-white text-[10px] font-bold tracking-[0.2em] uppercase">
                  Processing...
                </span>
              </motion.div>
            ) : (
              lastScanned && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 px-6 py-2.5 bg-zinc-900/90 border border-emerald-500/30 rounded-full shadow-2xl"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-white text-[11px] font-bold tracking-widest uppercase">
                    {lastScanned}
                  </span>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="z-10 bg-black/80 backdrop-blur-xl border-t border-white/5 p-6 pb-10">
        <div className="flex items-center justify-between opacity-40">
          <div className="space-y-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-zinc-500 text-center">
              Sensor_Status
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}
              />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">
                {isScanning ? 'Active' : 'Standby'}
              </span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Telemetry
            </p>
            <p className="text-white text-[9px] font-bold tracking-widest uppercase">
              Encryption_Enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
