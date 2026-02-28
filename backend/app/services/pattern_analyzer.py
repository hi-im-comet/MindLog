"""
패턴 분석 서비스.
사용자의 일기들을 분석해 '거울 → 근거 → 작은 행동' 구조의 변화로그를 생성한다.
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

# ──────────────────────────────────────────
# AI 프롬프트: 기간별로 다른 깊이
# ──────────────────────────────────────────

_COMMON_NOTE = """\

공통 원칙:
- 상담·치료 어투 금지. 따뜻한 거울이 되세요.
- 판단하지 말고 관찰하세요. 공허한 격려 없이.
- safety_content는 자해·자살 언급이 실제로 있을 때만. 없으면 반드시 null.
- 반드시 JSON만 출력. 다른 텍스트 절대 금지.
"""

WEEKLY_SYSTEM = """\
당신은 따뜻한 거울입니다. 사용자의 최근 7일 일기를 읽고 이번 주를 간결하게 담아냅니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "headline": "이번 주를 한 문장으로 (25자 이내)",
  "mirror": "거울: 이번 주 당신은 어떤 상태였나요? (2~3문장, 판단 없는 관찰)",
  "data_badges": ["구체적 데이터 최대 3개 — 예: '월·수 기분 최고', '목요일 스트레스 급등'"],
  "small_experiment": "이번 주 해볼 아주 작은 실험 1개 (1문장, 바로 실행 가능한 것)",
  "patterns_found": ["발견된 패턴 최대 3가지 (명사형으로 짧게)"],
  "safety_content": null
}
""" + _COMMON_NOTE

MONTHLY_SYSTEM = """\
당신은 따뜻한 거울입니다. 사용자의 최근 30일 일기를 읽고 이번 달의 흐름과 패턴을 담아냅니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "headline": "이번 달을 한 문장으로 (25자 이내)",
  "mirror": "거울: 이번 달 어떤 패턴이 반복됐나요? 어떤 변화가 있었나요? (3~4문장, 판단 없는 관찰)",
  "data_badges": ["구체적 데이터 최대 4개 — 예: '평균 기분 7.2', '스트레스 피크 3회', '수면 언급 5회'"],
  "small_experiment": "다음 달 초 해볼 작은 실험 1개 (1~2문장)",
  "patterns_found": ["발견된 패턴 최대 4가지 (명사형으로 짧게)"],
  "safety_content": null
}
""" + _COMMON_NOTE

SEMIANNUAL_SYSTEM = """\
당신은 따뜻한 거울입니다. 사용자의 최근 6개월 일기를 읽고 심층 패턴과 변화 흐름을 담아냅니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "headline": "이 6개월을 한 문장으로 (30자 이내)",
  "mirror": "거울: 이 6개월 동안 어떤 패턴의 삶을 살았나요? 어떤 변화가 있었나요? 트리거→생각→감정→행동 흐름이 보이면 담아주세요. (4~5문장, 판단 없는 관찰)",
  "data_badges": ["구체적 데이터 최대 5개 — 예: '상반기 평균 기분 6.1 → 하반기 7.4', '주요 트리거 3종 반복'"],
  "small_experiment": "지금 당장 시작할 작은 실험 1개 (2문장 이내)",
  "patterns_found": ["발견된 패턴 최대 5가지 (명사형으로 짧게)"],
  "safety_content": null
}
""" + _COMMON_NOTE

_PROMPT_MAP = {
    'weekly': WEEKLY_SYSTEM,
    'monthly': MONTHLY_SYSTEM,
    'semiannual': SEMIANNUAL_SYSTEM,
}

_MAX_TOKENS_MAP = {
    'weekly': 1024,
    'monthly': 1536,
    'semiannual': 2048,
}


# ──────────────────────────────────────────
# 기간 계산
# ──────────────────────────────────────────

def get_period_dates(period_type: str) -> tuple[date, date]:
    """기간 타입에 따라 결정론적인 (period_start, period_end) 반환."""
    today = date.today()
    if period_type == 'weekly':
        # 이번 주 월요일 ~ 오늘
        period_start = today - timedelta(days=today.weekday())
        return period_start, today
    elif period_type == 'monthly':
        # 이번 달 1일 ~ 오늘
        return today.replace(day=1), today
    elif period_type == 'semiannual':
        # 6개월 전 1일 ~ 오늘
        month = today.month - 6
        year = today.year
        if month <= 0:
            month += 12
            year -= 1
        return today.replace(year=year, month=month, day=1), today
    else:
        raise ValueError(f'알 수 없는 period_type: {period_type}')


# ──────────────────────────────────────────
# 메인 분석 함수
# ──────────────────────────────────────────

def analyze_patterns(user_id: str, period_type: str = 'weekly') -> Optional[PatternLog]:
    """
    period_type에 해당하는 기간의 일기를 분석해 PatternLog를 생성·저장한다.
    같은 기간 로그가 이미 존재하면 upsert(UPDATE)한다.
    """
    if period_type not in _PROMPT_MAP:
        logger.warning(f'알 수 없는 period_type: {period_type}')
        return None

    period_start, period_end = get_period_dates(period_type)

    # 해당 기간 일기 조회
    entries = (
        JournalEntry.query
        .filter_by(user_id=user_id, is_draft=False)
        .filter(JournalEntry.deleted_at.is_(None))
        .filter(JournalEntry.entry_date >= period_start)
        .filter(JournalEntry.entry_date <= period_end)
        .order_by(JournalEntry.entry_date)
        .all()
    )

    if not entries:
        logger.info(f'패턴 분석 스킵 (기록 없음): user_id={user_id}, period_type={period_type}')
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
        body = e.raw_content[:500] + ('...' if len(e.raw_content) > 500 else '')
        context_parts.append(f'{header}\n{body}')

    user_message = (
        f'분석 기간: {period_start} ~ {period_end} ({len(entries)}개 일기)\n\n'
        + '\n\n---\n\n'.join(context_parts)
    )

    text, _usage = call_claude(
        messages=[{'role': 'user', 'content': user_message}],
        system_prompt=_PROMPT_MAP[period_type],
        model=MODEL_SONNET,
        max_tokens=_MAX_TOKENS_MAP[period_type],
    )

    try:
        data = _parse_json(text)
    except Exception:
        logger.warning(f'패턴 분석 JSON 파싱 실패: {text[:200]}')
        return None

    mirror = data.get('mirror') or ''
    headline = data.get('headline') or '이번 기간 분석'
    data_badges = data.get('data_badges') or []
    small_experiment = data.get('small_experiment') or None
    patterns_found = data.get('patterns_found') or []
    safety_content = data.get('safety_content') or None  # null → None

    # Upsert: 동일 기간 로그가 있으면 UPDATE
    existing = (
        PatternLog.query
        .filter_by(user_id=user_id, log_type=period_type, period_start=period_start)
        .first()
    )

    if existing:
        existing.period_end = period_end
        existing.headline = headline
        existing.body = mirror
        existing.mirror = mirror
        existing.data_badges = data_badges
        existing.small_experiment = small_experiment
        existing.patterns_found = patterns_found
        existing.safety_content = safety_content
        existing.entries_analyzed = len(entries)
        existing.model_used = MODEL_SONNET
        existing.is_edited = False
        from datetime import timezone
        from datetime import datetime
        existing.generated_at = datetime.now(timezone.utc)
        db.session.commit()
        return existing

    pattern_log = PatternLog(
        user_id=user_id,
        log_type=period_type,
        period_start=period_start,
        period_end=period_end,
        headline=headline,
        body=mirror,
        mirror=mirror,
        data_badges=data_badges,
        small_experiment=small_experiment,
        patterns_found=patterns_found,
        safety_content=safety_content,
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
