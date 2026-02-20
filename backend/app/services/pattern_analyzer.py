"""
패턴 분석 서비스.
사용자의 최근 일기들을 분석해 반복 패턴과 변화 로그를 생성한다.
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional
from datetime import date, timedelta

from app.extensions import db
from app.models.journal_entry import JournalEntry
from app.models.pattern_log import PatternLog
from app.services.ai_service import call_claude, MODEL_SONNET

logger = logging.getLogger(__name__)

PATTERN_ANALYSIS_SYSTEM = """\
당신은 정신건강 일기 패턴 분석 전문가입니다.
사용자의 최근 일기들을 분석해 반복 패턴과 변화를 따뜻하고 솔직하게 전달합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 출력하지 마세요.
{
  "headline": "이 기간을 한 문장으로 (30자 이내, 따뜻한 관찰자 시점)",
  "body": "3~5개 문단의 상세 분석. 각 문단 사이 빈 줄 포함.",
  "patterns_found": ["발견된 패턴 최대 5가지 (명사형으로 짧게)"]
}

분석 관점:
- 감정 패턴: 기분 추이, 반복되는 감정 상태
- 스트레스 트리거: 반복 언급된 상황·사람·장소
- 긍정 변화: 잘 해낸 것, 성장 징후, 작은 승리
- 생활 패턴: 수면·식사·운동이 언급된 경우 연관성
- 인지 패턴: 반복되는 사고방식이 있다면 중립적으로 관찰

원칙: 판단하지 말고 관찰하세요. 따뜻하되 공허한 긍정은 하지 마세요.
"""


def analyze_patterns(user_id: str, period_days: int = 7) -> Optional[PatternLog]:
    """
    최근 period_days일의 대화 기록을 분석해 PatternLog를 생성·저장한다.
    기록이 없으면 최대 30일까지 범위를 확장한다.
    """
    today = date.today()

    # 지정 기간에 기록이 없으면 30일까지 확장
    for days in sorted({period_days, 30}):
        period_start = today - timedelta(days=days - 1)
        entries = (
            JournalEntry.query
            .filter_by(user_id=user_id, is_draft=False)
            .filter(JournalEntry.deleted_at.is_(None))
            .filter(JournalEntry.entry_date >= period_start)
            .filter(JournalEntry.entry_date <= today)
            .order_by(JournalEntry.entry_date)
            .all()
        )
        if entries:
            period_days = days
            break

    if not entries:
        logger.info(f'패턴 분석 스킵 (기록 없음): user_id={user_id}')
        return None

    # 분석 컨텍스트 구성
    context_parts = []
    for e in entries:
        header = f'[{e.entry_date}]'
        if e.mood_score:
            header += f' 기분:{e.mood_score}/10'
        if e.energy_score:
            header += f' 에너지:{e.energy_score}/10'
        if e.daily_summary:
            header += f' | 요약: {e.daily_summary}'
        body = e.raw_content[:400] + ('...' if len(e.raw_content) > 400 else '')
        context_parts.append(f'{header}\n{body}')

    user_message = (
        f'분석 기간: {period_start} ~ {today} ({len(entries)}개 일기)\n\n'
        + '\n\n---\n\n'.join(context_parts)
    )

    text, _usage = call_claude(
        messages=[{'role': 'user', 'content': user_message}],
        system_prompt=PATTERN_ANALYSIS_SYSTEM,
        model=MODEL_SONNET,
        max_tokens=2048,
    )

    try:
        data = _parse_json(text)
    except Exception:
        logger.warning(f'패턴 분석 JSON 파싱 실패: {text[:200]}')
        return None

    log_type = 'weekly' if period_days <= 7 else 'monthly'
    pattern_log = PatternLog(
        user_id=user_id,
        log_type=log_type,
        period_start=period_start,
        period_end=today,
        headline=data.get('headline', '이번 기간 분석'),
        body=data.get('body', ''),
        patterns_found=data.get('patterns_found', []),
        entries_analyzed=len(entries),
        model_used=MODEL_SONNET,
    )
    db.session.add(pattern_log)
    db.session.commit()
    return pattern_log


def _parse_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise
