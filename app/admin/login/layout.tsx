// Login layout — force dynamic to ensure Vercel lambda resolution
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
