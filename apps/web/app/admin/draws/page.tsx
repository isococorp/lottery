"use client";

import { useState, useEffect, FormEvent } from "react";
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

interface GloRaw {
  date: string;
  first: string[];
  last2: string[];
  last3f: string[];
  last3b: string[];
}

const EMPTY: Draw = {
  date: "", six: null, top3: null, top2: null, bottom2: null,
  set1: null, set2: null, set3: null, set4: null, drawTime: "16:00",
};

// label, field, digits — mirrors the Excel column order.
const NUM_FIELDS: [string, keyof Draw, number][] = [
  ["รางวัลที่ 1 (6 หลัก)", "six", 6],
  ["3 บน", "top3", 3],
  ["2 บน", "top2", 2],
  ["2 ล่าง", "bottom2", 2],
  ["3 ล่าง ชุด 1 (เลขหน้า)", "set1", 3],
  ["3 ล่าง ชุด 2 (เลขหน้า)", "set2", 3],
  ["3 ล่าง ชุด 3 (เลขท้าย)", "set3", 3],
  ["3 ล่าง ชุด 4 (เลขท้าย)", "set4", 3],
];

const CELL_FIELDS = ["six", "top3", "top2", "bottom2", "set1", "set2", "set3", "set4"] as const;

export default function DrawsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "fetch" | "save">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState<Draw>(EMPTY);
  const [raw, setRaw] = useState<GloRaw | null>(null);
  const [alreadyInDb, setAlreadyInDb] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/draws");
    if (res.ok) {
      const data = await res.json();
      setDraws(data.draws);
      setTotal(data.total);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function set<K extends keyof Draw>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v === "" ? null : v }));
  }

  async function handleFetch() {
    setBusy("fetch"); setError(""); setNotice(""); setRaw(null);
    try {
      const res = await fetch("/api/admin/draws/fetch");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "ดึงข้อมูลไม่สำเร็จ"); return; }
      setForm({ ...data.draw });
      setRaw(data.raw);
      setAlreadyInDb(data.alreadyInDb);
      setOpen(true);
      setNotice(
        data.alreadyInDb
          ? `งวด ${isoToThai(data.draw.date)} มีอยู่ในฐานข้อมูลแล้ว — บันทึกซ้ำจะเป็นการแก้ไขข้อมูลเดิม`
          : `ดึงงวด ${isoToThai(data.draw.date)} จาก GLO สำเร็จ — ตรวจสอบแล้วกดบันทึก`,
      );
      if (data.warnings?.length) setError(data.warnings.join(" · "));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy("save"); setError(""); setNotice("");
    try {
      const res = await fetch("/api/admin/draws", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      setNotice(
        `${data.action === "inserted" ? "เพิ่ม" : "แก้ไข"}งวด ${isoToThai(data.draw.date)} สำเร็จ · ` +
        `ข้อมูลรวม ${data.engine.total_rows} งวด · เกรด ${data.engine.grade} · ` +
        `สำรองไฟล์เดิมไว้ที่ ${data.engine.backup}`,
      );
      setOpen(false); setRaw(null); setForm(EMPTY);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("");
    }
  }

  function startManual() {
    setForm(EMPTY); setRaw(null); setAlreadyInDb(false);
    setError(""); setNotice(""); setOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">ข้อมูลงวดหวย</h1>
          <p className="mt-1 text-xs text-white/50">
            เพิ่มงวดใหม่เข้าทั้งฐานข้อมูลและไฟล์ Excel ต้นทาง แล้วสั่ง engine โหลดใหม่ทันที
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn text-sm" onClick={handleFetch} disabled={busy !== ""}>
            {busy === "fetch" ? "กำลังดึง..." : "ดึงงวดล่าสุดจาก GLO"}
          </button>
          <button className="btn-ghost text-sm" onClick={startManual} disabled={busy !== ""}>
            กรอกเอง
          </button>
        </div>
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

      {open && (
        <form onSubmit={handleSave} className="card mb-6 border-gold/40">
          <h2 className="mb-4 text-base font-semibold text-white">
            ตรวจสอบก่อนบันทึก
            {alreadyInDb && (
              <span className="ml-2 rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                มีงวดนี้อยู่แล้ว — จะเป็นการแก้ไข
              </span>
            )}
          </h2>

          {raw && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
              <div className="mb-2 font-semibold text-gold-light">ข้อมูลดิบจาก GLO</div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>รางวัลที่ 1: <span className="text-white">{raw.first.join(", ") || "—"}</span></div>
                <div>เลขท้าย 2 ตัว: <span className="text-white">{raw.last2.join(", ") || "—"}</span></div>
                <div>เลขหน้า 3 ตัว: <span className="text-white">{raw.last3f.join(", ") || "—"}</span> → ชุด 1, 2</div>
                <div>เลขท้าย 3 ตัว: <span className="text-white">{raw.last3b.join(", ") || "—"}</span> → ชุด 3, 4</div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">งวดวันที่ (ค.ศ. YYYY-MM-DD)</label>
              <input
                type="text" required placeholder="2026-09-01" value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-white/40">
                {form.date && isoToThai(form.date) ? `พ.ศ. ${isoToThai(form.date)}` : " "}
              </p>
            </div>
            {NUM_FIELDS.map(([label, field, len]) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-white/60">{label}</label>
                <input
                  type="text" inputMode="numeric" maxLength={len}
                  placeholder={"0".repeat(len)}
                  value={(form[field] as string | null) ?? ""}
                  onChange={(e) => set(field, e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-white/60">เวลาสร้างตัวเลข</label>
              <input
                type="text" placeholder="16:00" value={form.drawTime ?? ""}
                onChange={(e) => set("drawTime", e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white"
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-white/40">
            เว้นว่างได้สำหรับรางวัลที่ไม่มีในงวดนั้น · ทุกค่าเก็บเป็นข้อความเพื่อรักษาเลข 0 นำหน้า
          </p>

          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn text-sm" disabled={busy !== ""}>
              {busy === "save" ? "กำลังบันทึก..." : "บันทึกลง DB + Excel"}
            </button>
            <button
              type="button" className="btn-ghost text-sm"
              onClick={() => { setOpen(false); setRaw(null); setError(""); }}
              disabled={busy !== ""}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gold-light">งวดล่าสุดในฐานข้อมูล</h2>
          <span className="text-xs text-white/50">ทั้งหมด {total} งวด</span>
        </div>
        {loading ? (
          <p className="text-center text-white/50">กำลังโหลด...</p>
        ) : draws.length === 0 ? (
          <p className="text-center text-white/50">ยังไม่มีข้อมูลงวดในฐานข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="bg-navy/50">
                  <th className="text-left">งวดวันที่</th>
                  <th>6 หลัก</th>
                  <th>3 บน</th>
                  <th>2 บน</th>
                  <th>2 ล่าง</th>
                  <th>ชุด 1</th>
                  <th>ชุด 2</th>
                  <th>ชุด 3</th>
                  <th>ชุด 4</th>
                  <th>เวลา</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.date}>
                    <td className="text-left font-medium text-white">
                      {isoToThai(d.date)}
                      <span className="ml-2 text-xs text-white/40">{d.date}</span>
                    </td>
                    {CELL_FIELDS.map((f) => (
                      <td key={f} className="text-center font-mono text-white/80">{d[f] ?? "—"}</td>
                    ))}
                    <td className="text-center text-xs text-white/50">{d.drawTime ?? "—"}</td>
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
