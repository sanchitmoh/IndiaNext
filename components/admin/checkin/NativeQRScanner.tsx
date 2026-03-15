'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface NativeQRScannerProps {
  onScanSuccess: (result: string) => void;
  isActive: boolean;
}

export function NativeQRScanner({ onScanSuccess, isActive }: NativeQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startQRDetection = useCallback(() => {
    if (!('BarcodeDetector' in window)) {
      console.warn('BarcodeDetector not supported, QR detection disabled');
      return;
    }

    // @ts-expect-error BarcodeDetector is not yet in TS types
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    const detectQR = async () => {
      if (!videoRef.current || !canvasRef.current || !isActive) return;

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx || video.readyState < 2) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Detect QR codes
        const barcodes = await detector.detect(canvas);
        
        if (barcodes.length > 0) {
          const qrCode = barcodes[0].rawValue;
          if (qrCode) {
            onScanSuccess(qrCode);
          }
        }
      } catch (error) {
        // Silent fail for detection errors
        console.debug('QR detection error:', error);
      }
    };

    // Run detection every 500ms
    scanIntervalRef.current = setInterval(detectQR, 500);
  }, [onScanSuccess, isActive]);

  const startCamera = useCallback(async () => {
    try {
      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please use HTTPS or localhost.');
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        setCameraError(null);
        
        // Start QR code detection
        startQRDetection();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      let errorMsg = 'Camera access failed';
      
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied. Please allow camera access and refresh.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No camera found on this device.';
      } else if (err.name === 'NotSupportedError') {
        errorMsg = 'Camera not supported. Please use HTTPS or localhost.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setCameraError(errorMsg);
      toast.error(errorMsg);
    }
  }, [startQRDetection]);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  if (cameraError) {
    return (
      <div className="text-center p-10 space-y-6 max-w-sm mx-auto">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-white font-bold text-lg tracking-tight">Camera_Error</h2>
          <p className="text-zinc-500 text-xs leading-relaxed">
            {cameraError}
          </p>
        </div>
        <button
          onClick={() => {
            setCameraError(null);
            startCamera();
          }}
          className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:scale-95 rounded-2xl text-[10px] text-white font-black tracking-[0.3em] uppercase transition-all shadow-xl shadow-orange-900/20"
        >
          Retry_Camera
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* Hidden canvas for QR detection */}
      <canvas
        ref={canvasRef}
        className="hidden"
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
          {isScanning && (
            <motion.div
              animate={{ 
                top: ['5%', '95%', '5%'],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-4 right-4 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(255,102,0,0.8)] z-20"
            />
          )}
          
          {/* Clean cutout effect */}
          <div className="absolute inset-0 border-2 border-white/5 rounded-2xl" />
        </div>

        <div className="mt-12 text-center space-y-4 px-6">
          <p className="text-[10px] font-black text-white/50 tracking-[0.4em] uppercase">
            {isScanning ? 'Align_QR_Code_In_Frame' : 'Initializing_Camera...'}
          </p>
          <div className="h-0.5 w-6 bg-orange-500/20 mx-auto rounded-full" />
        </div>
      </div>
    </div>
  );
}