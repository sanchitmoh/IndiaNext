import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AnimationProvider } from '@/lib/animations/context/AnimationProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IndiaNext | National-Level Hackathon 2026 | Mumbai',
  description:
    "Join IndiaNext — India's most advanced 24-hour hackathon at K.E.S. Shroff College, Mumbai. ₹1 Lakh+ prize pool, 100 elite teams, free entry. Register now!",
  keywords: [
    'hackathon',
    'IndiaNext',
    'coding',
    'Mumbai',
    'KES Shroff',
    'innovation',
    '2026',
    'college hackathon',
  ],
  authors: [{ name: 'IndiaNext Team' }],
  icons: {
    icon: '/logo-new.png',
    shortcut: '/logo-new.png',
    apple: '/logo-new.png',
  },
  openGraph: {
    title: 'IndiaNext | Outthink The Algorithm',
    description:
      '24-hour National-Level Hackathon at K.E.S. Shroff College, Mumbai. ₹1 Lakh+ prizes. 100 teams. Free entry.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'IndiaNext Hackathon',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IndiaNext | National-Level Hackathon 2026',
    description: '24-hour hackathon in Mumbai. ₹1 Lakh+ prizes. Register free!',
  },
  other: {
    'theme-color': '#050505',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AnimationProvider>{children}</AnimationProvider>
      </body>
    </html>
  );
}
