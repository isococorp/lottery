import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { UserNav } from "./UserNav";

/**
 * `wide` drops the 1024px reading-width cap and lets the page use the whole
 * viewport — for data-dense screens (เครื่องคำนวณ) whose tables would otherwise
 * need horizontal scrolling. Header, main and footer share one container class
 * so the nav stays aligned with the content in both modes.
 */
export async function AppShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const user = await getSessionUser();
  const container = wide ? "w-full px-4 sm:px-6" : "mx-auto max-w-5xl px-4";

  return (
    <>
      <div className="h-[3px] w-full bg-gold-grad" />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-deep/70 backdrop-blur-xl">
        <div className={`flex items-center justify-between py-3 ${container}`}>
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-grad text-navy shadow-gold">天</span>
            <span className="brand-grad">เทียนมิ่ง · Lottery Analyzer</span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="flex gap-1 text-sm">
              {[
                { href: "/calculator", label: "เครื่องคำนวณ" },
                { href: "/draw-entry", label: "กรอกผลหวย" },
                { href: "/backtest", label: "ทดสอบย้อนหลัง" },
                { href: "/audit", label: "ตรวจระบบ" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-gold-light"
                >
                  {l.label}
                </Link>
              ))}
              {user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-1.5 text-gold-light/80 transition hover:bg-white/5 hover:text-gold-light"
                >
                  Admin
                </Link>
              )}
            </nav>
            <UserNav user={user ? { displayName: user.displayName, role: user.role } : null} />
          </div>
        </div>
      </header>
      <main className={`py-8 ${container}`}>{children}</main>
      <footer className={`py-10 text-xs text-white/35 ${container}`}>
        เครื่องมือทดลองเชิงสถิติเพื่อการศึกษา · สูตรทั้งหมดทำงานฝั่ง engine (Python)
      </footer>
    </>
  );
}
