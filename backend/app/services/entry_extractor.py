"""
일기에서 구조화된 AI 데이터를 추출하는 서비스.
결과는 entry_ai_extractions 테이블에 저장된다.
"""
from __future__ import annotations
import json
import re
import logging
from app.services.ai_service import call_claude, MODEL_HAIKU
from app.services.prompt_builder import EXTRACTION_SYSTEM

logger = logging.getLogger(__name__)


def extract_from_content(raw_content: str) -> tuple[dict, dict]:
    """
    일기 원문에서 구조화 데이터를 추출한다.
    Returns: (추출된_데이터, AI_사용량)
    """
    text, usage = call_claude(
        messages=[{
            'role': 'user',
            'content': f'다음 일기에서 데이터를 추출해주세요:\n\n{raw_content}',
        }],
        system_prompt=EXTRACTION_SYSTEM,
        model=MODEL_HAIKU,
        max_tokens=1024,
    )

    data = _parse_json_response(text)
    # 필드 유효성 보정
    data.setdefault('mood_keywords', [])
    data.setdefault('topics', [])
    data.setdefault('sentiment_score', 0.0)
    data.setdefault('stress_indicators', [])
    data.setdefault('sleep_mentioned', False)
    data.setdefault('meals_mentioned', False)
    data.setdefault('work_mentioned', False)
    data.setdefault('exercise_mentioned', False)
    data.setdefault('category_segments', [])
    # category_segments 유효성 보정: 리스트가 아니면 빈 배열로
    if not isinstance(data.get('category_segments'), list):
        data['category_segments'] = []

    # 타입 보정
    score = data.get('sentiment_score', 0.0)
    try:
        data['sentiment_score'] = max(-1.0, min(1.0, float(score)))
    except (TypeError, ValueError):
        data['sentiment_score'] = 0.0

    return data, usage


def _parse_json_response(text: str) -> dict:
    """AI 응답 텍스트에서 JSON을 파싱한다. 실패 시 빈 dict 반환."""
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        # JSON 블록만 추출 시도
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    logger.warning(f'entry_extractor: JSON 파싱 실패. 원문: {text[:200]}')
    return {}
