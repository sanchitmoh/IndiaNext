// Admin Dashboard Layout — Protected with auth guard + sidebar
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { checkAdminAuth } from "@/lib/auth";
import { TRPCProvider } from "@/components/providers/TRPCProvider";
import { AdminRoleProvider } from "@/components/admin/AdminRoleContext";
import { Toaster } from "sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await checkAdminAuth();

  if (!admin) {
    redirect("/admin/login");
  }

  // Only pass serializable fields needed by client components
  const safeAdmin = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };

  return (
    <TRPCProvider>
      <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 relative">
        {/* Background grid */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,102,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,102,0,0.3) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>
        {/* Scanlines */}
        <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />

        <AdminShell user={safeAdmin}>
          <AdminRoleProvider role={safeAdmin.role}>
            {children}
          </AdminRoleProvider>
        </AdminShell>
      </div>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#fff",
          },
        }}
      />
    </TRPCProvider>
  );
}
