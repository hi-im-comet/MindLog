"""
Streak 및 일기 날짜 기준 타임존: Asia/Seoul (KST)로 통일.
- "오늘"은 KST 기준 오늘 날짜.
- streak: 오늘(KST) 포함, 오늘부터 과거로 연속된 기록일 수.
"""
from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo('Asia/Seoul')


def today_kst() -> date:
    """현재 시각을 Asia/Seoul 기준으로 해석한 오늘 날짜."""
    return datetime.now(timezone.utc).astimezone(KST).date()


def recompute_streak_from_entries(user_id, session, today=None):
    """
    해당 유저의 실제 기록(일기) 날짜만으로 streak를 재계산한다.
    - 기준: 오늘(KST) 포함, 오늘부터 과거로 연속된 날짜만 카운트.
    - 기록 1건 = 해당 날짜에 (비초안) 일기가 1건 이상 있는 것. 하루에 여러 건이어도 1일로 센다.
    - today: 테스트용. None이면 KST 오늘 사용.
    - 반환: (consecutive_days: int, last_entry_date: date | None)
    """
    from sqlalchemy import distinct
    from app.models.journal_entry import JournalEntry

    if today is None:
        today = today_kst()
    # 비초안·미삭제 일기의 distinct entry_date 목록 (날짜만)
    rows = (
        session.query(distinct(JournalEntry.entry_date))
        .filter(
            JournalEntry.user_id == user_id,
            JournalEntry.deleted_at.is_(None),
            JournalEntry.is_draft.is_(False),
            JournalEntry.entry_date <= today,
        )
        .all()
    )
    recorded_dates = {r[0] for r in rows if r[0] is not None}
    if not recorded_dates:
        return 0, None
    count = compute_streak_count(recorded_dates, today)
    last_date = max(recorded_dates)
    return count, last_date


def compute_streak_count(recorded_dates: set[date], today: date) -> int:
    """
    오늘(KST) 포함, 오늘부터 과거로 연속된 기록일 수.
    - recorded_dates: 기록이 있는 날짜 집합 (중복 제거된 날짜만).
    - today: 기준일(보통 KST 오늘).
    """
    count = 0
    d = today
    while d in recorded_dates:
        count += 1
        d -= timedelta(days=1)
    return count
