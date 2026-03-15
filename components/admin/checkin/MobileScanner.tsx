'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Wifi, WifiOff, CheckCircle2, LogOut, Loader2 } from 'lucide-react';
import { useAdminRole } from '../AdminRoleContext';
import { QRScannerErrorBoundary } from './QRScannerErrorBoundary';
import { ClientOnlyWrapper } from './ClientOnlyWrapper';
import { NativeQRScanner } from './NativeQRScanner';

function MobileScannerContent() {
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

  const lastScanMap = useRef<Map<string, number>>(new Map());
  const _readerRef = useRef<HTMLDivElement>(null);

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

  const lastHeartbeat = useRef<number>(0);
  const heartbeatMutation = useRef(heartbeat);
  heartbeatMutation.current = heartbeat;

  // Heartbeat to keep dashboard updated on scanner presence
  useEffect(() => {
    if (!deskId) return;

    const sendHeartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeat.current < 25000) return; // Force min 25s gap

      lastHeartbeat.current = now;
      heartbeatMutation.current.mutate({ deskId }, {
        onSuccess: () => console.debug(`[Heartbeat] Sent for station ${deskId}`),
        onError: (err) => console.error(`[Heartbeat] Failed:`, err.message)
      });
    };

    // Initial heartbeat
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 30000); // Heartbeat every 30s

    return () => clearInterval(interval);
  }, [deskId]);

  // Initialize connection when desk is selected
  useEffect(() => {
    if (deskId) {
      setIsConnected(true);
      setIsScanning(true);
    }
  }, [deskId]);

  const selectDesk = (id: string) => {
    if (contextDesk) return;
    setDeskId(id);
    localStorage.setItem('admin_checkin_desk', id);
  };

  const lastGlobalScanTime = useRef<number>(0);

  const onScanSuccess = async (decodedText: string) => {
    if (!deskId || isLoading) return;

    const now = Date.now();
    // Global throttling: Max 1 scan attempt every 2 seconds
    if (now - lastGlobalScanTime.current < 2000) return;
    lastGlobalScanTime.current = now;

    // Extract shortCode for display purposes
    let shortCode = decodedText;
    try {
      if (decodedText.includes('code=')) {
        const url = new URL(decodedText);
        shortCode = url.searchParams.get('code') || decodedText;
      }
    } catch (err) {
      console.warn('URL parsing failed during scan:', err);
    }

    // Per-code 10s cooldown
    const lastTime = lastScanMap.current.get(shortCode) || 0;
    if (now - lastTime < 10000) return;

    lastScanMap.current.set(shortCode, now);
    setLastScanned(shortCode);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    try {
      setIsLoading(true);
      console.log(`[Scanner] Processing code: ${shortCode} for station: ${deskId}`);
      
      // Encode the full QR payload as base64 for secure transmission
      const qrPayload = btoa(decodedText);
      
      await utils.admin.getTeamByShortCode.fetch({
        qrPayload,
        deskId: deskId || '',
      });
      console.log(`[Scanner] SUCCESSFULLY sent ${shortCode} to dashboard`);
      toast.success(`Team ${shortCode} sent to Dashboard`);
    } catch (error: any) {
      console.error(`[Scanner] FAILED to process ${shortCode}:`, error.message);
      toast.error(error.message || 'Failed to process QR code');
    } finally {
      setIsLoading(false);
    }
  };

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
        <ClientOnlyWrapper
          fallback={
            <div className="text-center p-10 space-y-6 max-w-sm">
              <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/20">
                <Camera className="h-10 w-10 text-orange-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-white font-bold text-lg tracking-tight">Initializing_Scanner</h2>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Setting up camera access for QR code scanning...
                </p>
              </div>
            </div>
          }
        >
          <NativeQRScanner
            onScanSuccess={onScanSuccess}
            isActive={!!deskId && !isLoading}
          />

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
        </ClientOnlyWrapper>
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

export default function MobileScanner() {
  return (
    <QRScannerErrorBoundary>
      <MobileScannerContent />
    </QRScannerErrorBoundary>
  );
}
