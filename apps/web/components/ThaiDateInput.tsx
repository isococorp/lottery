"use client";
import { useEffect, useState } from "react";
import { isoToThai, thaiToIso } from "@/lib/thaiDate";

/**
 * Date field that shows / accepts พ.ศ. (วว/ดด/ปปปป) while communicating ISO
 * (ค.ศ.) to the parent — the engine only speaks ISO. A free-text box allows any
 * date (incl. future ones); when `options` (ISO draw dates) are given, a select
 * "list box" lets the user pick a historical งวด directly, shown in พ.ศ.
 */
export function ThaiDateInput({
  value,
  onChange,
  onPick,
  options,
  className = "",
  placeholder = "วว/ดด/ปปปป (พ.ศ.)",
}: {
  value: string; // ISO date ("" if unset)
  onChange: (iso: string) => void; // emits ISO ("" when cleared); invalid text is not propagated
  onPick?: (iso: string) => void; // fired only when a งวด is chosen from the select list box
  options?: string[]; // ISO dates for the select list box
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => isoToThai(value));

  // Re-sync the text buffer when the parent value changes from the outside
  // (e.g. the user picks a งวด from the select).
  useEffect(() => {
    setText((prev) => (thaiToIso(prev) === value ? prev : isoToThai(value)));
  }, [value]);

  const invalid = text.trim() !== "" && thaiToIso(text) === null;

  function handleText(next: string) {
    setText(next);
    if (next.trim() === "") onChange("");
    else {
      const iso = thaiToIso(next);
      if (iso) onChange(iso); // keep the last valid ISO in the parent while typing
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={(e) => handleText(e.target.value)}
        aria-invalid={invalid}
        className={`${className} ${invalid ? "border-red-400" : ""}`}
      />
      {options && options.length > 0 && (
        <select
          value={options.includes(value) ? value : ""}
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value);
              onPick?.(e.target.value);
            }
          }}
          title="เลือกงวดที่มีผลรางวัลย้อนหลัง"
          className="rounded border border-white/20 bg-navy px-1 py-1 text-sm text-white"
        >
          <option value="">— เลือกงวด —</option>
          {options.map((d) => (
            <option key={d} value={d}>
              {isoToThai(d)}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
