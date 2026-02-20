"""
일기의 한줄 요약을 생성하는 서비스.
"""
from app.services.ai_service import call_claude, MODEL_HAIKU
from app.services.prompt_builder import SUMMARY_SYSTEM


def generate_daily_summary(raw_content: str) -> tuple[str, dict]:
    """
    일기 원문으로부터 한줄 요약을 생성한다.
    Returns: (요약_문장, AI_사용량)
    """
    text, usage = call_claude(
        messages=[{
            'role': 'user',
            'content': f'일기:\n\n{raw_content}',
        }],
        system_prompt=SUMMARY_SYSTEM,
        model=MODEL_HAIKU,
        max_tokens=150,
    )
    # 앞뒤 공백 제거, 첫 줄만 사용
    summary = text.strip().split('\n')[0].strip()
    return summary, usage
