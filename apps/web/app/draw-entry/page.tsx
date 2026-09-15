"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import { isoToThai } from "@/lib/thaiDate";

interface Draw {
  date: string;
  six: string | null;
  top3: string | null;
  top2: string | null;
  bottom2: string | null;
  set1: string | null;
  set2: string | null;
  set3: string | null;
  set4: string | null;
  drawTime: string | null;
}

type NumField = "six" | "bottom2" | "set1" | "set2" | "set3" | "set4";

const EMPTY: Draw = {
  date: "", six: null, top3: null, top2: null, bottom2: null,
  set1: null, set2: null, set3: null, set4: null, drawTime: "16:00",
};

// The fields the user actually types. 3 บน / 2 บน are derived from รางวัลที่ 1
// (the workbook computes them the same way: =MID(B,4,3) / =MID(B,5,3)).
const INPUTS: { field: NumField; label: string; hint: string; len: number }[] = [
  { field: "six", label: "รางวัลที่ 1", hint: "6 หลัก", len: 6 },
  { field: "bottom2", label: "2 ล่าง", hint: "เลขท้าย 2 ตัว", len: 2 },
  { field: "set1", label: "3 ล่าง ชุด 1", hint: "เลขหน้า 3 ตัว ตัวที่ 1", len: 3 },
  { field: "set2", label: "3 ล่าง ชุด 2", hint: "เลขหน้า 3 ตัว ตัวที่ 2", len: 3 },
  { field: "set3", label: "3 ล่าง ชุด 3", hint: "เลขท้าย 3 ตัว ตัวที่ 1", len: 3 },
  { field: "set4", label: "3 ล่าง ชุด 4", hint: "เลขท้าย 3 ตัว ตัวที่ 2", len: 3 },
];

const CELL_FIELDS = ["six", "top3", "top2", "bottom2", "set1", "set2", "set3", "set4"] as const;

