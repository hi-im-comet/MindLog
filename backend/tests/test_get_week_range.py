"""
get_week_range 단위 테스트.

실행: cd backend && source venv/bin/activate && python -m pytest tests/test_get_week_range.py -v
"""
from datetime import date, timedelta
import pytest
from app.services.pattern_analyzer import get_week_range


def test_monday_start_on_friday():
    """금요일 기준, 월요일 시작 → 해당 주 월~일 반환."""
    fri = date(2026, 2, 27)  # weekday=4 (Friday)
    start, end = get_week_range(fri, week_start_day=0)
    assert start == date(2026, 2, 23)  # Monday
    assert end == date(2026, 3, 1)     # Sunday


def test_sunday_start_on_friday():
    """금요일 기준, 일요일 시작 → 해당 주 일~토 반환."""
    fri = date(2026, 2, 27)  # weekday=4 (Friday)
    start, end = get_week_range(fri, week_start_day=6)
    assert start == date(2026, 2, 22)  # Sunday
    assert end == date(2026, 2, 28)    # Saturday


def test_saturday_start_on_friday():
    """금요일 기준, 토요일 시작 → 직전 토~금 반환."""
    fri = date(2026, 2, 27)  # weekday=4 (Friday)
    start, end = get_week_range(fri, week_start_day=5)
    assert start == date(2026, 2, 21)  # Saturday
    assert end == date(2026, 2, 27)    # Friday


def test_on_week_start_day():
    """월요일에 월요일 시작 → 당일이 period_start."""
    mon = date(2026, 3, 2)  # Monday
    start, end = get_week_range(mon, week_start_day=0)
    assert start == mon
    assert end == date(2026, 3, 8)


def test_on_sunday_with_sunday_start():
    """일요일에 일요일 시작 → 당일이 period_start."""
    sun = date(2026, 3, 1)  # Sunday (weekday=6)
    start, end = get_week_range(sun, week_start_day=6)
    assert start == sun
    assert end == date(2026, 3, 7)


def test_always_7_days():
    """어떤 날짜와 시작 요일 조합이든 end - start == 6일 (7일 범위)."""
    base = date(2026, 1, 1)
    for day_offset in range(14):
        for wsd in range(7):
            d = base + timedelta(days=day_offset)
            s, e = get_week_range(d, wsd)
            assert (e - s).days == 6, f"Failed for date={d}, wsd={wsd}"


def test_same_week_same_period_start():
    """같은 캘린더 주의 다른 날짜들은 동일한 period_start 반환 → DB UNIQUE 보장."""
    # 월요일 시작, 2026-03-02(월)~2026-03-08(일) 주
    week_days = [date(2026, 3, 2) + timedelta(days=i) for i in range(7)]
    starts = [get_week_range(d, week_start_day=0)[0] for d in week_days]
    assert len(set(starts)) == 1
    assert starts[0] == date(2026, 3, 2)


def test_different_weeks_different_period_start():
    """다른 주의 날짜들은 서로 다른 period_start 반환."""
    this_mon = date(2026, 3, 2)
    next_mon = date(2026, 3, 9)
    assert get_week_range(this_mon, 0)[0] != get_week_range(next_mon, 0)[0]


def test_default_week_start_day_is_monday():
    """기본값 week_start_day=0 (월요일)."""
    fri = date(2026, 2, 27)
    start_default, _ = get_week_range(fri)
    start_monday, _ = get_week_range(fri, week_start_day=0)
    assert start_default == start_monday
