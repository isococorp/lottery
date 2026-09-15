import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/login/change-password");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          สวัสดี, {user.displayName}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          ยินดีต้อนรับเข้าสู่ระบบ Tianming Lottery Analyzer
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/calculator", label: "เครื่องคำนวณ", desc: "คำนวณเลขจากสำนักต่าง ๆ" },
          { href: "/backtest", label: "ทดสอบย้อนหลัง", desc: "Walk-forward backtest" },
          { href: "/audit", label: "ตรวจระบบ", desc: "ตรวจสอบสถานะ engine" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="card transition hover:border-gold/30">
            <h3 className="font-semibold text-gold-light">{item.label}</h3>
            <p className="mt-1 text-sm text-white/50">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
