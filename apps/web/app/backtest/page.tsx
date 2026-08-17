"use client";
import { useState } from "react";
import { Warning, LayerBadge } from "@/components/Warning";

export default function Backtest() {
  const [mode, setMode] = useState<"permutation" | "exact">("permutation");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ml, setMl] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);

  async function runMl() {
    setMlLoading(true);
    try {
      const r = await fetch("/api/ml", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setMl(await r.json());
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setMlLoading(false);
    }
  }

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/backtest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
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

  return (
    <div className="space-y-4">
      <Warning text={data?.v5?.warning} />

      <div className="card flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-gold/40">
          {(["permutation", "exact"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm ${mode === m ? "bg-gold text-navy" : "text-white/70"}`}>
              {m === "permutation" ? "สลับตำแหน่ง" : "ตรงเป๊ะ"}
            </button>
          ))}
        </div>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? "กำลังรัน…" : "รันทดสอบย้อนหลัง"}
        </button>
        <a className="btn" href={`/api/export?mode=${mode}`}>Export Excel</a>
      </div>

      {err && <div className="card text-red-300">ผิดพลาด: {err}</div>}

      {data && (
        <div className="card overflow-x-auto">
          <div className="mb-2">
            <LayerBadge level={3} label="หลักฐานสถิติ (walk-forward)" />
            <span className="ml-2 text-sm text-white/70">
              โหมด {data.mode} · {data.n_draws} งวด · {data.date_range?.join(" .. ")}
            </span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-navy text-gold">
                <th>ศาสตร์</th><th>เมตริก</th><th>ถูก/งวด</th><th>อัตรา</th>
                <th>baseline</th><th>p-value</th><th>95% CI</th><th>ชนะสุ่ม?</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map((s: any) =>
                [["2 ล่าง", s.bottom2], ["3 ล่าง (4 ชุด)", s.set3]].map(([label, m]: any) => (
                  <tr key={s.code + label} className={m.beats_random ? "bg-green-500/10" : ""}>
                    <td className="font-semibold text-gold">{s.name}</td>
                    <td>{label}</td>
                    <td>{m.hits}/{m.n}</td>
                    <td>{(m.rate * 100).toFixed(2)}%</td>
                    <td>{(m.baseline_p * 100).toFixed(3)}%</td>
                    <td>{m.p_value.toFixed(3)}</td>
                    <td>[{(m.ci_low * 100).toFixed(2)}, {(m.ci_high * 100).toFixed(2)}]</td>
                    <td className={m.beats_random ? "text-green-300" : "text-white/60"}>
                      {m.beats_random ? "ใช่" : "ไม่"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-white/60">
            ข้อสรุป: ทุกศาสตร์ให้ค่า “ชนะสุ่ม = ไม่” — สอดคล้องกับจุดยืนของระบบว่าไม่มีศาสตร์ใดพยากรณ์เกินระดับสุ่ม
          </p>

          {data.baselines && (
            <div className="mt-6">
              <h3 className="mb-1 font-semibold text-gold">
                Baseline Comparison (§4.21.6 · ชั้น 2)
              </h3>
              <p className="mb-2 text-xs text-white/60">{data.baseline_note}</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-navy text-gold">
                    <th>#</th><th>Baseline</th><th>ถูก/งวด (2ล่าง)</th>
                    <th>อัตรา</th><th>baseline</th><th>p-value</th><th>ชนะสุ่ม?</th>
                  </tr>
                </thead>
                <tbody>
                  {data.baselines.map((b: any) => (
                    <tr key={b.code} className={b.bottom2.beats_random ? "bg-green-500/10" : ""}>
                      <td>{b.code}</td>
                      <td>{b.name}</td>
                      <td>{b.bottom2.hits}/{b.bottom2.n}</td>
                      <td>{(b.bottom2.rate * 100).toFixed(2)}%</td>
                      <td>{(b.bottom2.baseline_p * 100).toFixed(3)}%</td>
                      <td>{b.bottom2.p_value.toFixed(3)}</td>
                      <td className={b.bottom2.beats_random ? "text-green-300" : "text-white/60"}>
                        {b.bottom2.beats_random ? "ใช่" : "ไม่"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="font-semibold text-gold">ML Models — §4.4-EXT หมวด M (ชั้น 2)</h3>
              <button className="btn text-sm" onClick={runMl} disabled={mlLoading}>
                {mlLoading ? "กำลังเทรน (walk-forward)…" : "โหลดผล ML models"}
              </button>
            </div>
            {ml?.note && <p className="mb-2 text-xs text-white/60">{ml.note}</p>}
            {ml?.models && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-navy text-gold">
                    <th>#</th><th>Model</th><th>สถานะ</th><th>ถูก/งวด</th>
                    <th>อัตรา</th><th>p-value</th><th>ชนะสุ่ม?</th>
                  </tr>
                </thead>
                <tbody>
                  {ml.models.map((m: any) => (
                    <tr key={m.code} className={m.bottom2?.beats_random ? "bg-green-500/10" : ""}>
                      <td>{m.code}</td>
                      <td>{m.name}</td>
                      <td className={m.status === "READY" ? "text-green-300" : "text-white/40"}>
                        {m.status}
                      </td>
                      {m.status === "READY" ? (
                        <>
                          <td>{m.bottom2.hits}/{m.bottom2.n}</td>
                          <td>{(m.bottom2.rate * 100).toFixed(2)}%</td>
                          <td>{m.bottom2.p_value.toFixed(3)}</td>
                          <td className="text-white/60">{m.bottom2.beats_random ? "ใช่" : "ไม่"}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="text-left text-xs text-white/50">{m.reason}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