export default function DrawEntryPage() {
  const [form, setForm] = useState<Draw>(EMPTY);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exists, setExists] = useState(false);

  // 3 บน / 2 บน follow รางวัลที่ 1 whenever it is complete.
  const six = form.six ?? "";
  const derived = six.length === 6;
  const top3 = derived ? six.slice(-3) : form.top3 ?? "";
  const top2 = derived ? six.slice(-2) : form.top2 ?? "";

  const load = useCallback(async () => {
    const res = await fetch("/api/draws");
    if (res.ok) {
      const data = await res.json();
      setDraws(data.draws);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Warn before overwriting a งวด that is already recorded.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { setExists(false); return; }
    let cancelled = false;
    fetch(`/api/draws?date=${form.date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setExists(Boolean(d.exists)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.date]);

  function setField(k: keyof Draw, v: string) {
    setForm((f) => ({ ...f, [k]: v === "" ? null : v }));
  }

  function digits(k: keyof Draw, v: string) {
    setField(k, v.replace(/\D/g, ""));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setError("กรุณากรอกงวดวันที่ให้ถูกต้อง");
      return;
    }
    if (!six && !form.bottom2 && !form.set1 && !form.set3) {
      setError("กรุณากรอกผลรางวัลอย่างน้อยหนึ่งช่อง");
      return;
    }

    setSaving(true);
    try {
      const payload: Draw = {
        ...form,
        top3: top3 || null,
        top2: top2 || null,
        drawTime: form.drawTime || "16:00",
      };
      const res = await fetch("/api/draws", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      setNotice(
        `${data.action === "inserted" ? "เพิ่ม" : "แก้ไข"}งวด ${isoToThai(data.draw.date)} สำเร็จ · ` +
        `ข้อมูลรวม ${data.engine.total_rows} งวด · เกรดข้อมูล ${data.engine.grade}`,
      );
      setForm(EMPTY);
      setExists(false);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">กรอกผลหวย</h1>
        <p className="mt-1 text-xs text-white/50">
          กรอกผลรางวัลงวดใหม่เอง เมื่อบันทึกแล้วระบบจะเพิ่มเข้าฐานข้อมูลและไฟล์ข้อมูลต้นทางทันที
          และหน้าเครื่องคำนวณ/ทดสอบย้อนหลังจะใช้งวดนี้ด้วย
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-200">
        ข้อมูลที่บันทึกเป็นข้อมูลกลางที่ผู้ใช้ทุกคนใช้ร่วมกัน — กรุณาตรวจตัวเลขให้ตรงกับผลรางวัลจริงก่อนกดบันทึก
        ทุกการบันทึกถูกบันทึกชื่อผู้ทำไว้ในระบบตรวจสอบ
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2 text-sm text-gold-light">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="card mb-6 border-gold/40">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-white/70">งวดวันที่</label>
          <ThaiDateInput
            value={form.date}
            onChange={(iso) => setField("date", iso)}
            className="w-44 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
          />
          {form.date && (
            <span className="text-xs text-white/40">ค.ศ. {form.date}</span>
          )}
          {exists && (
            <span className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
              มีงวดนี้อยู่แล้ว — การบันทึกจะทับข้อมูลเดิม
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {INPUTS.map(({ field, label, hint, len }) => (
            <div key={field}>
              <label className="mb-1 block text-xs text-white/60">
                {label} <span className="text-white/35">· {hint}</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={len}
                placeholder={"0".repeat(len)}
                value={(form[field] as string | null) ?? ""}
                onChange={(e) => digits(field, e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-xs text-white/60">
              3 บน <span className="text-white/35">· {derived ? "คำนวณอัตโนมัติ" : "กรอกเอง"}</span>
            </label>
            <input
              type="text" inputMode="numeric" maxLength={3} placeholder="000"
              value={top3} readOnly={derived}
              onChange={(e) => digits("top3", e.target.value)}
              className={`w-full rounded-lg border border-white/15 px-3 py-2 font-mono text-sm text-white ${
                derived ? "bg-white/10 text-gold-light" : "bg-white/5"
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">
              2 บน <span className="text-white/35">· {derived ? "คำนวณอัตโนมัติ" : "กรอกเอง"}</span>
            </label>
            <input
              type="text" inputMode="numeric" maxLength={2} placeholder="00"
              value={top2} readOnly={derived}
              onChange={(e) => digits("top2", e.target.value)}
              className={`w-full rounded-lg border border-white/15 px-3 py-2 font-mono text-sm text-white ${
                derived ? "bg-white/10 text-gold-light" : "bg-white/5"
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">
              เวลาสร้างตัวเลข <span className="text-white/35">· ปกติ 16:00</span>
            </label>
            <input
              type="text" placeholder="16:00"
              value={form.drawTime ?? ""}
              onChange={(e) => setField("drawTime", e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white"
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-white/40">
          เว้นว่างได้สำหรับรางวัลที่งวดนั้นไม่มี · เก็บเป็นข้อความเพื่อรักษาเลข 0 นำหน้า เช่น 04 ไม่ใช่ 4
        </p>

        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn text-sm" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึกผลหวย"}
          </button>
          <button
            type="button" className="btn-ghost text-sm" disabled={saving}
            onClick={() => { setForm(EMPTY); setError(""); setNotice(""); }}
          >
            ล้างฟอร์ม
          </button>
        </div>
      </form>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gold-light">งวดล่าสุดในระบบ</h2>
          <span className="text-xs text-white/50">ทั้งหมด {total} งวด</span>
        </div>
        {loading ? (
          <p className="text-center text-white/50">กำลังโหลด...</p>
        ) : draws.length === 0 ? (
          <p className="text-center text-white/50">ยังไม่มีข้อมูลงวดในระบบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="bg-navy/50">
                  <th className="text-left">งวดวันที่</th>
                  <th>รางวัลที่ 1</th>
                  <th>3 บน</th>
                  <th>2 บน</th>
                  <th>2 ล่าง</th>
                  <th>ชุด 1</th>
                  <th>ชุด 2</th>
                  <th>ชุด 3</th>
                  <th>ชุด 4</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.date}>
                    <td className="text-left font-medium text-white">{isoToThai(d.date)}</td>
                    {CELL_FIELDS.map((f) => (
                      <td key={f} className="text-center font-mono text-white/80">{d[f] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
