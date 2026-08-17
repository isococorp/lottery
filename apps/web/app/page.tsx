import Link from "next/link";
import { Warning } from "@/components/Warning";

export default function Home() {
  return (
    <div className="space-y-6">
      <Warning />
      <section className="card">
        <h1 className="mb-2 text-2xl font-bold text-gold">Tianming Lottery Analyzer</h1>
        <p className="text-sm text-white/80">
          เครื่องมือ <b>ทดลองเชิงสถิติ</b> ที่คำนวณตัวเลขจาก 5 ศาสตร์ (ดวงจีน · ดวงไทย ·
          เลขศาสตร์ · สถิติ walk-forward · ศาสตร์อื่น) พร้อมระบบ <b>ทดสอบย้อนหลัง</b> ที่พิสูจน์ว่า
          ไม่มีศาสตร์ใดพยากรณ์ผลสลากได้เกินระดับสุ่ม จากข้อมูลจริง 708 งวด
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/calculator" className="card hover:border-gold">
          <div className="text-lg font-semibold text-gold">เครื่องคำนวณ</div>
          <p className="text-sm text-white/70">กรอกวัน–เวลา ดูตัวเลข 5 ศาสตร์ × 7 ค่า + ปัจจัย</p>
        </Link>
        <Link href="/backtest" className="card hover:border-gold">
          <div className="text-lg font-semibold text-gold">ทดสอบย้อนหลัง</div>
          <p className="text-sm text-white/70">โหมดตรงเป๊ะ/สลับตำแหน่ง + p-value + CI + Export Excel</p>
        </Link>
        <Link href="/audit" className="card hover:border-gold">
          <div className="text-lg font-semibold text-gold">ตรวจระบบ</div>
          <p className="text-sm text-white/70">Self-Check, Model Status, คุณภาพข้อมูล</p>
        </Link>
      </div>
    </div>
  );
}
