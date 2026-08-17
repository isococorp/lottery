"""The five schools (ศาสตร์) that each emit 7 lottery numbers.

4.1 ดวงจีน (bazi) · 4.2 ดวงไทย (thai) · 4.3 เลขศาสตร์ (numerology)
4.4 สถิติ walk-forward (stats_wf) · 4.5 ศาสตร์อื่น (other)
"""
from .base import SchoolResult, digit_root
from . import (school_bazi, school_thai, school_numerology, school_other,
               school_stats_wf, school_chaldean, school_biorhythm, school_iching,
               school_pythagorean, school_meihua, school_tarot,
               school_ziwei, school_xuankong, school_qimen, school_daliuren,
               school_tongsheng, school_western, school_vedic)

STATS_CODE = "4.4"
STATS_NAME = "สถิติ WF"

# Display names for every production school (used by /predict and backtest).
SCHOOL_NAMES = {
    "4.1": "ดวงจีน", "4.2": "ดวงไทย", "4.3": "เลขศาสตร์", "4.4": STATS_NAME,
    "4.5": "ศาสตร์อื่น", "4.6": "Zi Wei", "4.7": "Qi Men", "4.8": "Da Liu Ren",
    "4.9": "Mei Hua", "4.10": "I Ching", "4.11": "Xuan Kong", "4.12": "Tong Sheng",
    "4.15": "Pythagorean", "4.16": "Chaldean", "4.17": "Western Astro",
    "4.18": "Biorhythm", "4.19": "Tarot", "4.20": "Vedic Astro",
}

# Production school codes in display order (4.4 stats is handled separately).
PRODUCTION_CODES = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8",
                    "4.9", "4.10", "4.11", "4.12", "4.15", "4.16", "4.17",
                    "4.18", "4.19", "4.20"]

__all__ = ["SchoolResult", "digit_root", "STATS_CODE", "STATS_NAME",
           "SCHOOL_NAMES", "PRODUCTION_CODES",
           "school_bazi", "school_thai", "school_numerology", "school_other",
           "school_stats_wf", "school_chaldean", "school_biorhythm", "school_iching",
           "school_pythagorean", "school_meihua", "school_tarot",
           "school_ziwei", "school_xuankong", "school_qimen", "school_daliuren",
           "school_tongsheng", "school_western", "school_vedic"]
