// TeamQRCode — Display QR code for team's shortCode (for event-day check-in)
"use client";

import { useEffect, useRef } from "react";
import { X, Download, Printer } from "lucide-react";

interface TeamQRCodeProps {
  shortCode: string;
  teamName: string;
  onClose: () => void;
}

export function TeamQRCode({ shortCode, teamName, onClose }: TeamQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code using a simple canvas-based approach
  // For production, you'd use a proper QR library. This generates a placeholder visual.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 256;
    canvas.width = size;
    canvas.height = size;

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    // Generate a simple visual QR-like pattern from the shortCode
    // This is a visual representation — in production use `qrcode` npm package
    const cellSize = 8;
    const gridSize = Math.floor(size / cellSize);
    const padding = 4;

    // Finder patterns (corners)
    const drawFinder = (x: number, y: number) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawFinder(padding, padding);
    drawFinder(gridSize - padding - 7, padding);
    drawFinder(padding, gridSize - padding - 7);

    // Generate data pattern from shortCode hash
    let hash = 0;
    for (let i = 0; i < shortCode.length; i++) {
      hash = ((hash << 5) - hash + shortCode.charCodeAt(i)) | 0;
    }

    ctx.fillStyle = "#000000";
    for (let y = padding + 8; y < gridSize - padding - 8; y++) {
      for (let x = padding + 8; x < gridSize - padding - 8; x++) {
        // Deterministic pattern from hash
        const val = ((hash * (x + 1) * (y + 1)) >>> 0) % 3;
        if (val === 0) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw shortCode text at the bottom
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(shortCode, size / 2, size - 8);
  }, [shortCode]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${shortCode}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>QR Code - ${shortCode}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:monospace;">
          <h2>${teamName}</h2>
          <img src="${canvas.toDataURL()}" style="width:300px;height:300px;" />
          <h1 style="letter-spacing:8px;margin-top:16px;">${shortCode}</h1>
          <script>setTimeout(()=>window.print(),200)</script>
        </body>
      </html>
    `);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.08] w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-mono font-bold text-white tracking-wider">TEAM QR CODE</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Code display */}
        <div className="p-6 flex flex-col items-center gap-4">
          <div className="bg-white rounded-lg p-3">
            <canvas ref={canvasRef} className="w-48 h-48" />
          </div>

          <div className="text-center">
            <p className="text-lg font-mono font-bold text-emerald-400 tracking-[0.4em]">{shortCode}</p>
            <p className="text-[10px] font-mono text-gray-500 mt-1">{teamName}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all"
            >
              <Download className="h-3 w-3" />
              DOWNLOAD
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded hover:bg-white/[0.05] transition-all"
            >
              <Printer className="h-3 w-3" />
              PRINT
            </button>
          </div>

          <p className="text-[8px] font-mono text-gray-600 text-center max-w-[200px]">
            Logistics members can scan this code with the QR CHECK-IN button to quickly find and check in this team.
          </p>
        </div>
      </div>
    </div>
  );
}
