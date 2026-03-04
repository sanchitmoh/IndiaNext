// QR Scanner Modal — Scan team shortCode QR for quick check-in
// Uses browser getUserMedia camera API → pattern match shortCode
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { X, Camera, CameraOff, Keyboard, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QRScannerModalProps {
  onClose: () => void;
  onResult: (teamId: string) => void;
}

export function QRScannerModal({ onClose, onResult }: QRScannerModalProps) {
  const [mode, setMode] = useState<"camera" | "manual">("manual");
  const [shortCode, setShortCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [lookupPending, setLookupPending] = useState(false);

  const utils = trpc.useUtils();

  const handleLookup = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setLookupPending(true);
      try {
        const result = await utils.logistics.getTeamByShortCode.fetch({ shortCode: code.trim().toUpperCase() });
        toast.success(`Found: ${result.name}`);
        onResult(result.id);
      } catch {
        toast.error("Team not found — check the code and try again");
      } finally {
        setLookupPending(false);
      }
    },
    [utils, onResult]
  );

  // Start camera
  useEffect(() => {
    if (mode !== "camera") return;

    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
        }
      } catch (err) {
        setCameraError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera permissions."
            : "Camera not available. Use manual entry."
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setScanning(false);
    };
  }, [mode]);

  // Simple barcode detection using BarcodeDetector API if available
  useEffect(() => {
    if (!scanning || mode !== "camera") return;

    let active = true;

    async function detectQR() {
      // Check if BarcodeDetector is available
      if (!("BarcodeDetector" in window)) {
        setCameraError("QR scanning not supported in this browser. Use manual entry.");
        return;
      }

      try {
        // @ts-expect-error BarcodeDetector is not yet in TS types
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        
        const scan = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) {
            if (active) requestAnimationFrame(scan);
            return;
          }

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue;
              if (value) {
                // Extract shortCode from QR (could be just the code or a URL containing it)
                const codeMatch = value.match(/([A-Z0-9]{6,10})/i);
                if (codeMatch) {
                  handleLookup(codeMatch[1]);
                  return; // Stop scanning after finding
                }
              }
            }
          } catch {
            // Detection failed, continue scanning
          }

          if (active) {
            setTimeout(() => requestAnimationFrame(scan), 200); // Scan every 200ms
          }
        };

        requestAnimationFrame(scan);
      } catch {
        setCameraError("QR detection failed. Use manual entry.");
      }
    }

    detectQR();

    return () => {
      active = false;
    };
  }, [scanning, mode, handleLookup]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.08] w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-mono font-bold text-white tracking-wider">QR CHECK-IN</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-mono font-bold tracking-wider transition-all ${
              mode === "manual"
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            MANUAL ENTRY
          </button>
          <button
            onClick={() => {
              setCameraError("");
              setMode("camera");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-mono font-bold tracking-wider transition-all ${
              mode === "camera"
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            SCAN QR
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === "manual" ? (
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-gray-500 tracking-wider">
                Enter the team&apos;s short code to find and check them in:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(shortCode)}
                  placeholder="TEAM CODE (e.g. ABC123)"
                  className="flex-1 px-3 py-2.5 text-sm font-mono bg-white/[0.02] border border-white/[0.06] rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 tracking-widest text-center uppercase"
                  autoFocus
                  maxLength={10}
                />
                <button
                  onClick={() => handleLookup(shortCode)}
                  disabled={!shortCode.trim() || lookupPending}
                  className="px-4 py-2.5 text-[10px] font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lookupPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cameraError ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CameraOff className="h-8 w-8 text-red-400" />
                  <p className="text-[10px] font-mono text-red-400 text-center max-w-[250px]">
                    {cameraError}
                  </p>
                  <button
                    onClick={() => setMode("manual")}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 tracking-wider"
                  >
                    SWITCH TO MANUAL →
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative rounded overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-emerald-400/50 rounded-lg">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                      </div>
                    </div>
                    {/* Scanning indicator */}
                    {scanning && (
                      <div className="absolute bottom-2 left-0 right-0 text-center">
                        <span className="text-[9px] font-mono text-emerald-400 bg-black/60 px-2 py-0.5 rounded">
                          SCANNING...
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-mono text-gray-600 text-center">
                    Point camera at team&apos;s QR code
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
