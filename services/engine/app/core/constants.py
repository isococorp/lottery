"""Base constants for the Tianming Lottery engine (spec §C.1).

Source of truth: Lottery.md §C.1. Do NOT edit without re-running golden tests.
Elements are kept in Thai to match the source bazi program's reference values.
"""

# Heavenly stems (天干) / Earthly branches (地支)
Gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
Zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# Teochew (แต้จิ๋ว) romanisations used in display
GanTH = ["กะ", "อิก", "เปี้ย", "เต็ง", "โบ่ว", "กี้", "แก", "ซิง", "ยิ่ม", "กุ่ย"]
ZhiTH = ["ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง",
         "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน"]

# Element of each stem (stem index -> element)
SE = ["ไม้", "ไม้", "ไฟ", "ไฟ", "ดิน", "ดิน", "ทอง", "ทอง", "น้ำ", "น้ำ"]
# Element of each branch (branch index -> element)
BE = ["น้ำ", "ดิน", "ไม้", "ไม้", "ดิน", "ไฟ",
      "ไฟ", "ดิน", "ทอง", "ทอง", "ดิน", "น้ำ"]

# He Tu (河圖) numbers per element. 10 is represented as 0.
# Yang (even stem index) -> first number, Yin (odd) -> second number.
HETU = {"น้ำ": (1, 6), "ไฟ": (2, 7), "ไม้": (3, 8), "ทอง": (4, 9), "ดิน": (5, 0)}

# Thai day-of-week tables (ศาสตร์ 4.2)
KAMLANG = {"อาทิตย์": 6, "จันทร์": 15, "อังคาร": 8, "พุธ": 17,
           "พฤหัสบดี": 19, "ศุกร์": 21, "เสาร์": 10}
DAONUM = {"อาทิตย์": 1, "จันทร์": 2, "อังคาร": 3, "พุธ": 4,
          "พฤหัสบดี": 5, "ศุกร์": 6, "เสาร์": 7}

# Thai weekday name by Python weekday() (Mon=0 ... Sun=6)
THAI_WEEKDAY = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]

# BaZi power scoring matrix (§C.4): MX[day-master element][target element] = score
MX = {
    "ไฟ":  {"ไม้": +2, "ไฟ": +1, "ดิน": -2, "ทอง": -2, "น้ำ": -2},
    "ดิน": {"ไฟ": +2, "ดิน": +1, "ไม้": -1, "ทอง": -2, "น้ำ": -2},
    "ทอง": {"ดิน": +2, "ทอง": +1, "ไฟ": -1, "ไม้": -2, "น้ำ": -2},
    "น้ำ": {"ทอง": +2, "น้ำ": +1, "ดิน": -2, "ไม้": -2, "ไฟ": -1},
    "ไม้": {"น้ำ": +2, "ไม้": +1, "ไฟ": -2, "ดิน": -2, "ทอง": -2},
}
