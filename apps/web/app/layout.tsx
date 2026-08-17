import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tianming Lottery Analyzer",
  description: "เครื่องมือทดลองเชิงสถิติเพื่อการศึกษา — ไม่ใช่การพยากรณ์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <header className="border-b border-gold/30 bg-navy/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-gold">
              เทียนมิ่ง · Lottery Analyzer
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/calculator" className="hover:text-gold">เครื่องคำนวณ</Link>
              <Link href="/backtest" className="hover:text-gold">ทดสอบย้อนหลัง</Link>
              <Link href="/audit" className="hover:text-gold">ตรวจระบบ</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-white/40">
          เครื่องมือทดลองเชิงสถิติเพื่อการศึกษาเท่านั้น · สูตรทั้งหมดทำงานฝั่ง engine (Python)
        </footer>
      </body>
    </html>
  );
}
