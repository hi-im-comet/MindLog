"""
Streak 계산 로직 단위 테스트.
- 기준: 오늘(KST) 포함, 오늘부터 과거로 연속된 기록일 수.
- 타임존: Asia/Seoul 통일.
"""
from datetime import date, timedelta
import pytest
from app.utils.timezone_utils import compute_streak_count


def test_streak_today_only():
    """케이스1: 오늘만 기록 -> streak=1"""
    today = date(2026, 2, 22)
    recorded = {today}
    assert compute_streak_count(recorded, today) == 1


def test_streak_yesterday_and_today():
    """케이스2: 어제+오늘 기록 -> streak=2"""
    today = date(2026, 2, 22)
    yesterday = today - timedelta(days=1)
    recorded = {yesterday, today}
    assert compute_streak_count(recorded, today) == 2


def test_streak_gap_then_today():
    """케이스3: 이틀 전 기록 후 하루 건너뜀 -> 오늘 기록 시 streak=1"""
    today = date(2026, 2, 22)
    two_days_ago = today - timedelta(days=2)
    recorded = {two_days_ago, today}  # 21일 없음
    assert compute_streak_count(recorded, today) == 1


def test_streak_late_night_then_early_morning():
    """케이스4: 밤 23:50 기록 + 다음날 00:10 기록(KST) -> 두 날짜 모두 있으면 streak=2
    (날짜 집합만으로 검증: 21일, 22일 있으면 today=22일 때 streak=2)"""
    today = date(2026, 2, 22)
    yesterday = date(2026, 2, 21)
    recorded = {yesterday, today}
    assert compute_streak_count(recorded, today) == 2


def test_streak_no_record_today():
    """오늘 기록 없으면 streak=0"""
    today = date(2026, 2, 22)
    yesterday = today - timedelta(days=1)
    recorded = {yesterday}
    assert compute_streak_count(recorded, today) == 0


def test_streak_empty():
    """기록 없으면 0"""
    today = date(2026, 2, 22)
    assert compute_streak_count(set(), today) == 0


def test_streak_three_consecutive():
    """3일 연속 기록 -> streak=3"""
    today = date(2026, 2, 22)
    recorded = {today - timedelta(days=i) for i in range(3)}
    assert compute_streak_count(recorded, today) == 3
