"use client";
import { useState } from "react";
import { Warning, LayerBadge, ConfidenceBadge } from "@/components/Warning";

type SchoolOut = {
  code: string;
  name: string;
  status?: string;
  reason?: string;
  numbers?: { top3: string; top2: string; bottom2: string; set3: string[] };
  factors?: Record<string, unknown>;
};

export default function Calculator() {
  const [date, setDate] = useState("2026-08-16");
  const [time, setTime] = useState("16:00");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      setData(j);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const summ: Record<string, any> = {};
  (data?.backtest_summary ?? []).forEach((s: any) => (summ[s.name] = s));

  return (
    <div className="space-y-4">
      <Warning text={data?.v5?.warning} />

      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          วันที่
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="ml-2 rounded bg-navy px-2 py-1 text-white" />
        </label>
        <label className="text-sm">
          เวลา
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                 className="ml-2 rounded bg-navy px-2 py-1 text-white" />
        </label>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? "กำลังคำนวณ…" : "คำนวณ"}
        </button>
      </div>

      {err && <div className="card text-red-300">ผิดพลาด: {err}</div>}

      {data && (
        <>
          <div className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <LayerBadge level={data.layer?.level ?? 2} label={data.layer?.label ?? ""} />
              <ConfidenceBadge tier={data.v5?.confidence ?? "NONE"} />
              <span className="badge border-white/30 text-white/70">
                Model: {data.v5?.model_status}
              </span>
            </div>
            <div className="text-sm text-white/80">
              สี่เสา: <b>{data.pillars?.year?.gz} {data.pillars?.month?.gz} {data.pillars?.day?.gz} {data.pillars?.hour?.gz}</b>
              {"  ·  "}เจ้าชะตา: <b>{data.power?.label}</b> (A={data.power?.A}, B={data.power?.B})
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-navy text-gold">
                  <th>ศาสตร์</th><th>3 บน</th><th>2 บน</th><th>2 ล่าง</th>
                  <th>3 ล่าง ชุด 1–4</th><th>backtest 2 ล่าง</th>
                </tr>
              </thead>
              <tbody>
                {(data.schools as SchoolOut[]).map((s) => {
                  const b = summ[s.name]?.bottom2;
                  return (
                    <tr key={s.code}>
                      <td className="font-semibold text-gold">{s.name}</td>
                      {s.status === "NOT AVAILABLE" ? (
                        <td colSpan={4} className="text-white/50">
                          NOT AVAILABLE — {s.reason}
                        </td>
                      ) : (
                        <>
                          <td>{s.numbers?.top3}</td>
                          <td>{s.numbers?.top2}</td>
                          <td>{s.numbers?.bottom2}</td>
                          <td className="font-mono">{s.numbers?.set3?.join("  ")}</td>
                        </>
                      )}
                      <td className="text-xs text-white/70">
                        {b ? `${b.hits}/${b.n} (${(b.rate * 100).toFixed(2)}%) p=${b.p_value.toFixed(3)} ${b.beats_random ? "⚠ชนะสุ่ม" : "ไม่ชนะสุ่ม"}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.catalog && (
            <div className="card">
              <div className="mb-2 text-gold">
                แคตตาล็อกครบ 21 วิชา ·{" "}
                <span className="text-white/70">
                  Production {data.catalog.summary.production} · Backlog {data.catalog.summary.backlog} · วินัย V5 1
                </span>
              </div>
              <p className="mb-3 text-xs text-white/60">{data.catalog.note}</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-navy text-gold">
                    <th>#</th><th>วิชา</th><th>ชั้น</th><th>สถานะ</th><th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.catalog.production, ...data.catalog.backlog, data.catalog.discipline].map(
                    (v: any) => (
                      <tr key={v.code} className={v.status === "PRODUCTION" ? "bg-green-500/10" : ""}>
                        <td>{v.code}</td>
                        <td className="text-left">{v.name}</td>
                        <td>{v.layer}</td>
                        <td className={v.status === "PRODUCTION" ? "text-green-300" : "text-white/50"}>
                          {v.status}
                        </td>
                        <td className="text-left text-xs text-white/60">{v.note ?? v.principle}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-white/50">
                §4.6–4.20 เป็น backlog ศาสตร์ความเชื่อที่ spec ยังไม่ให้สูตรแปลงเป็น 7 ค่า — แสดงสถานะ NOT AVAILABLE
                ตามจริง (§4.21.17-B) ไม่สร้างตัวเลขปลอม · §4.21 เป็นชั้นวินัย V5 ไม่ใช่ศาสตร์สร้างเลข
              </p>
            </div>
          )}

          <details className="card text-sm">
            <summary className="cursor-pointer text-gold">ปัจจัยประกอบ (factors)</summary>
            <pre className="mt-2 overflow-x-auto text-xs text-white/70">
              {JSON.stringify(data.schools.map((s: SchoolOut) => ({ [s.name]: s.factors })), null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
