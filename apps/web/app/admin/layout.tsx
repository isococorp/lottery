import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") redirect("/dashboard");
  if (user.mustChangePassword) redirect("/login/change-password");

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <h2 className="mr-4 text-lg font-semibold text-gold-light">Admin Panel</h2>
        <nav className="flex gap-1 text-sm">
          {[
            { href: "/admin", label: "หน้าหลัก" },
            { href: "/admin/users", label: "จัดการสมาชิก" },
            { href: "/admin/draws", label: "ข้อมูลงวดหวย" },
            { href: "/admin/logs", label: "Audit Logs" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-gold-light"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-xs text-white/40">
          {user.displayName} ({user.role})
        </div>
      </div>
      {children}
    </AppShell>
  );
}
