'use client';

import { useEffect, useState } from 'react';
import MobileScanner from '@/components/admin/checkin/MobileScanner';
import DesktopDashboard from '@/components/admin/checkin/DesktopDashboard';
import { Loader2 } from 'lucide-react';

export default function CheckInPage() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    // Basic mobile detection based on user-agent or screen width
    const checkIfMobile = () => {
      const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

      if (mobileRegex.test(userAgent) || window.innerWidth < 768) {
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  if (isMobile === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black font-mono">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-4" />
        <p className="text-zinc-500 text-[10px] tracking-[0.3em]">DETECTING_ENVIRONMENT...</p>
      </div>
    );
  }

  return isMobile ? <MobileScanner /> : <DesktopDashboard />;
}
