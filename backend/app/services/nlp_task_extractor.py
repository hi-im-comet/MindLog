"""
일기 텍스트에서 할 일 / 목표를 자동 추출하는 NLP 서비스.
Claude Haiku를 사용해 빠르고 저렴하게 처리한다.
"""
from __future__ import annotations
import json
import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
당신은 일기 텍스트에서 할 일과 목표를 추출하는 전문가입니다.
사용자가 명시적으로 하겠다고 언급하거나 암시한 구체적인 행동 항목만 추출하세요.
모호하거나 일반적인 바람(예: "행복해지고 싶다")은 제외하세요.
"""

_EXTRACT_PROMPT = """\
다음 일기 텍스트에서 사용자가 하려는 구체적인 할 일이나 목표를 추출하세요.

규칙:
- 구체적인 행동 항목만 (추상적 감정 제외)
- 이미 완료된 일은 제외
- 최대 5개까지만
- JSON 배열 형식으로만 응답: [{"title": "...", "suggested_time": "내일 오전 9시 또는 null"}]
- 없으면 빈 배열 []

일기:
{text}
"""


def extract_tasks(entry_text: str) -> list[dict]:
    """
    일기 텍스트에서 태스크 후보를 추출한다.
    반환: [{'title': str, 'suggested_time': str | None}, ...]
    """
    from app.services.ai_service import call_claude, MODEL_HAIKU

    if not entry_text or not entry_text.strip():
        return []

    prompt = _EXTRACT_PROMPT.format(text=entry_text[:2000])

    try:
        content, _ = call_claude(
            messages=[{'role': 'user', 'content': prompt}],
            system_prompt=_SYSTEM_PROMPT,
            model=MODEL_HAIKU,
            max_tokens=400,
        )
        # JSON 파싱
        text = content.strip()
        # 마크다운 코드블록 제거
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1]) if len(lines) > 2 else ''
        tasks = json.loads(text)
        if not isinstance(tasks, list):
            return []
        return [
            {
                'title': str(t.get('title', '')).strip(),
                'suggested_time': t.get('suggested_time') or None,
            }
            for t in tasks
            if isinstance(t, dict) and t.get('title', '').strip()
        ]
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f'태스크 추출 실패: {e}')
        return []
