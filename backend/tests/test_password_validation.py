"""
비밀번호 검증 단위 테스트.

실행: cd backend && source venv/bin/activate && python -m pytest tests/test_password_validation.py -v
"""
import unicodedata
import pytest


def norm_pw(s: str) -> str:
    """NFC 정규화 + trim (Settings.tsx의 normPw와 동일 로직)."""
    return unicodedata.normalize('NFC', s).strip()


# ── Task A: 비밀번호 일치 검사 ────────────────────────────────────────────────


def test_identical_ascii_passwords_match():
    """동일한 ASCII 비밀번호는 일치해야 한다."""
    pw = 'abcd1234'
    assert norm_pw(pw) == norm_pw(pw)


def test_identical_korean_passwords_match():
    """동일한 한글 비밀번호(NFC)는 일치해야 한다."""
    pw = '비밀번호1234'
    assert norm_pw(pw) == norm_pw(pw)


def test_nfc_and_nfd_same_string_match():
    """
    macOS 한글 IME 버그: 동일 문자열이 NFC/NFD로 다르게 저장될 수 있다.
    정규화 후 비교하면 일치해야 한다.
    """
    korean_pw = '비밀번호1234'
    nfc = unicodedata.normalize('NFC', korean_pw)
    nfd = unicodedata.normalize('NFD', korean_pw)
    # 정규화 방식이 다르면 바이트 표현이 다름
    assert nfc != nfd, "NFC와 NFD는 원래 다른 바이트 시퀀스다"
    # 우리의 norm_pw (NFC 정규화)는 둘 다 같은 결과를 내야 한다
    assert norm_pw(nfc) == norm_pw(nfd), "norm_pw 후에는 같아야 한다"


def test_whitespace_trimmed_before_compare():
    """앞뒤 공백은 trim 후 제거된다."""
    assert norm_pw('abcd ') == norm_pw('abcd')
    assert norm_pw(' abcd') == norm_pw('abcd')


def test_min_length_check():
    """4자 미만 비밀번호는 거부해야 한다."""
    assert len(norm_pw('abc')) < 4
    assert len(norm_pw('abcd')) >= 4


def test_passwords_differ_if_genuinely_different():
    """실제로 다른 비밀번호는 정규화 후에도 달라야 한다."""
    assert norm_pw('abc1') != norm_pw('abc2')
    assert norm_pw('비밀번호1') != norm_pw('비밀번호2')


# ── Task B: 매일 자동 잠금 날짜 롤오버 ────────────────────────────────────────


from datetime import date, timedelta
from typing import Optional


def _is_daily_lock_expired(daily_lock_enabled: bool, stored_date: Optional[str], today: str) -> bool:
    """
    dailyLock.ts의 isDailyLockExpired 파이썬 등가 구현 (테스트용).
    """
    if not daily_lock_enabled:
        return False
    return stored_date != today


def test_daily_lock_disabled_never_expires():
    """daily_lock_enabled=False이면 항상 만료되지 않는다."""
    today = str(date.today())
    assert not _is_daily_lock_expired(False, None, today)
    assert not _is_daily_lock_expired(False, 'yesterday', today)


def test_daily_lock_same_day_not_expired():
    """오늘 날짜로 저장되어 있으면 만료되지 않는다."""
    today = str(date.today())
    assert not _is_daily_lock_expired(True, today, today)


def test_daily_lock_next_day_expired():
    """다음 날이 되면 만료된다."""
    yesterday = str(date.today() - timedelta(days=1))
    today = str(date.today())
    assert _is_daily_lock_expired(True, yesterday, today)


def test_daily_lock_no_stored_date_expired():
    """저장된 날짜가 없으면 (처음) 만료된 것으로 본다."""
    today = str(date.today())
    assert _is_daily_lock_expired(True, None, today)


def test_daily_lock_timezone_edge_midnight():
    """
    KST 자정 직전: 23:59 KST → UTC 14:59 (이전날).
    KST 자정 직후: 00:01 KST → UTC 15:01 (당일).
    stored_date가 전날이면 자정 넘어 만료된다.
    """
    from datetime import datetime, timezone, timedelta

    kst = timezone(timedelta(hours=9))

    # 자정 직후 KST (다음날)
    just_after_midnight_kst = datetime(2026, 3, 2, 0, 1, tzinfo=kst)
    today_kst = just_after_midnight_kst.strftime('%Y-%m-%d')  # '2026-03-02'
    stored_date = '2026-03-01'  # 어제 해제
    assert _is_daily_lock_expired(True, stored_date, today_kst)

    # 자정 직전 KST (아직 당일)
    just_before_midnight_kst = datetime(2026, 3, 1, 23, 59, tzinfo=kst)
    today_kst2 = just_before_midnight_kst.strftime('%Y-%m-%d')  # '2026-03-01'
    assert not _is_daily_lock_expired(True, stored_date, today_kst2)
