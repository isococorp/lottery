// GLO (สำนักงานสลากกินแบ่งรัฐบาล) result feed — the ONLY external data source.
//
// The public API exposes the LATEST draw only; there is no historical lookup,
// so this module deliberately offers just `fetchLatestDraw()`.
//
// Column mapping (ชุด 1–4) was derived from the three rule-eras visible in
// data/thai.xlsx, where a column "switches on" exactly at each GLO rule change:
//   1996-01-16 .. 2005-12-30  X . X X   เลขหน้า 1 รางวัล + เลขท้าย 2 รางวัล
//   2006-12-30 .. 2015-08-16  . . X X   เลขหน้า ถูกยกเลิก, เลขท้าย 2 รางวัล
//   2015-09-01 .. present     X X X X   เลขหน้า 2 รางวัล + เลขท้าย 2 รางวัล
// => ชุด1/ชุด2 = เลขหน้า 3 ตัว (last3f), ชุด3/ชุด4 = เลขท้าย 3 ตัว (last3b).
// The admin still confirms the mapping in the preview before anything is saved.

const GLO_ENDPOINT = "https://www.glo.or.th/api/lottery/getLatestLottery";

// Every lottery number stays a String — leading zeros are law (§4.21.4).
export interface DrawFields {
  date: string; // ISO YYYY-MM-DD
  six: string | null; // รางวัลที่ 1 (6 หลัก)
  top3: string | null; // 3 บน
  top2: string | null; // 2 บน
  bottom2: string | null; // 2 ล่าง
  set1: string | null; // 3 ล่าง ชุด 1 (เลขหน้า)
  set2: string | null; // 3 ล่าง ชุด 2 (เลขหน้า)
  set3: string | null; // 3 ล่าง ชุด 3 (เลขท้าย)
  set4: string | null; // 3 ล่าง ชุด 4 (เลขท้าย)
  drawTime: string | null; // HH:MM
}

export interface GloRaw {
  date: string;
  first: string[];
  last2: string[];
  last3f: string[]; // เลขหน้า 3 ตัว
  last3b: string[]; // เลขท้าย 3 ตัว
}

export interface GloResult {
  raw: GloRaw;
  mapped: DrawFields;
}

function values(node: unknown): string[] {
  const nums = (node as { number?: { value?: unknown }[] } | undefined)?.number;
  if (!Array.isArray(nums)) return [];
  return nums
    .map((n) => (n?.value == null ? "" : String(n.value).trim()))
    .filter((v) => v !== "");
}

export async function fetchLatestDraw(): Promise<GloResult> {
  const res = await fetch(GLO_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GLO ตอบกลับ ${res.status}`);

  const json = await res.json();
  const response = json?.response;
  if (!response) throw new Error("GLO ไม่ส่งข้อมูลงวดกลับมา");

  const date = String(response.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`GLO ส่งวันที่ผิดรูปแบบ: ${date || "(ว่าง)"}`);
  }

  const d = response.data ?? {};
  const raw: GloRaw = {
    date,
    first: values(d.first),
    last2: values(d.last2),
    last3f: values(d.last3f),
    last3b: values(d.last3b),
  };

  const six = raw.first[0] ?? null;
  const mapped: DrawFields = {
    date,
    six,
    // 3 บน / 2 บน are the tail of the first prize (matches every valid row in
    // the workbook); left null when GLO has not published the first prize yet.
    top3: six && six.length >= 3 ? six.slice(-3) : null,
    top2: six && six.length >= 2 ? six.slice(-2) : null,
    bottom2: raw.last2[0] ?? null,
    set1: raw.last3f[0] ?? null,
    set2: raw.last3f[1] ?? null,
    set3: raw.last3b[0] ?? null,
    set4: raw.last3b[1] ?? null,
    drawTime: "16:00", // งวดออกรางวัล 16:00 ทุกงวดในชุดข้อมูลนี้
  };

  return { raw, mapped };
}

// ---------------------------------------------------------------------------
// Validation — same rules the Excel loader / import script enforce.
// ---------------------------------------------------------------------------

const DIGITS = /^\d+$/;

const LENGTHS: [keyof DrawFields, number, string][] = [
  ["six", 6, "แสดงตัวเลข 6 หลัก"],
  ["top3", 3, "3 บน"],
  ["top2", 2, "2 บน"],
  ["bottom2", 2, "2 ล่าง"],
  ["set1", 3, "3 ล่าง ชุด 1"],
  ["set2", 3, "3 ล่าง ชุด 2"],
  ["set3", 3, "3 ล่าง ชุด 3"],
  ["set4", 3, "3 ล่าง ชุด 4"],
];

export function validateDraw(d: DrawFields): string[] {
  const errors: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
    errors.push("วันที่ต้องเป็นรูปแบบ YYYY-MM-DD");
  } else if (Number.isNaN(Date.parse(`${d.date}T00:00:00Z`))) {
    errors.push(`วันที่ไม่มีอยู่จริง: ${d.date}`);
  }

  for (const [key, len, label] of LENGTHS) {
    const v = d[key] as string | null;
    if (v === null || v === "") continue; // null is allowed (pre-2015 columns)
    if (!DIGITS.test(v) || v.length !== len) {
      errors.push(`${label} ต้องเป็นตัวเลข ${len} หลัก (ได้ "${v}")`);
    }
  }

  if (d.drawTime && !/^\d{2}:\d{2}$/.test(d.drawTime)) {
    errors.push("เวลาสร้างตัวเลขต้องเป็นรูปแบบ HH:MM");
  }

  // Consistency check — cheap, and catches a mis-keyed manual entry.
  if (d.six && d.top3 && d.six.slice(-3) !== d.top3) {
    errors.push(`3 บน (${d.top3}) ไม่ตรงกับ 3 ตัวท้ายของรางวัลที่ 1 (${d.six.slice(-3)})`);
  }
  if (d.six && d.top2 && d.six.slice(-2) !== d.top2) {
    errors.push(`2 บน (${d.top2}) ไม่ตรงกับ 2 ตัวท้ายของรางวัลที่ 1 (${d.six.slice(-2)})`);
  }

  return errors;
}
