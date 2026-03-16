import { TRPCProvider } from '@/components/providers/TRPCProvider';
import { Toaster } from 'sonner';

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      {children}
      <Toaster position="top-right" richColors />
    </TRPCProvider>
  );
}
