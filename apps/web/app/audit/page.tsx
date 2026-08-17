import { engineGet } from "@/lib/engine";
import { Warning } from "@/components/Warning";

export const dynamic = "force-dynamic";

export default async function Audit() {
  let audit: any = null;
  let quality: any = null;
  let err: string | null = null;
  try {
    [audit, quality] = await Promise.all([engineGet("/audit"), engineGet("/data/quality")]);
  } catch (e: any) {
    err = String(e?.message ?? e);
  }

  return (
    <div className="space-y-4">
      <Warning text={audit?.gate?.warning} />
      {err && <div className="card text-red-300">engine ไม่พร้อม: {err}</div>}

      {quality && (
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold text-gold">คุณภาพข้อมูล</h2>
          <p className="text-sm">
            เกรด <b className="text-gold">{quality.grade}</b> · {quality.valid_rows}/{quality.total_rows} งวดสมบูรณ์ ·
            ช่วง {quality.date_range?.join(" .. ")} · ชุด2 ว่าง {quality.set2_nulls} งวด (ตามกติกาเก่า)
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-navy/60 p-2 text-xs text-white/70">{quality.report_text}</pre>
        </div>
      )}

      {audit && (
        <div className="card">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="badge">Model: {audit.gate?.model_status}</span>
            <span className="badge">Failure: {audit.gate?.failure_state}</span>
            <span className="badge">Self-Check: {audit.gate?.self_check?.passed}/{audit.gate?.self_check?.total}</span>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gold">Self-Check (18 ข้อ)</h2>
          <ul className="grid gap-1 text-sm text-white/80 sm:grid-cols-2">
            {audit.self_check_items?.map((it: string) => (
              <li key={it}>✓ {it}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-white/60">จุดยืน: {audit.stance}</p>
        </div>
      )}
    </div>
  );
}
