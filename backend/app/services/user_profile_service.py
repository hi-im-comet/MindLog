"""
사용자 AI 프로필 업데이트 서비스.
5개 일기마다 실행되어 known_patterns, known_triggers 등을 갱신한다.
"""
from __future__ import annotations
import json
import re
import logging
from datetime import datetime, timezone
from app.services.ai_service import call_claude, MODEL_SONNET
from app.services.prompt_builder import PROFILE_UPDATE_SYSTEM

logger = logging.getLogger(__name__)

MAX_ENTRIES_FOR_CONTEXT = 10


def update_user_profile(user_id: str) -> bool:
    """
    최근 일기를 기반으로 사용자 AI 프로필을 업데이트한다.
    Returns: 성공 여부
    """
    from app.extensions import db
    from app.models.user_profile import UserProfile
    from app.models.journal_entry import JournalEntry

    profile = UserProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        return False

    # 최근 N개 일기 가져오기
    entries = (JournalEntry.query
               .filter_by(user_id=user_id, is_draft=False)
               .filter(JournalEntry.deleted_at.is_(None))
               .order_by(JournalEntry.entry_date.desc())
               .limit(MAX_ENTRIES_FOR_CONTEXT)
               .all())

    if len(entries) < 3:
        return False  # 데이터 부족

    # 일기 요약 목록 조립
    entries_text = '\n'.join(
        f"[{e.entry_date}] 요약: {e.daily_summary or e.raw_content[:200]}"
        for e in entries
    )
    current_profile_json = json.dumps({
        'summary': profile.summary,
        'known_patterns': profile.known_patterns or [],
        'known_triggers': profile.known_triggers or [],
        'communication_style': profile.communication_style,
    }, ensure_ascii=False)

    text, _ = call_claude(
        messages=[{
            'role': 'user',
            'content': (
                f"현재 프로필:\n{current_profile_json}\n\n"
                f"최근 일기 {len(entries)}개:\n{entries_text}\n\n"
                f"위 데이터를 바탕으로 프로필을 업데이트해주세요."
            ),
        }],
        system_prompt=PROFILE_UPDATE_SYSTEM,
        model=MODEL_SONNET,
        max_tokens=1024,
    )

    updated = _parse_profile_json(text)
    if not updated:
        return False

    profile.summary = updated.get('summary', profile.summary)
    profile.known_patterns = updated.get('known_patterns', profile.known_patterns)
    profile.known_triggers = updated.get('known_triggers', profile.known_triggers)
    profile.communication_style = updated.get('communication_style', profile.communication_style)
    profile.last_analysis_at = datetime.now(timezone.utc)
    db.session.commit()
    return True


def _parse_profile_json(text: str) -> dict:
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    logger.warning(f'user_profile_service: JSON 파싱 실패. 원문: {text[:200]}')
    return {}
