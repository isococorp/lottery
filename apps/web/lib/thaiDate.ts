// Thai Buddhist-era (พ.ศ.) date helpers.
// The engine speaks ISO / ค.ศ. (e.g. "2026-08-16"); the UI shows and accepts
// พ.ศ. (e.g. "16/08/2569").  พ.ศ. = ค.ศ. + 543.
export const BE_OFFSET = 543;

// "2026-08-16" -> "16/08/2569".  Returns "" for empty / non-ISO input.
export function isoToThai(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${Number(y) + BE_OFFSET}`;
}

// "16/08/2569" -> "2026-08-16".  Accepts d/m/yyyy separated by / . or -.
// Returns null when the string is not a valid Buddhist-era calendar date.
export function thaiToIso(thai: string): string | null {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{3,4})$/.exec((thai ?? "").trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const ce = Number(m[3]) - BE_OFFSET;
  if (ce < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject overflow like 31/02 by round-tripping through a real date.
  const dt = new Date(Date.UTC(ce, mo - 1, d));
  if (dt.getUTCFullYear() !== ce || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ce}-${p(mo)}-${p(d)}`;
}
