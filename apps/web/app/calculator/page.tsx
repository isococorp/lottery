"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { LayerBadge, ConfidenceBadge } from "@/components/Warning";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import { isoToThai } from "@/lib/thaiDate";
import { schoolTh, SCHOOL_TH } from "@/lib/schools";

type SchoolOut = {
  code: string;
  name: string;
  status?: string;
  reason?: string;
  numbers?: { top3: string; top2: string; bottom2: string; set3: string[] };
  factors?: Record<string, unknown>;
};

const SCHOOL_COLORS: Record<string, string> = {
  "4.1": "#e6c878", "4.2": "#60a5fa", "4.3": "#f87171", "4.4": "#4ade80",
  "4.5": "#c084fc", "4.6": "#fb923c", "4.7": "#2dd4bf", "4.8": "#f472b6",
  "4.9": "#a3e635", "4.10": "#38bdf8", "4.11": "#facc15", "4.12": "#a78bfa",
  "4.15": "#34d399", "4.16": "#fb7185", "4.17": "#818cf8", "4.18": "#fbbf24",
  "4.19": "#22d3ee", "4.20": "#f97316",
};
const POS_HIT_IDX: Record<string, number> = { top3: 0, top2: 1, bottom2: 2, set3: 3 };
const SCORE_W: Record<string, { exact: number; swapped: number }> = {
  top3: { exact: 550, swapped: 100 },
  top2: { exact: 70, swapped: 35 },
  bottom2: { exact: 70, swapped: 35 },
  set3: { exact: 100, swapped: 33 },
};
const POS_CHART_TABS = [
  { key: "all", label: "รวม (ตำแหน่งที่เปิด)" },
  { key: "top3", label: "3 บน" },
  { key: "top2", label: "2 บน" },
  { key: "bottom2", label: "2 ล่าง" },
  { key: "set3", label: "3 ล่าง (ชุด 1–4)" },
] as const;

