/**
 * Excel -> Postgres import with validation + Data Quality Report (spec §PHASE-1).
 *
 * Numbers are kept as strings (leading zeros are law, §4.21.4). The pre-2015
 * `set2` column is legitimately empty and is NOT counted as an error.
 *
 * Usage: DATABASE_URL=... DATA_XLSX=../../data/thai.xlsx pnpm import
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const DATA = process.env.DATA_XLSX ?? "../../data/thai.xlsx";
const HEADER_KEY = "งวดวันที่";
const DIGITS = /^\d+$/;

type Row = (string | number | Date | null)[];

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  return null;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  const buf = readFileSync(DATA);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, blankrows: false });

  // Locate the header row containing "งวดวันที่".
  const headerIdx = rows.findIndex((r) => typeof r[0] === "string" && (r[0] as string).trim() === HEADER_KEY);
  if (headerIdx < 0) throw new Error(`Header '${HEADER_KEY}' not found`);

  const report = {
    total: 0, valid: 0, dateErrors: 0, lengthErrors: 0, duplicates: 0, set2Nulls: 0,
    issues: [] as string[],
  };
  const seen = new Set<string>();
  const records: any[] = [];

  const expect: Record<number, number> = { 2: 3, 3: 2, 4: 2 }; // col -> length (top3,top2,bottom2)

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;
    report.total++;

    const date = parseDate(row[0]);
    if (!date) { report.dateErrors++; report.issues.push(`row ${i + 1}: bad date ${String(row[0])}`); continue; }
    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) { report.duplicates++; report.issues.push(`row ${i + 1}: duplicate ${key}`); }
    seen.add(key);

    const six = clean(row[1]);
    const top3 = clean(row[2]);
    const top2 = clean(row[3]);
    const bottom2 = clean(row[4]);
    const sets = [clean(row[5]), clean(row[6]), clean(row[7]), clean(row[8])];

    let ok = true;
    for (const [col, val] of [[2, top3], [3, top2], [4, bottom2]] as [number, string | null][]) {
      if (val === null) continue;
      if (!DIGITS.test(val) || val.length !== expect[col]) {
        report.lengthErrors++; report.issues.push(`row ${i + 1}: col${col}=${val} invalid`); ok = false;
      }
    }
    sets.forEach((s, idx) => {
      if (s === null) { if (idx === 1) report.set2Nulls++; return; }
      if (!DIGITS.test(s) || s.length !== 3) { report.lengthErrors++; report.issues.push(`row ${i + 1}: set${idx + 1}=${s} invalid`); ok = false; }
    });

    let drawTime: string | null = null;
    const t = row[9];
    if (t instanceof Date) drawTime = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    else if (typeof t === "number") { const mins = Math.round(t * 24 * 60); drawTime = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`; }
    else if (typeof t === "string") drawTime = t.trim() || null;

    records.push({ date, six, top3, top2, bottom2, set1: sets[0], set2: sets[1], set3: sets[2], set4: sets[3], drawTime });
    if (ok) report.valid++;
  }

  const err = report.dateErrors + report.lengthErrors + report.duplicates;
  const ratio = report.total ? err / report.total : 1;
  const grade = err === 0 ? "A" : ratio < 0.01 ? "B" : ratio < 0.05 ? "C" : "D";

  // Upsert (Excel is source of truth; re-import is idempotent).
  for (const r of records) {
    await prisma.draw.upsert({ where: { date: r.date }, update: r, create: r });
  }

  const reportText = [
    "=== Data Quality Report ===",
    `Total rows    : ${report.total}`,
    `Valid rows    : ${report.valid}`,
    `Date errors   : ${report.dateErrors}`,
    `Length errors : ${report.lengthErrors}`,
    `Duplicates    : ${report.duplicates}`,
    `set2 nulls    : ${report.set2Nulls} (expected pre-2015)`,
    `GRADE         : ${grade}`,
  ].join("\n");
  console.log(reportText);
  if (report.issues.length) console.log("issues:", report.issues.slice(0, 20));

  await prisma.importRun.create({
    data: {
      totalRows: report.total, validRows: report.valid, dateErrors: report.dateErrors,
      lengthErrors: report.lengthErrors, duplicates: report.duplicates,
      set2Nulls: report.set2Nulls, grade, reportText,
    },
  });

  if (grade === "D") {
    console.error("QUALITY GATE FAILED (grade D) — stopping (guardrail #8).");
    process.exit(2);
  }
  console.log(`Imported ${records.length} draws. Grade ${grade}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
