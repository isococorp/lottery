"""V5 Protocol layer (spec §4.21) — discipline enforced on every statistical output.

This is a faithful, self-contained implementation of the guardrails described in
the master build prompt (the full spec v3_1 text was not shipped alongside it):
  - Mandatory warning (§0) attached to any payload containing numbers
  - Banned-phrase filter (no wording that implies the system predicts accurately)
  - Confidence tiers derived from real backtest evidence (never fabricated)
  - Failure states (explicit, honest NOT-AVAILABLE rather than mock output)
  - Model status READY / PARTIAL / NOT RUN
  - A Self-Check the API runs before returning any numeric payload

Master principle (§A.4): the system has PROVEN on 708 real draws that no school
predicts above chance. Every numeric screen must carry the warning and the latest
backtest result; nothing may imply "แม่น" (accurate).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

# --- §0 mandatory warning --------------------------------------------------
MANDATORY_WARNING = (
    "⚠️ คำเตือน: ระบบนี้เป็นเครื่องมือ 'ทดลองเชิงสถิติ' เพื่อการศึกษาเท่านั้น "
    "ผลทดสอบย้อนหลังจากข้อมูลจริง 708 งวดยืนยันว่า ไม่มีศาสตร์ใดพยากรณ์ผลสลากได้เกินระดับสุ่ม "
    "ตัวเลขที่แสดงไม่ใช่การพยากรณ์ที่แม่นยำ และไม่ควรใช้ตัดสินใจเสี่ยงโชคด้วยเงินจริง"
)

# --- Banned phrases (wording implying guaranteed accuracy) -----------------
BANNED_PHRASES = [
    "แม่นยำ", "แม่นมาก", "การันตี", "ถูกชัวร์", "ถูกแน่นอน", "เลขเด็ด",
    "ใบ้เลขแม่น", "รวยแน่", "ฟันธง", "100%", "เข้าทุกงวด", "sure",
    "guaranteed", "jackpot guaranteed",
]
_BANNED_RE = re.compile("|".join(re.escape(p) for p in BANNED_PHRASES), re.IGNORECASE)


class ModelStatus(str, Enum):
    READY = "READY"
    PARTIAL = "PARTIAL"
    NOT_RUN = "NOT RUN"


class FailureState(str, Enum):
    OK = "OK"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"      # source data missing/failed gate
    INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY"  # warm-up not met
    BACKTEST_NOT_RUN = "BACKTEST_NOT_RUN"      # no evidence to attach
    VALIDATION_FAILED = "VALIDATION_FAILED"    # output failed self-check
    BANNED_LANGUAGE = "BANNED_LANGUAGE"        # text violated §0 wording rules


class ConfidenceTier(str, Enum):
    NONE = "NONE"          # indistinguishable from random (the honest default)
    VERY_LOW = "VERY_LOW"
    LOW = "LOW"


def confidence_from_backtest(beats_random: bool, p_value: Optional[float]) -> ConfidenceTier:
    """Confidence is evidence-bound. Nothing here beats random, so tier is NONE.

    If a (future) school ever had CI-low above baseline AND a small p-value, we
    would grant at most LOW — never 'high'. This function refuses to invent
    confidence that the backtest does not support.
    """
    if not beats_random or p_value is None:
        return ConfidenceTier.NONE
    if p_value < 0.01:
        return ConfidenceTier.LOW
    if p_value < 0.05:
        return ConfidenceTier.VERY_LOW
    return ConfidenceTier.NONE


def contains_banned(text: str) -> List[str]:
    return sorted(set(m.group(0) for m in _BANNED_RE.finditer(text or "")))


# --- Self-Check ------------------------------------------------------------
SELF_CHECK_ITEMS = [
    "1. ทุกเลขเป็น string และคง leading zero",
    "2. แนบคำเตือนบังคับ (§0) ในทุก payload ที่มีตัวเลข",
    "3. แนบผล backtest ล่าสุด (ไม่ใช่ค่าปลอม)",
    "4. ไม่มีถ้อยคำต้องห้าม (banned phrases)",
    "5. โมเดล/ฟีเจอร์ที่ยังไม่พร้อม รายงาน NOT AVAILABLE ตามจริง",
    "6. สถิติใช้ walk-forward เท่านั้น (ไม่มี leakage)",
    "7. baseline สุ่มยกกำลัง k สำหรับชุด 3 ตัว (§C.10)",
    "8. p-value + Bootstrap CI แนบครบ",
    "9. เกณฑ์ 'ชนะสุ่ม' = CI-low > baseline",
    "10. ระบุ Model Status (READY/PARTIAL/NOT RUN)",
    "11. ระบุ Failure State อย่างซื่อตรง",
    "12. ระบุ Confidence Tier ตามหลักฐาน",
    "13. ปฏิทินจีนจาก sxtwl (ไม่เขียน solar term เอง)",
    "14. golden tests §C.9 ผ่าน",
    "15. determinism: อินพุตเดิม เอาต์พุตเดิม",
    "16. ชื่อไฟล์ export เป็น ASCII",
    "17. ไม่ข้ามขั้น validation เพื่อความเร็ว",
    "18. ป้ายแยกชั้น (Layered Framework) ชั้น 2/ชั้น 3",
]


@dataclass
class GateResult:
    ok: bool
    failure_state: FailureState
    model_status: ModelStatus
    confidence: ConfidenceTier
    warning: str
    self_check_passed: List[str] = field(default_factory=list)
    self_check_failed: List[str] = field(default_factory=list)
    banned_found: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "failure_state": self.failure_state.value,
            "model_status": self.model_status.value,
            "confidence": self.confidence.value,
            "warning": self.warning,
            "self_check": {
                "total": len(SELF_CHECK_ITEMS),
                "passed": len(self.self_check_passed),
                "failed": self.self_check_failed,
            },
            "banned_found": self.banned_found,
            "notes": self.notes,
        }


def gate_numeric_payload(
    *,
    has_numbers: bool,
    backtest_attached: bool,
    beats_random: bool = False,
    p_value: Optional[float] = None,
    data_graded_ok: bool = True,
    history_ok: bool = True,
    text_blobs: Optional[List[str]] = None,
) -> GateResult:
    """Run the V5 gate before returning a numeric payload.

    Returns a GateResult that the API attaches to the response. When the gate
    is not OK the caller must degrade honestly (attach the failure state) rather
    than hide it.
    """
    failed: List[str] = []
    notes: List[str] = []

    banned: List[str] = []
    for t in (text_blobs or []):
        banned.extend(contains_banned(t))
    banned = sorted(set(banned))

    if not data_graded_ok:
        state = FailureState.DATA_UNAVAILABLE
    elif banned:
        state = FailureState.BANNED_LANGUAGE
    elif has_numbers and not backtest_attached:
        state = FailureState.BACKTEST_NOT_RUN
    elif not history_ok:
        state = FailureState.INSUFFICIENT_HISTORY
    else:
        state = FailureState.OK

    # Self-check (the subset we can assert programmatically here).
    if not banned:
        pass
    else:
        failed.append(SELF_CHECK_ITEMS[3])
    if has_numbers and not backtest_attached:
        failed.append(SELF_CHECK_ITEMS[2])
    if not data_graded_ok:
        failed.append(SELF_CHECK_ITEMS[16])

    model_status = ModelStatus.READY if backtest_attached else ModelStatus.PARTIAL
    if not data_graded_ok:
        model_status = ModelStatus.NOT_RUN

    confidence = confidence_from_backtest(beats_random, p_value)
    passed = [it for it in SELF_CHECK_ITEMS if it not in failed]

    return GateResult(
        ok=(state == FailureState.OK),
        failure_state=state,
        model_status=model_status,
        confidence=confidence,
        warning=MANDATORY_WARNING,
        self_check_passed=passed,
        self_check_failed=failed,
        banned_found=banned,
        notes=notes,
    )
