// Admin Root Layout — passthrough wrapper
// Auth guard is in (dashboard)/layout.tsx so /admin/login is public

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IndiaNext Admin',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
