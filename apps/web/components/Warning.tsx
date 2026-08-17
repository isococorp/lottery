export function Warning({ text }: { text?: string }) {
  return (
    <div className="mb-4 rounded-lg border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-200">
      {text ??
        "⚠️ คำเตือน: เครื่องมือทดลองเชิงสถิติเพื่อการศึกษาเท่านั้น ผลทดสอบย้อนหลัง 708 งวดยืนยันว่าไม่มีศาสตร์ใดพยากรณ์เกินระดับสุ่ม"}
    </div>
  );
}

export function LayerBadge({ level, label }: { level: number; label: string }) {
  return <span className="badge mr-2">ชั้น {level} · {label}</span>;
}

export function ConfidenceBadge({ tier }: { tier: string }) {
  const th = tier === "NONE" ? "ไม่ต่างจากสุ่ม" : tier;
  return <span className="badge border-white/30 text-white/70">ความเชื่อมั่น: {th}</span>;
}
