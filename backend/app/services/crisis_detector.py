"""
위기 언어 감지 서비스.
대화 메시지와 일기 내용에서 위기 신호를 탐지한다.
"""
from __future__ import annotations
from app.utils.constants import CRISIS_KEYWORDS, CRISIS_RESOURCES


def detect_crisis(text: str) -> tuple[bool, list[str]]:
    """
    텍스트에서 위기 관련 키워드를 탐지한다.
    Returns: (위기_감지됨, 감지된_키워드_목록)
    """
    text_lower = text.lower()
    found = [kw for kw in CRISIS_KEYWORDS if kw in text_lower]
    return len(found) > 0, found


def get_crisis_resource_message() -> str:
    """위기 상황 시 AI 응답에 포함할 리소스 안내 메시지."""
    resources = CRISIS_RESOURCES['ko']
    return (
        f"\n\n---\n"
        f"💙 지금 많이 힘드시군요. 혼자 이 감정을 감당하지 않아도 돼요.\n\n"
        f"**전문가 도움 받기:**\n"
        f"- {resources['hotline']}\n"
        f"- {resources['text']}\n"
        f"- {resources['emergency']}\n\n"
        f"언제든 연락할 수 있어요. 당신의 이야기를 들어줄 사람이 있어요."
    )