export default function Calculator() {
  const [date, setDate] = useState("2026-08-16");
  const [time, setTime] = useState("16:00");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dbDates, setDbDates] = useState<string[]>([]);
  const [hitSummary, setHitSummary] = useState<any>(null);
  // ช่วงวันที่ใช้คิด "คะแนน" สะสม (§10). ค่าเริ่มต้น = ทั้งฐานข้อมูล.
  const [scoreStart, setScoreStart] = useState("");
  const [scoreEnd, setScoreEnd] = useState("");
  // ช่องกรอกค่าบนหัวตาราง แยกตามตำแหน่ง (§15) — ชื่อ + ค่าเริ่มต้น.
  const [tblInputs, setTblInputs] = useState<Record<string, string>>({
    "3บน1": "1", "3บน2": "6",
    "2บน1": "1", "2บน2": "2",
    "2ล่าง1": "1", "2ล่าง2": "2",
    "3ล่าง4": "24",
  });
  // Toggle state for position columns — all active by default
  const [posToggles, setPosToggles] = useState<Record<string, boolean>>({
    top3: true, top2: true, bottom2: true, set3: true,
  });
  const togglePos = (pos: string) =>
    setPosToggles((v) => ({ ...v, [pos]: !v[pos] }));

  // วิเคราะห์วิชา toggle + data
  const [analyzeOn, setAnalyzeOn] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("4.1");
  const [chartMetric, setChartMetric] = useState<"index" | "score" | "taem">("index");
  const [highlightSchool, setHighlightSchool] = useState<string | null>(null);
  const [analyzePos, setAnalyzePos] = useState<"top3" | "top2" | "bottom2" | "set3">("top3");
  // จำนวนศาสตร์ที่เอามานับเลขซ้ำ แยกช่องละค่า (เรียงตามคะแนนสะสมของคอลัมน์นั้น)
  const [countN, setCountN] = useState<Record<string, string>>({
    top3: "18", top2: "18", bottom2: "18", set3: "18",
  });

  useEffect(() => {
    if (!analyzeData) {
      setAnalyzeLoading(true);
      fetch("/api/school-analysis")
        .then((r) => r.json())
        .then((j) => { if (!j.error) setAnalyzeData(j); })
        .catch(() => {})
        .finally(() => setAnalyzeLoading(false));
    }
  }, [analyzeData]);

  const costPerDraw = useMemo(() => {
    let c = 0;
    if (posToggles.top3) c += (parseFloat(tblInputs["3บน1"]) || 0) + (parseFloat(tblInputs["3บน2"]) || 0);
    if (posToggles.top2) c += (parseFloat(tblInputs["2บน1"]) || 0) + (parseFloat(tblInputs["2บน2"]) || 0);
    if (posToggles.bottom2) c += (parseFloat(tblInputs["2ล่าง1"]) || 0) + (parseFloat(tblInputs["2ล่าง2"]) || 0);
    if (posToggles.set3) c += parseFloat(tblInputs["3ล่าง4"]) || 0;
    return c;
  }, [posToggles, tblInputs]);

  type ProgressiveRow = { startDate: string; nDraws: number; score: number; index: number; taem: number };

  const progressiveRows = useMemo((): ProgressiveRow[] => {
    if (!analyzeData) return [];
    const school = analyzeData.schools[selectedSchool];
    if (!school) return [];
    const hits: number[][] = school.hits;
    const dates: string[] = analyzeData.dates;
    const N = hits.length;
    if (!N) return [];

    const perDraw = hits.map((h: number[]) => {
      let s = 0;
      if (posToggles.top3) s += h[0] === 2 ? 550 : h[0] === 1 ? 100 : 0;
      if (posToggles.top2) s += h[1] === 2 ? 70 : h[1] === 1 ? 35 : 0;
      if (posToggles.bottom2) s += h[2] === 2 ? 70 : h[2] === 1 ? 35 : 0;
      if (posToggles.set3) s += h[3] === 2 ? 100 : h[3] === 1 ? 33 : 0;
      return s;
    });

    const suffixSum = new Array(N);
    suffixSum[N - 1] = perDraw[N - 1];
    for (let i = N - 2; i >= 0; i--) suffixSum[i] = suffixSum[i + 1] + perDraw[i];

    return Array.from({ length: N }, (_, i) => {
      const nDraws = N - i;
      const score = suffixSum[i];
      return { startDate: dates[i], nDraws, score, index: score / nDraws, taem: score - nDraws * costPerDraw };
    });
  }, [analyzeData, selectedSchool, posToggles, costPerDraw]);

  const analyzeStats = useMemo(() => {
    if (!progressiveRows.length) return null;
    const idxs = progressiveRows.map((r) => r.index);
    const scores = progressiveRows.map((r) => r.score);
    const taems = progressiveRows.map((r) => r.taem);
    const minMax = (arr: number[]) => {
      let mi = 0, ma = 0;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] < arr[mi]) mi = i;
        if (arr[i] > arr[ma]) ma = i;
      }
      return { minIdx: mi, maxIdx: ma, min: arr[mi], max: arr[ma] };
    };
    return { index: minMax(idxs), score: minMax(scores), taem: minMax(taems) };
  }, [progressiveRows]);

  const activePosLabels = useMemo(() => {
    const map: Record<string, string> = { top3: "3บน", top2: "2บน", bottom2: "2ล่าง", set3: "3ล่าง" };
    return Object.entries(posToggles).filter(([, v]) => v).map(([k]) => map[k]);
  }, [posToggles]);

  const exportCsv = useCallback(() => {
    if (!progressiveRows.length) return;
    const schoolName = analyzeData?.schools[selectedSchool]?.name ?? selectedSchool;
    const posLabel = activePosLabels.join("+") || "ไม่มี";
    const meta = [
      `วิเคราะห์วิชา: ${selectedSchool} ${schoolName}`,
      `ตำแหน่ง: ${posLabel}`,
      `ต้นทุน/งวด: ${costPerDraw}`,
      "",
    ];
    const header = "ลำดับ,เริ่มต้น,งวด,ดัชนี,คะแนน,แต้ม";
    const rows = progressiveRows.map((r, i) =>
      `${i + 1},${isoToThai(r.startDate)},${r.nDraws},${r.index.toFixed(3)},${r.score},${r.taem.toFixed(2)}`
    );
    const summary = [
      "",
      `สรุป,,,,`,
      `ดัชนีสูงสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.index.maxIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.index.maxIdx].nDraws : ""},${analyzeStats?.index.max.toFixed(4) ?? ""},,`,
      `ดัชนีต่ำสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.index.minIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.index.minIdx].nDraws : ""},${analyzeStats?.index.min.toFixed(4) ?? ""},,`,
      `คะแนนสูงสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.score.maxIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.score.maxIdx].nDraws : ""},,${analyzeStats?.score.max.toLocaleString() ?? ""},`,
      `คะแนนต่ำสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.score.minIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.score.minIdx].nDraws : ""},,${analyzeStats?.score.min.toLocaleString() ?? ""},`,
      `แต้มสูงสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.taem.maxIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.taem.maxIdx].nDraws : ""},,,${analyzeStats?.taem.max.toFixed(2) ?? ""}`,
      `แต้มต่ำสุด,${analyzeStats ? isoToThai(progressiveRows[analyzeStats.taem.minIdx].startDate) : ""},${analyzeStats ? progressiveRows[analyzeStats.taem.minIdx].nDraws : ""},,,${analyzeStats?.taem.min.toFixed(2) ?? ""}`,
    ];
    const csv = "﻿" + [...meta, header, ...rows, ...summary].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `วิเคราะห์_${schoolName}_${posLabel}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [progressiveRows, analyzeData, selectedSchool, activePosLabels, costPerDraw, analyzeStats]);

  const posCost = useMemo<Record<string, number>>(() => ({
    top3: (parseFloat(tblInputs["3บน1"]) || 0) + (parseFloat(tblInputs["3บน2"]) || 0),
    top2: (parseFloat(tblInputs["2บน1"]) || 0) + (parseFloat(tblInputs["2บน2"]) || 0),
    bottom2: (parseFloat(tblInputs["2ล่าง1"]) || 0) + (parseFloat(tblInputs["2ล่าง2"]) || 0),
    set3: parseFloat(tblInputs["3ล่าง4"]) || 0,
  }), [tblInputs]);

  type ChartSeries = { index: number[]; score: number[]; taem: number[] };
  const allChartData = useMemo(() => {
    if (!analyzeData) return null;
    const dates: string[] = analyzeData.dates;
    const N = dates.length;
    if (!N) return null;
    const schoolCodes = Object.keys(analyzeData.schools);
    const byPos: Record<string, Record<string, ChartSeries>> = {
      all: {}, top3: {}, top2: {}, bottom2: {}, set3: {},
    };
    for (const code of schoolCodes) {
      const hits: number[][] = analyzeData.schools[code].hits;
      for (const pos of ["top3", "top2", "bottom2", "set3"] as const) {
        const idx = POS_HIT_IDX[pos];
        const w = SCORE_W[pos];
        const perDraw = hits.map((h: number[]) =>
          h[idx] === 2 ? w.exact : h[idx] === 1 ? w.swapped : 0);
        const suffix = new Array(N);
        suffix[N - 1] = perDraw[N - 1];
        for (let i = N - 2; i >= 0; i--) suffix[i] = suffix[i + 1] + perDraw[i];
        const pc = posCost[pos] ?? 0;
        byPos[pos][code] = {
          score: suffix.slice(),
          index: suffix.map((s: number, i: number) => s / (N - i)),
          taem: suffix.map((s: number, i: number) => s - (N - i) * pc),
        };
      }
      const perDrawAll = hits.map((h: number[]) => {
        let s = 0;
        if (posToggles.top3) s += h[0] === 2 ? 550 : h[0] === 1 ? 100 : 0;
        if (posToggles.top2) s += h[1] === 2 ? 70 : h[1] === 1 ? 35 : 0;
        if (posToggles.bottom2) s += h[2] === 2 ? 70 : h[2] === 1 ? 35 : 0;
        if (posToggles.set3) s += h[3] === 2 ? 100 : h[3] === 1 ? 33 : 0;
        return s;
      });
      const suffAll = new Array(N);
      suffAll[N - 1] = perDrawAll[N - 1];
      for (let i = N - 2; i >= 0; i--) suffAll[i] = suffAll[i + 1] + perDrawAll[i];
      byPos.all[code] = {
        score: suffAll.slice(),
        index: suffAll.map((s: number, i: number) => s / (N - i)),
        taem: suffAll.map((s: number, i: number) => s - (N - i) * costPerDraw),
      };
    }
    return { byPos, N, dates, schoolCodes };
  }, [analyzeData, posToggles, costPerDraw, posCost]);

  // Load the draw dates that have historical results, and default the score
  // window to the full DB range (dates come ascending → oldest..newest).
  useEffect(() => {
    fetch("/api/dates")
      .then((r) => r.json())
      .then((j) => {
        const asc: string[] = j.dates ?? [];
        setDbDates(asc.slice().reverse());
        if (asc.length) {
          setScoreStart((p) => p || asc[0]);
          setScoreEnd((p) => p || asc[asc.length - 1]);
        }
      })
      .catch(() => {});
  }, []);

  // Load the per-school ถูกตรง/ถูกสลับ summary for the chosen score window (§8/§10).
  useEffect(() => {
    const qs = new URLSearchParams();
    if (scoreStart) qs.set("start", scoreStart);
    if (scoreEnd) qs.set("end", scoreEnd);
    fetch(`/api/hit-summary?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => setHitSummary(j?.error ? null : j))
      .catch(() => {});
  }, [scoreStart, scoreEnd]);

  // Calculate the default date once on load so results are visible immediately
  // (and never blank after a dev hot-reload). User can recalc any other date.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(d: string = date, t: string = time) {
    if (!d) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: d, time: t }),
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

  const actual = data?.actual;

  const sortDigits = (s: string) => [...s].sort().join("");
  // Exact match = same digits in the same order (ตรงเป๊ะ ไม่สลับ).
  const exactHit = (pred?: string, act?: string) => !!pred && !!act && pred === act;
  // Permutation match (digit multiset) — matches the backtest permutation mode.
  const permHit = (pred?: string, act?: string) =>
    !!pred && !!act && pred.length === act.length && sortDigits(pred) === sortDigits(act);
  // Cell highlight: gold ring = ตรงเป๊ะ, green = ตรงแบบสลับตำแหน่ง, blank = ไม่ตรง.
  const EXACT_CLS = "bg-amber-400/30 font-bold text-amber-100 ring-1 ring-amber-300";
  const PERM_CLS = "bg-green-500/25 font-semibold text-green-200";
  const matchCls = (pred?: string, act?: string) =>
    exactHit(pred, act) ? EXACT_CLS : permHit(pred, act) ? PERM_CLS : "";
  // Same idea for a predicted 3-digit set vs any of the actual bottom-3 sets.
  const setMemberCls = (v?: string) => {
    const acts = (actual?.set3 ?? []).filter(Boolean) as string[];
    if (v && acts.some((a) => a === v)) return `rounded px-1 ${EXACT_CLS}`;
    if (v && acts.some((a) => permHit(v, a))) return `rounded px-1 ${PERM_CLS}`;
    return "";
  };

  // Historical ถูกตรง/ถูกสลับ counts (whole database) keyed by school code, so we
  // can attach each position's track record right under its calculated number.
  const hsByCode: Record<string, any> = {};
  (hitSummary?.schools ?? []).forEach((s: any) => (hsByCode[s.code] = s));

  const hitDatesLookup = useMemo(() => {
    if (!analyzeData) return null;
    const posIdx: Record<string, number> = { top3: 0, top2: 1, bottom2: 2, set3: 3 };
    const dates: string[] = analyzeData.dates;
    const result: Record<string, Record<string, { exact: string[]; swapped: string[] }>> = {};
    for (const code of Object.keys(analyzeData.schools)) {
      result[code] = {};
      const hits: number[][] = analyzeData.schools[code].hits;
      for (const pos of Object.keys(posIdx)) {
        const pi = posIdx[pos];
        const exact: string[] = [];
        const swapped: string[] = [];
        for (let i = 0; i < hits.length; i++) {
          const inWindow = (!scoreStart || dates[i] >= scoreStart) && (!scoreEnd || dates[i] <= scoreEnd);
          if (!inWindow) continue;
          if (hits[i][pi] === 2) exact.push(dates[i]);
          else if (hits[i][pi] === 1) swapped.push(dates[i]);
        }
        result[code][pos] = { exact, swapped };
      }
    }
    return result;
  }, [analyzeData, scoreStart, scoreEnd]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; dates: string[]; type: string } | null>(null);

  const showHitTooltip = useCallback((e: React.MouseEvent, hitDates: string[], type: string) => {
    if (hitDates.length < 1) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, dates: hitDates, type });
  }, []);

  const statLine = (code: string, pos: string) => {
    const p = hsByCode[code]?.[pos];
    if (!p || !p.n) return null;
    const hd = hitDatesLookup?.[code]?.[pos];
    return (
      <div className="mt-0.5 whitespace-nowrap text-[10px] font-normal leading-none text-white/45">
        <span
          className={`text-amber-300/80${p.exact > 0 ? " cursor-pointer underline decoration-dotted hover:text-amber-200" : ""}`}
          onMouseEnter={(e) => hd && p.exact > 0 && showHitTooltip(e, hd.exact, "ถูกตรง")}
          onMouseLeave={() => setTooltip(null)}
        >ต{p.exact}</span>
        <span className="text-white/25">/</span>
        <span
          className={`text-green-300/80${p.swapped > 0 ? " cursor-pointer underline decoration-dotted hover:text-green-200" : ""}`}
          onMouseEnter={(e) => hd && p.swapped > 0 && showHitTooltip(e, hd.swapped, "ถูกสลับ")}
          onMouseLeave={() => setTooltip(null)}
        >ส{p.swapped}</span>
        <span className="text-white/25">/</span>
        <span className="text-white/40">ง{p.n}</span>
      </div>
    );
  };

  const schoolScore = (code: string): number | null => {
    const s = hsByCode[code];
    if (!s) return null;
    let total = 0;
    for (const pos of Object.keys(SCORE_W)) {
      if (!posToggles[pos]) continue;
      const p = s[pos];
      if (p) total += (p.exact || 0) * SCORE_W[pos].exact + (p.swapped || 0) * SCORE_W[pos].swapped;
    }
    return total;
  };

  // คะแนนสะสมของศาสตร์เฉพาะตำแหน่งเดียว — ใช้จัดอันดับว่าจะเอาศาสตร์ไหนมานับเลขซ้ำ
  const posScoreCum = (code: string, pos: string): number => {
    const p = hsByCode[code]?.[pos];
    return p ? (p.exact || 0) * SCORE_W[pos].exact + (p.swapped || 0) * SCORE_W[pos].swapped : 0;
  };

  // นับว่าหลักเลขใดโผล่บ่อยที่สุดในแต่ละช่อง (เช่น 6=5 คือเลข 6 ปรากฏ 5 ครั้ง)
  // เอา 4 อันดับแรก. เสมอกันให้เรียงเลขน้อยก่อน เพื่อให้ผลเหมือนเดิมทุกครั้ง
  // ที่เปิดหน้าเดียวกัน (determinism §4.21.4). "3 ล่าง" นับแยกทีละชุด.
  const schoolsWithNumbers = ((data?.schools ?? []) as SchoolOut[]).filter((s) => s.numbers);
  const rankDigits = (
    pick: (n: NonNullable<SchoolOut["numbers"]>) => (string | null | undefined)[],
    schools: SchoolOut[] = schoolsWithNumbers,
  ): [string, number][] => {
    const counts = new Map<string, number>();
    for (const s of schools) {
      if (!s.numbers) continue;
      for (const v of pick(s.numbers)) {
        if (!v) continue;
        for (const ch of v) {
          if (ch >= "0" && ch <= "9") counts.set(ch, (counts.get(ch) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
      .slice(0, 4);
  };

  // ช่องกรอกเหนือคอลัมน์ 3 บน: เอาเฉพาะศาสตร์ที่คะแนนสะสมของ 3 บน สูงสุด N
  // อันดับแรกมานับ (ว่าง/0 = ใช้ทุกศาสตร์). คะแนนเท่ากันเรียงตามรหัสวิชา
  // เพื่อไม่ให้ลำดับสลับไปมาระหว่างการ render.
  // ศาสตร์ที่เอามานับของคอลัมน์นั้น: เรียงตามคะแนนสะสมของคอลัมน์เอง มากไปน้อย
  // แล้วตัด N อันดับแรก (ว่าง/0 = ใช้ทุกศาสตร์). คะแนนเท่ากันเรียงตามรหัสวิชา
  // เพื่อไม่ให้ลำดับสลับไปมาระหว่างการ render.
  const schoolsForPos = (pos: string): SchoolOut[] => {
    const n = parseInt(countN[pos], 10);
    const limit =
      Number.isFinite(n) && n > 0
        ? Math.min(n, schoolsWithNumbers.length)
        : schoolsWithNumbers.length;
    return [...schoolsWithNumbers]
      .sort(
        (a, b) =>
          posScoreCum(b.code, pos) - posScoreCum(a.code, pos) ||
          a.code.localeCompare(b.code),
      )
      .slice(0, limit);
  };

  const digitRanks: Record<string, [string, number][]> = {
    top3: rankDigits((n) => [n.top3], schoolsForPos("top3")),
    top2: rankDigits((n) => [n.top2], schoolsForPos("top2")),
    bottom2: rankDigits((n) => [n.bottom2], schoolsForPos("bottom2")),
  };
  const set3Schools = schoolsForPos("set3");
  const set3Ranks: [string, number][][] = [0, 1, 2, 3].map((idx) =>
    rankDigits((n) => [n.set3?.[idx]], set3Schools),
  );
  const hasDigitRanks =
    Object.values(digitRanks).some((r) => r.length > 0) ||
    set3Ranks.some((r) => r.length > 0);

  // ดัชนี (§14): คะแนนสะสม ÷ จำนวนงวดที่นำมาคำนวณ = คะแนนเฉลี่ยต่องวด.
  const schoolIndex = (code: string): number | null => {
    const sc = schoolScore(code);
    const n = hitSummary?.n_draws ?? 0;
    return sc != null && n ? sc / n : null;
  };

  const schoolTotalTaem = (code: string): number | null => {
    const sc = schoolScore(code);
    const n = hitSummary?.n_draws ?? 0;
    if (sc == null || !n) return null;
    return sc - costPerDraw * n;
  };

  // §16 บรรทัดที่ 3 ในช่องเลข = ค − ต ต่อแต่ละตำแหน่ง (คิดจาก "งวดนี้")
  //   ค = คะแนนของงวดนี้: ถ้าทายตรง = นน.ตรง, สลับ = นน.สลับ, ไม่ตรง = 0
  //       (นน. = SCORE_W ตำแหน่งนั้น เช่น 3บน ตรง 550 / สลับ 100)
  //   ต = ผลรวมค่าช่องกรอกของตำแหน่งนั้น (เช่น 3บน = 3บน1 + 3บน2)
  const POS_INPUTS: Record<string, string[]> = {
    top3: ["3บน1", "3บน2"],
    top2: ["2บน1", "2บน2"],
    bottom2: ["2ล่าง1", "2ล่าง2"],
    set3: ["3ล่าง4"],
  };
  const line3 = (s: SchoolOut, pos: string) => {
    if (!actual || !s.numbers) return null;
    let kha: number;
    if (pos === "set3") {
      const acts = ((actual.set3 ?? []) as (string | null)[]).filter(Boolean) as string[];
      const sets = s.numbers.set3 ?? [];
      kha = sets.some((v) => acts.some((a) => a === v))
        ? SCORE_W.set3.exact
        : sets.some((v) => acts.some((a) => permHit(v, a)))
          ? SCORE_W.set3.swapped
          : 0;
    } else {
      kha = posScore(pos, (s.numbers as any)[pos], (actual as any)[pos]);
    }
    const tor = (POS_INPUTS[pos] || []).reduce((sum, name) => sum + (parseFloat(tblInputs[name]) || 0), 0);
    const value = kha - tor;
    // แสดงเป็นสมการ ค−ต=value (§16 ข้อ 4).
    return (
      <div
        className="whitespace-nowrap text-[10px] font-normal leading-none text-sky-300/80"
        title="ค (คะแนนงวดนี้ของตำแหน่งนี้) − ต (ผลรวมช่องกรอก) = ค่า (§16)"
      >
        {kha.toLocaleString()}-{tor.toLocaleString()}={value.toLocaleString()}
      </div>
    );
  };

  // คะแนนเฉพาะ "งวดนี้" (§11): เทียบเลขที่คำนวณของศาสตร์กับผลจริงของงวดที่เลือก
  // ด้วยน้ำหนักเดียวกับคอลัมน์คะแนน (ถูกตรง/ถูกสลับ ต่อแต่ละตำแหน่ง).
  const posScore = (pos: string, pred?: string, act?: string) =>
    exactHit(pred, act) ? SCORE_W[pos].exact : permHit(pred, act) ? SCORE_W[pos].swapped : 0;
  const drawScore = (s: SchoolOut): number | null => {
    if (!actual || s.status === "NOT AVAILABLE" || !s.numbers) return null;
    let total = 0;
    if (posToggles.top3) total += posScore("top3", s.numbers.top3, actual.top3);
    if (posToggles.top2) total += posScore("top2", s.numbers.top2, actual.top2);
    if (posToggles.bottom2) total += posScore("bottom2", s.numbers.bottom2, actual.bottom2);
    if (posToggles.set3) {
      const acts = ((actual.set3 ?? []) as (string | null)[]).filter(Boolean) as string[];
      const sets = s.numbers.set3 ?? [];
      if (sets.some((v) => acts.some((a) => a === v))) total += SCORE_W.set3.exact;
      else if (sets.some((v) => acts.some((a) => permHit(v, a)))) total += SCORE_W.set3.swapped;
    }
    return total;
  };

  // แต้ม = ผลรวม (ค−ต) เฉพาะตำแหน่งที่ toggle เปิดอยู่
  const taemScore = (s: SchoolOut): number | null => {
    if (!actual || s.status === "NOT AVAILABLE" || !s.numbers) return null;
    let total = 0;
    for (const pos of Object.keys(SCORE_W)) {
      if (!posToggles[pos]) continue;
      let kha: number;
      if (pos === "set3") {
        const acts = ((actual.set3 ?? []) as (string | null)[]).filter(Boolean) as string[];
        const sets = s.numbers.set3 ?? [];
        kha = sets.some((v) => acts.some((a) => a === v))
          ? SCORE_W.set3.exact
          : sets.some((v) => acts.some((a) => permHit(v, a)))
            ? SCORE_W.set3.swapped
            : 0;
      } else {
        kha = posScore(pos, (s.numbers as any)[pos], (actual as any)[pos]);
      }
      const tor = (POS_INPUTS[pos] || []).reduce((sum, name) => sum + (parseFloat(tblInputs[name]) || 0), 0);
      total += kha - tor;
    }
    return total;
  };

  // ลำดับตามคะแนน (คะแนนมากสุด = ลำดับ 1, คะแนนเท่ากันได้ลำดับเดียวกัน).
  const rankMap = (scoreOf: (s: SchoolOut) => number | null): Record<string, number> => {
    const out: Record<string, number> = {};
    const scored = ((data?.schools ?? []) as SchoolOut[])
      .map((s) => ({ code: s.code, score: scoreOf(s) }))
      .filter((x): x is { code: string; score: number } => x.score != null);
    for (const x of scored) out[x.code] = 1 + scored.filter((y) => y.score > x.score).length;
    return out;
  };
  const rankByCode = rankMap((s) => schoolScore(s.code)); // §12 ลำดับตามคะแนนสะสม
  const rankTotalTaemByCode = rankMap((s) => schoolTotalTaem(s.code));
  const rankInDrawByCode = rankMap((s) => drawScore(s));  // §13 ลำดับตามคะแนนงวดนี้

  // ช่อง "นับ N ศาสตร์" เหนือปุ่มของแต่ละคอลัมน์ — คุมว่าจะเอาศาสตร์กี่อันดับแรก
  // (เรียงตามคะแนนสะสมของคอลัมน์นั้น) มานับเลขซ้ำในแถวอันดับ 1–4.
  const countInput = (pos: string, label: string) => (
    <label
      className="flex items-center gap-1 rounded bg-sky-500/20 px-1 py-0.5 ring-1 ring-sky-400/40"
      title={`นับเลขซ้ำจากศาสตร์ที่มีคะแนนสะสมของ ${label} สูงสุดกี่อันดับ (ทั้งหมด ${schoolsWithNumbers.length} ศาสตร์)`}
    >
      <span className="whitespace-nowrap text-[10px] font-normal text-sky-300/80">นับ</span>
      <input
        type="number"
        min={1}
        value={countN[pos] ?? ""}
        onChange={(e) =>
          setCountN((v) => ({ ...v, [pos]: e.target.value.replace(/\D/g, "") }))
        }
        className="w-11 rounded border border-sky-400/40 bg-navy px-1 py-0.5 text-center text-sky-100"
      />
      <span className="whitespace-nowrap text-[10px] font-normal text-sky-300/80">ศาสตร์</span>
    </label>
  );

  // ช่องกรอกค่าบนหัวตาราง (§15): กลุ่มละ 1–2 ช่อง วางตรงคอลัมน์ 3บน/2บน/2ล่าง/3ล่าง.
  const inputCell = (names: string[]) => (
    <div className="flex flex-col items-center gap-1">
      {names.map((n) => (
        <label key={n} className="flex items-center gap-1 text-[10px] font-normal text-white/70">
          <span className="whitespace-nowrap">{n}</span>
          <input
            type="number"
            value={tblInputs[n] ?? ""}
            onChange={(e) => setTblInputs((v) => ({ ...v, [n]: e.target.value }))}
            className="w-12 rounded border border-white/20 bg-navy px-1 py-0.5 text-center text-white"
          />
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-h-80 w-auto min-w-[140px] max-w-xs overflow-y-auto rounded-xl border border-white/15 bg-[#0d2347]/95 px-3 py-2 shadow-2xl backdrop-blur-md"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%) translateY(-8px)" }}
        >
          <div className={`mb-1 text-[10px] font-semibold ${tooltip.type === "ถูกตรง" ? "text-amber-300" : "text-green-300"}`}>
            {tooltip.type} {tooltip.dates.length} งวด
          </div>
          <div className="space-y-0.5">
            {tooltip.dates.map((d, i) => (
              <div key={i} className="text-[10px] tabular-nums text-white/70">{i + 1}. {isoToThai(d)}</div>
            ))}
          </div>
        </div>
      )}
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          วันที่ (พ.ศ.)
          <ThaiDateInput
            value={date}
            onChange={setDate}
            onPick={(iso) => run(iso)}
            options={dbDates}
            className={`ml-2 rounded border px-2 py-1 text-white ${
              dbDates.includes(date) ? "border-green-400 bg-green-500/15" : "border-white/20 bg-navy"
            }`}
          />
        </label>
        <label className="text-sm">
          เวลา
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                 className="ml-2 rounded bg-navy px-2 py-1 text-white" />
        </label>
        <button className="btn" onClick={() => run()} disabled={loading}>
          {loading ? "กำลังคำนวณ…" : "คำนวณ"}
        </button>
        {dbDates.includes(date) && (
          <span className="badge border-green-400/60 text-green-300">✓ มีผลรางวัลย้อนหลัง</span>
        )}
      </div>

      {/* §10 ช่วงวันที่คิด "คะแนน" สะสม (ค่าเริ่มต้น = ทั้งฐานข้อมูล) */}
      <div className="card flex flex-nowrap items-center gap-3 overflow-x-auto">
        <span className="whitespace-nowrap text-sm text-gold">ช่วงคิดคะแนนสะสม</span>
        <label className="whitespace-nowrap text-sm">
          เริ่มต้น
          <ThaiDateInput
            value={scoreStart}
            onChange={(v) => setScoreStart(v || (dbDates.length ? dbDates[dbDates.length - 1] : ""))}
            onPick={setScoreStart}
            options={dbDates}
            className="ml-2 w-28 rounded border border-white/20 bg-navy px-2 py-1 text-white"
          />
        </label>
        <label className="whitespace-nowrap text-sm">
          สิ้นสุด
          <ThaiDateInput
            value={scoreEnd}
            onChange={(v) => setScoreEnd(v || (dbDates.length ? dbDates[0] : ""))}
            onPick={setScoreEnd}
            options={dbDates}
            className="ml-2 w-28 rounded border border-white/20 bg-navy px-2 py-1 text-white"
          />
        </label>
        {hitSummary?.window && (
          <span className="badge whitespace-nowrap border-white/30 text-white/70">
            {hitSummary.n_draws} งวด · {isoToThai(hitSummary.window[0])} – {isoToThai(hitSummary.window[1])}
          </span>
        )}
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
              <span
                className={`badge ${data.v5?.ok ? "border-green-400/60 text-green-300" : "border-red-400/60 text-red-300"}`}
                title="ชั้นวินัย V5 ทำงานอยู่ (§4.21)"
              >
                §4.21 V5: {data.v5?.ok ? "ACTIVE" : data.v5?.failure_state} · Self-Check{" "}
                {data.v5?.self_check?.passed}/{data.v5?.self_check?.total} ·{" "}
                {data.v5?.banned_found?.length ? `พบคำต้องห้าม ${data.v5.banned_found.length}` : "ไม่มีคำต้องห้าม"}
              </span>
            </div>
            <div className="text-sm text-white/80">
              สี่เสา: <b>{data.pillars?.year?.gz} {data.pillars?.month?.gz} {data.pillars?.day?.gz} {data.pillars?.hour?.gz}</b>
              {"  ·  "}เจ้าชะตา: <b>{data.power?.label}</b> (A={data.power?.A}, B={data.power?.B})
            </div>
          </div>

          {!actual && (
            <div className="card text-xs text-white/50">
              วันที่นี้ยังไม่มีผลรางวัลจริงในฐานข้อมูล (เช่น เป็นวันที่อนาคต) — แสดงเฉพาะเลขที่คำนวณได้
            </div>
          )}

          <div className="card overflow-x-auto">
            {actual && (
              <p className="mb-2 text-xs text-white/50">
                แถวทองด้านบน = ผลรางวัลจริงจากฐานข้อมูล ·{" "}
                <span className="rounded px-1 bg-amber-400/30 font-bold text-amber-100 ring-1 ring-amber-300">ทอง</span>{" "}
                = ตรงเป๊ะ (ไม่สลับ) ·{" "}
                <span className="rounded px-1 bg-green-500/25 font-semibold text-green-200">เขียว</span>{" "}
                = ตรงแบบสลับตำแหน่ง
              </p>
            )}
            <p className="mb-2 text-xs text-white/50">
              เลขเล็กใต้แต่ละช่อง = สถิติย้อนหลังตามช่วงที่เลือก{" "}
              <span className="text-amber-300/80">ต</span>=ถูกตรง{" "}
              <span className="text-green-300/80">ส</span>=ถูกสลับ{" "}
              <span className="text-white/50">ง</span>=จำนวนงวดที่คำนวณ (เช่น{" "}
              <span className="text-amber-300/80">ต5</span>/<span className="text-green-300/80">ส9</span>/
              <span className="text-white/50">ง300</span>)
            </p>
            <p className="mb-2 text-xs text-white/50">
              <span className="text-gold">คะแนน</span> = คะแนนสะสมช่วงที่เลือก ·{" "}
              <span className="text-gold">งวดนี้</span> = คะแนนเฉพาะงวด {isoToThai(date)} ·
              น้ำหนัก (ตรง/สลับ): 3บน 550/100 · 2บน 70/35 · 2ล่าง 70/35 · 3ล่าง 100/33
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-navy/60">
                  <th colSpan={9} className="text-right text-xs font-normal text-white/50">
                    ซื้อ →
                  </th>
                  <th className="px-1">{inputCell(["3บน1", "3บน2"])}</th>
                  <th className="px-1">{inputCell(["2บน1", "2บน2"])}</th>
                  <th className="px-1">{inputCell(["2ล่าง1", "2ล่าง2"])}</th>
                  <th className="px-1">{inputCell(["3ล่าง4"])}</th>
                  <th />
                </tr>
                <tr className="bg-navy text-gold align-bottom">
                  <th>
                    <div className="flex items-center gap-3">
                      <span>ศาสตร์</span>
                      <button
                        type="button"
                        onClick={() => setAnalyzeOn((v) => !v)}
                        className={`group relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-lg px-3.5 text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                          analyzeOn
                            ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-[#071634] shadow-[0_0_16px_rgba(245,158,11,0.35)]"
                            : "border border-white/15 bg-white/[0.04] text-white/50 hover:border-amber-400/30 hover:bg-amber-500/[0.08] hover:text-amber-200/80 hover:shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                        }`}
                        title="วิเคราะห์วิชา — เปรียบเทียบดัชนี/คะแนน/แต้ม ทั้ง 18 วิชา"
                      >
                        {analyzeOn && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" style={{ animationTimingFunction: "ease-in-out" }} />}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`relative h-3.5 w-3.5 transition-transform duration-300 ${analyzeOn ? "rotate-0" : "-rotate-12 opacity-60 group-hover:rotate-0 group-hover:opacity-100"}`}>
                          <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                        </svg>
                        <span className="relative">วิเคราะห์วิชา</span>
                      </button>
                    </div>
                  </th>
                  <th>
                    <div className="leading-tight">ดัชนี
                      <br /><span className="text-xs font-normal text-gold/70">(คะแนน/งวด)</span>
                    </div>
                  </th>
                  <th>
                    <div className="leading-tight">ได้เงินทั้งหมด
                      <br /><span className="text-xs font-normal text-gold/70">({hitSummary?.n_draws ?? "—"} งวด)</span>
                    </div>
                  </th>
                  <th className="w-14 px-1">
                    <div className="leading-tight">กำไร
                      <br /><span className="text-[9px] font-normal text-gold/70">ได้เงิน−ต้นทุน</span>
                    </div>
                  </th>
                  <th className="w-8 px-1">ลำดับ</th>
                  <th className="w-8 px-1">อันดับ</th>
                  <th className="w-10 px-1">
                    <div className="leading-tight">ได้เงินงวดนี้
                      <br /><span className="text-[9px] font-normal text-gold/70">{isoToThai(date)}</span>
                    </div>
                  </th>
                  <th className="w-8 px-1">ลำดับ</th>
                  <th className="w-12 px-1">เหลือเงิน</th>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      {countInput("top3", "3 บน")}
                      <button type="button" onClick={() => togglePos("top3")}
                        className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${posToggles.top3 ? "bg-amber-500/40 text-amber-100 ring-1 ring-amber-400" : "bg-white/10 text-white/40"}`}>
                        3 บน
                      </button>
                    </div>
                  </th>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      {countInput("top2", "2 บน")}
                      <button type="button" onClick={() => togglePos("top2")}
                        className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${posToggles.top2 ? "bg-amber-500/40 text-amber-100 ring-1 ring-amber-400" : "bg-white/10 text-white/40"}`}>
                        2 บน
                      </button>
                    </div>
                  </th>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      {countInput("bottom2", "2 ล่าง")}
                      <button type="button" onClick={() => togglePos("bottom2")}
                        className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${posToggles.bottom2 ? "bg-amber-500/40 text-amber-100 ring-1 ring-amber-400" : "bg-white/10 text-white/40"}`}>
                        2 ล่าง
                      </button>
                    </div>
                  </th>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      {countInput("set3", "3 ล่าง")}
                      <button type="button" onClick={() => togglePos("set3")}
                        className={`cursor-pointer rounded px-2 py-0.5 transition-colors ${posToggles.set3 ? "bg-amber-500/40 text-amber-100 ring-1 ring-amber-400" : "bg-white/10 text-white/40"}`}>
                        <div className="leading-tight">3 ล่าง<br /><span className="text-xs font-normal">(ชุด 1–4)</span></div>
                      </button>
                    </div>
                  </th>
                  <th><div className="leading-tight">backtest<br /><span className="text-xs font-normal">2 ล่าง</span></div></th>
                </tr>
                {actual && (
                  <tr className="border-y-2 border-gold bg-gold/20 text-white">
                    <th className="text-left text-gold">🎯 ผลจริง · {isoToThai(actual.date)}</th>
                    <th className="text-white/40">—</th>
                    <th className="text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="px-1 text-white/40">—</th>
                    <th className="font-mono text-base">{actual.top3 ?? "—"}</th>
                    <th className="font-mono text-base">{actual.top2 ?? "—"}</th>
                    <th className="font-mono text-base">{actual.bottom2 ?? "—"}</th>
                    <th className="font-mono text-base">
                      {(actual.set3 ?? []).map((x: string | null) => x ?? "—").join("  ")}
                    </th>
                    <th className="text-xs font-normal text-white/70">6 หลัก: {actual.six ?? "—"}</th>
                  </tr>
                )}
                {/* นับหลักเลขที่ซ้ำมากที่สุดในแต่ละช่อง ของทุกศาสตร์ — อันดับ 1–4 */}
                {hasDigitRanks &&
                  [0, 1, 2, 3].map((i) => {
                    const cell = (pos: string) => {
                      const entry = digitRanks[pos][i];
                      return entry ? `${entry[0]}=${entry[1]}` : "—";
                    };
                    return (
                      <tr
                        key={`digit-rank-${i}`}
                        className={`bg-sky-500/10 text-white ${i === 3 ? "border-b-2 border-sky-400/40" : ""}`}
                        title="นับว่าหลักเลขใดปรากฏบ่อยที่สุดในช่องนั้นของทุกศาสตร์ (3 ล่าง นับแยกทีละชุด)"
                      >
                        <th className="text-left text-xs font-normal text-sky-200">
                          นับเลขซ้ำ · อันดับ {i + 1}
                        </th>
                        <th className="text-white/25">—</th>
                        <th className="text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="px-1 text-white/25">—</th>
                        <th className="font-mono text-base text-sky-200">{cell("top3")}</th>
                        <th className="font-mono text-base text-sky-200">{cell("top2")}</th>
                        <th className="font-mono text-base text-sky-200">{cell("bottom2")}</th>
                        <th className="font-mono text-base text-sky-200">
                          <span className="inline-flex gap-2">
                            {set3Ranks.map((r, k) => {
                              const e = r[i];
                              return <span key={k}>{e ? `${e[0]}=${e[1]}` : "—"}</span>;
                            })}
                          </span>
                        </th>
                        <th className="text-white/25">—</th>
                      </tr>
                    );
                  })}
              </thead>
              <tbody>
                {[...(data.schools as SchoolOut[])]
                  .sort((a, b) => (schoolScore(b.code) ?? -1) - (schoolScore(a.code) ?? -1))
                  .map((s) => {
                  const b = summ[s.name]?.bottom2;
                  return (
                    <tr key={s.code}>
                      <td className="text-left">
                        <span className="font-semibold text-gold">
                          {(data.schools as SchoolOut[]).findIndex((x) => x.code === s.code) + 1}. {s.name}
                        </span>
                        <span className="ml-2 text-xs font-normal text-white/45">{schoolTh(s.code)}</span>
                      </td>
                      <td className="font-mono font-semibold text-sky-300" title="ดัชนี = คะแนน ÷ จำนวนงวดที่คำนวณ (§14)">
                        {schoolIndex(s.code) != null ? schoolIndex(s.code)!.toFixed(3) : "—"}
                      </td>
                      <td className="font-mono font-semibold text-gold" title="คะแนนถ่วงน้ำหนักจากสถิติย้อนหลัง ช่วงที่เลือก (§9)">
                        {schoolScore(s.code) != null ? schoolScore(s.code)!.toLocaleString() : "—"}
                      </td>
                      <td className={`px-1 font-mono font-semibold ${(schoolTotalTaem(s.code) ?? 0) > 0 ? "text-emerald-300" : (schoolTotalTaem(s.code) ?? 0) < 0 ? "text-red-300" : "text-white/40"}`}
                        title="ซื้อ = คะแนน − (ต้นทุนต่องวด × จำนวนงวด) ของตำแหน่งที่เปิด">
                        {schoolTotalTaem(s.code) != null ? schoolTotalTaem(s.code)!.toLocaleString() : "—"}
                      </td>
                      <td className="px-1 font-mono font-bold text-emerald-200" title="ลำดับตามซื้อ">
                        {schoolTotalTaem(s.code) != null ? rankTotalTaemByCode[s.code] ?? "—" : "—"}
                      </td>
                      <td className="px-1 font-mono font-bold text-white" title="ลำดับตามคะแนนสะสม (§12)">
                        {rankByCode[s.code] ?? "—"}
                      </td>
                      <td
                        className={`px-1 font-mono font-semibold ${drawScore(s) ? "text-amber-200" : "text-white/40"}`}
                        title="คะแนนเฉพาะงวดที่เลือก จากการเทียบเลขคำนวณกับผลจริง (§11)"
                      >
                        {drawScore(s) != null ? drawScore(s)!.toLocaleString() : "—"}
                      </td>
                      <td className="px-1 font-mono font-bold text-amber-200" title="ลำดับตามคะแนนงวดนี้ เฉพาะวิชาที่มีคะแนนงวดนี้ (§13)">
                        {drawScore(s) ? rankInDrawByCode[s.code] : "—"}
                      </td>
                      <td className={`px-1 font-mono font-semibold ${(taemScore(s) ?? 0) > 0 ? "text-emerald-300" : (taemScore(s) ?? 0) < 0 ? "text-red-300" : "text-white/40"}`}
                        title="แต้ม = ผลรวม (ค−ต) เฉพาะตำแหน่งที่เปิดอยู่">
                        {taemScore(s) != null ? taemScore(s)!.toLocaleString() : "—"}
                      </td>
                      {s.status === "NOT AVAILABLE" ? (
                        <td colSpan={4} className="text-white/50">
                          NOT AVAILABLE — {s.reason}
                        </td>
                      ) : (
                        <>
                          <td className={matchCls(s.numbers?.top3, actual?.top3)}>
                            {s.numbers?.top3}
                            {statLine(s.code, "top3")}
                            {line3(s, "top3")}
                          </td>
                          <td className={matchCls(s.numbers?.top2, actual?.top2)}>
                            {s.numbers?.top2}
                            {statLine(s.code, "top2")}
                            {line3(s, "top2")}
                          </td>
                          <td className={matchCls(s.numbers?.bottom2, actual?.bottom2)}>
                            {s.numbers?.bottom2}
                            {statLine(s.code, "bottom2")}
                            {line3(s, "bottom2")}
                          </td>
                          <td className="font-mono">
                            <span className="inline-flex gap-2">
                              {s.numbers?.set3?.map((v: string, i: number) => (
                                <span key={i} className={setMemberCls(v)}>
                                  {v}
                                </span>
                              ))}
                            </span>
                            {statLine(s.code, "set3")}
                            {line3(s, "set3")}
                          </td>
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

          {analyzeOn && (
            <div className="space-y-5">
              {/* ─── Header Card ─── */}
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 ring-1 ring-amber-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-gold">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="brand-grad text-lg font-bold leading-tight">วิเคราะห์วิชา</h3>
                      <p className="text-xs text-white/40">เปรียบเทียบดัชนี-คะแนน 18 วิชา แยกตามตำแหน่ง</p>
                    </div>
                  </div>
                  {analyzeLoading && (
                    <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 ring-1 ring-amber-500/20">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      <span className="text-xs text-gold">กำลังโหลด…</span>
                    </div>
                  )}
                </div>

                {/* ─── Position Tabs ─── */}
                <div className="mt-4 inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
                  {([["top3","3 บน","#ef4444"],["top2","2 บน","#f59e0b"],["bottom2","2 ล่าง","#22c55e"],["set3","3 ล่าง","#3b82f6"]] as [string,string,string][]).map(([k, label, clr]) => (
                    <button key={k} type="button" onClick={() => setAnalyzePos(k as typeof analyzePos)}
                      className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
                        analyzePos === k
                          ? "bg-white/[0.12] text-white shadow-lg"
                          : "text-white/40 hover:text-white/60"
                      }`}>
                      <span className="relative z-10 flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: clr, boxShadow: analyzePos === k ? `0 0 8px ${clr}` : "none" }} />
                        {label}
                      </span>
                      {analyzePos === k && (
                        <span className="absolute inset-x-0 -bottom-1 mx-auto h-0.5 w-8 rounded-full" style={{ background: clr }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Content Card ─── */}
              {allChartData && (() => {
                const { byPos, N, dates, schoolCodes } = allChartData;
                const posLabels: Record<string, string> = { top3: "3บน", top2: "2บน", bottom2: "2ล่าง", set3: "3ล่าง" };
                const posColors: Record<string, string> = { top3: "#ef4444", top2: "#f59e0b", bottom2: "#22c55e", set3: "#3b82f6" };
                const series = byPos[analyzePos];
                if (!series) return null;

                const ranked = schoolCodes
                  .map((c) => ({ code: c, name: analyzeData?.schools[c]?.name ?? c, idx: series[c]?.index[0] ?? 0, score: series[c]?.score[0] ?? 0 }))
                  .sort((a, b) => b.idx - a.idx);

                const idxValues = schoolCodes.map((c) => series[c]?.index[0] ?? 0);
                const maxIdx = Math.max(...idxValues);
                const minIdx = Math.min(...idxValues);
                const avgIdx = idxValues.reduce((a, b) => a + b, 0) / idxValues.length;

                const exportMultiCsv = () => {
                  const meta = [
                    `วิเคราะห์วิชา: ${schoolCodes.join(" ")}`,
                    `ตำแหน่ง: ${posLabels[analyzePos]}`,
                    "",
                  ];
                  const hdr = ["ลำดับ","เริ่มต้น","งวด",
                    ...schoolCodes.flatMap((c) => [`ดัชนี ${c}`, `คะแนน ${c}`])
                  ].join(",");
                  const rows = Array.from({ length: N }, (_, i) => {
                    const nDraws = N - i;
                    const cells = [i + 1, isoToThai(dates[i]), nDraws,
                      ...schoolCodes.flatMap((c) => {
                        const s = series[c];
                        return [s.index[i].toFixed(3), s.score[i]];
                      })
                    ];
                    return cells.join(",");
                  });

                  const MIN_DRAWS = 120;
                  const maxStart = N - MIN_DRAWS;
                  const lastDate = dates[N - 1];
                  const hdrSummary = "อันดับ,วิชา,จำนวนงวด,วันที่เริ่มต้น,วันที่สิ้นสุด,ดัชนี,คะแนน";

                  const rankSection = (posKey: string, posLabel: string, num: number) => {
                    const ps = byPos[posKey];
                    if (!ps || maxStart < 0) return [``,`${num}. ${posLabel}`,`ข้อมูลไม่ถึง ${MIN_DRAWS} งวด`];

                    const m1 = schoolCodes.map((c) => {
                      const idx = ps[c]?.index ?? [];
                      const sc = ps[c]?.score ?? [];
                      let bestI = 0;
                      for (let j = 1; j <= maxStart; j++) { if (idx[j] > idx[bestI]) bestI = j; }
                      return { code: c, name: analyzeData?.schools[c]?.name ?? c, idx: idx[bestI] ?? 0, score: sc[bestI] ?? 0, nDraws: N - bestI, start: dates[bestI] ?? "" };
                    }).sort((a, b) => b.idx - a.idx);

                    const m2 = schoolCodes.map((c) => {
                      const sc = ps[c]?.score ?? [];
                      let bestI = 0, bestLen = MIN_DRAWS, bestIdx = -Infinity;
                      for (let start = 0; start <= N - MIN_DRAWS; start++) {
                        for (let end = start + MIN_DRAWS; end <= N; end++) {
                          const len = end - start;
                          const wScore = sc[start] - (end < N ? sc[end] : 0);
                          const wIdx = wScore / len;
                          if (wIdx > bestIdx) { bestIdx = wIdx; bestI = start; bestLen = len; }
                        }
                      }
                      const bestScore = sc[bestI] - (bestI + bestLen < N ? sc[bestI + bestLen] : 0);
                      return { code: c, name: analyzeData?.schools[c]?.name ?? c, idx: bestIdx, score: bestScore, nDraws: bestLen, start: dates[bestI] ?? "", end: dates[Math.min(bestI + bestLen - 1, N - 1)] ?? "" };
                    }).sort((a, b) => b.idx - a.idx);

                    return [
                      "", `${num}. ${posLabel}`, "",
                      `วิธี 2.1 — ดัชนีสูงสุด (ลดจากเก่าสุดทีละ 1 งวด, ไม่น้อยกว่า ${MIN_DRAWS} งวด)`,
                      hdrSummary,
                      ...m1.map((r, i) => `${i + 1},${r.code} ${r.name},${r.nDraws},${isoToThai(r.start)},${isoToThai(lastDate)},${r.idx.toFixed(3)},${r.score}`),
                      "",
                      `วิธี 2.2 — ดัชนีสูงสุด (สุ่มทุกช่วงต่อเนื่อง ไม่น้อยกว่า ${MIN_DRAWS} งวด)`,
                      hdrSummary,
                      ...m2.map((r, i) => `${i + 1},${r.code} ${r.name},${r.nDraws},${isoToThai(r.start)},${isoToThai(r.end)},${r.idx.toFixed(3)},${r.score}`),
                    ];
                  };

                  const summary = [
                    "", "",
                    `สรุปเรียงลำดับตามดัชนีสูงสุด (จาก ${N} งวด, ขั้นต่ำ ${MIN_DRAWS} งวด)`,
                    ...rankSection("top3", "3 บน", 1),
                    ...rankSection("top2", "2 บน", 2),
                    ...rankSection("bottom2", "2 ล่าง", 3),
                    ...rankSection("set3", "3 ล่าง (ชุด 1–4)", 4),
                  ];

                  const csv = "﻿" + [...meta, hdr, ...rows, ...summary].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `วิเคราะห์_${posLabels[analyzePos]}_ทุกวิชา.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                };

                const idxHeatColor = (val: number) => {
                  const range = maxIdx - minIdx || 1;
                  const t = (val - minIdx) / range;
                  if (t > 0.7) return "rgba(34,197,94,0.15)";
                  if (t > 0.4) return "rgba(250,204,21,0.08)";
                  return "transparent";
                };

                return (
                  <>
                    {/* ─── Stats Row ─── */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30">จำนวนวิชา</div>
                        <div className="mt-1 text-xl font-bold text-white">{schoolCodes.length}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30">จำนวนงวด</div>
                        <div className="mt-1 text-xl font-bold text-white">{N}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30">ดัชนีสูงสุด</div>
                        <div className="mt-1 text-xl font-bold text-emerald-400">{maxIdx.toFixed(3)}</div>
                        <div className="text-[10px] text-white/40">{ranked[0].code} {ranked[0].name}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-white/30">ดัชนีเฉลี่ย</div>
                        <div className="mt-1 text-xl font-bold text-amber-300">{avgIdx.toFixed(3)}</div>
                      </div>
                    </div>

                    {/* ─── Top 5 Schools ─── */}
                    <div className="card">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white/70">
                          <span className="mr-2 inline-block h-3 w-1 rounded-full" style={{ background: posColors[analyzePos] }} />
                          Top 5 — {posLabels[analyzePos]}
                        </h4>
                        <button type="button" onClick={exportMultiCsv}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-green-900/40 transition-all hover:from-emerald-500 hover:to-green-500 hover:shadow-lg hover:-translate-y-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                          </svg>
                          Export CSV
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {ranked.slice(0, 5).map((r, i) => (
                          <div key={r.code} className="group relative overflow-hidden rounded-xl border border-white/10 p-3 transition-all hover:border-white/20 hover:shadow-lg"
                            style={{ background: `linear-gradient(135deg, ${SCHOOL_COLORS[r.code]}08, ${SCHOOL_COLORS[r.code]}03)` }}>
                            <div className="absolute -right-2 -top-2 text-[3rem] font-black leading-none text-white/[0.03]">
                              {i + 1}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                                style={{ background: SCHOOL_COLORS[r.code] + "cc" }}>
                                {i + 1}
                              </span>
                              <span className="text-xs font-semibold" style={{ color: SCHOOL_COLORS[r.code] }}>{r.code}</span>
                            </div>
                            <div className="mt-1 truncate text-[10px] text-white/50">{r.name}</div>
                            <div className="mt-2 text-lg font-bold tabular-nums text-white">{r.idx.toFixed(3)}</div>
                            <div className="text-[10px] text-white/30">คะแนน {r.score.toLocaleString()}</div>
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${maxIdx ? (r.idx / maxIdx) * 100 : 0}%`,
                                background: `linear-gradient(90deg, ${SCHOOL_COLORS[r.code]}aa, ${SCHOOL_COLORS[r.code]}55)`,
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ─── Data Table ─── */}
                    <div className="card p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/40">
                            {N} แถว × {schoolCodes.length} วิชา
                          </span>
                          {highlightSchool && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-white/60 ring-1 ring-white/10">
                              เน้น: <b style={{ color: SCHOOL_COLORS[highlightSchool] }}>{highlightSchool}</b>
                              <button type="button" onClick={() => setHighlightSchool(null)} className="ml-1 text-white/30 hover:text-white/60">×</button>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[600px] overflow-auto rounded-xl border border-white/[0.08] shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)]">
                        <table className="border-collapse text-[11px]">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-gradient-to-r from-[#0d2347] via-[#0f2850] to-[#0a1e3d]">
                              <th rowSpan={2} className="sticky left-0 z-20 border-b border-r border-white/[0.08] bg-[#0d2347] px-2 py-1.5 text-gold/80 font-semibold">ลำดับ</th>
                              <th rowSpan={2} className="sticky left-[3rem] z-20 border-b border-r border-white/[0.08] bg-[#0d2347] px-2 py-1.5 text-gold/80 font-semibold">เริ่มต้น</th>
                              <th rowSpan={2} className="sticky left-[8.5rem] z-20 border-b border-r border-white/[0.08] bg-[#0d2347] px-2 py-1.5 text-gold/80 font-semibold">งวด</th>
                              {schoolCodes.map((code) => (
                                <th key={code} colSpan={2}
                                  className="cursor-pointer border-b border-r border-white/[0.08] px-1 py-1.5 text-center transition-colors hover:bg-white/[0.06]"
                                  style={{ color: SCHOOL_COLORS[code], borderBottomColor: highlightSchool === code ? SCHOOL_COLORS[code] + "88" : undefined, borderBottomWidth: highlightSchool === code ? 2 : undefined }}
                                  onClick={() => setHighlightSchool(highlightSchool === code ? null : code)}>
                                  <span className="text-[10px]">{code}</span>
                                  <br />
                                  <span className="text-[9px] opacity-60">{analyzeData?.schools[code]?.name}</span>
                                </th>
                              ))}
                            </tr>
                            <tr className="bg-[#0a1e3d]">
                              {schoolCodes.map((code) => (
                                <React.Fragment key={code}>
                                  <th className="border-b border-r border-white/[0.08] px-1 py-1 text-[10px] text-sky-300/60 font-medium">ดัชนี</th>
                                  <th className="border-b border-r border-white/[0.08] px-1 py-1 text-[10px] text-gold/60 font-medium">คะแนน</th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: N }, (_, i) => {
                              const nDraws = N - i;
                              return (
                                <tr key={i} className={`transition-colors hover:bg-white/[0.05] ${i % 2 === 0 ? "bg-white/[0.012]" : ""}`}>
                                  <td className="sticky left-0 z-10 border-r border-white/5 bg-[#071634] px-2 py-1 font-mono text-[10px] text-white/25">{i + 1}</td>
                                  <td className="sticky left-[3rem] z-10 border-r border-white/5 bg-[#071634] px-2 py-1 whitespace-nowrap text-white/60 text-[10px]">{isoToThai(dates[i])}</td>
                                  <td className="sticky left-[8.5rem] z-10 border-r border-white/5 bg-[#071634] px-2 py-1 text-right font-mono text-[10px] text-white/40">{nDraws}</td>
                                  {schoolCodes.map((code) => {
                                    const s = series[code];
                                    if (!s) return <td key={code} colSpan={2} className="px-1 text-white/20">—</td>;
                                    const isHl = highlightSchool === code;
                                    return (
                                      <React.Fragment key={code}>
                                        <td className="border-r border-white/5 px-1 py-1 text-right font-mono tabular-nums"
                                          style={{
                                            color: isHl ? "#7dd3fc" : "rgba(125,211,252,0.5)",
                                            background: isHl ? "rgba(56,189,248,0.08)" : idxHeatColor(s.index[i]),
                                            fontWeight: isHl ? 600 : 400,
                                          }}>
                                          {s.index[i].toFixed(3)}
                                        </td>
                                        <td className="border-r border-white/5 px-1 py-1 text-right font-mono tabular-nums"
                                          style={{
                                            color: isHl ? "#fcd34d" : "rgba(252,211,77,0.45)",
                                            background: isHl ? "rgba(252,211,77,0.06)" : "transparent",
                                            fontWeight: isHl ? 600 : 400,
                                          }}>
                                          {s.score[i].toLocaleString()}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {data.catalog && (
            <div className="card">
              <div className="mb-2 text-gold">
                แคตตาล็อก {data.catalog.total_vicha} วิชา ·{" "}
                <span className="text-white/70">
                  Production {data.catalog.summary.production} · วินัย V5 1
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
                18 ศาสตร์คำนวณจริง (deterministic + ผ่าน backtest §6) · §4.21 เป็นชั้นวินัย V5 ไม่ใช่ศาสตร์สร้างเลข ·
                §4.13/4.14 ถูกตัดออกจากโปรเจกต์ (spec ห้ามทำเป็น deterministic module)
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
