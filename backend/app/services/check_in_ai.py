"""
체크인 AI 메시지 생성 서비스.
톤(encouraging/gentle/strict)에 따라 오프너 및 팔로업 메시지를 생성한다.
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

TONE_SYSTEM_PROMPTS = {
    'encouraging': """\
당신은 사용자의 목표 달성을 응원하는 AI 코치입니다.
따뜻하고 긍정적인 말투로, 사용자가 할 일을 잘 해낼 수 있다고 믿어주세요.
이모지를 자연스럽게 사용하고, 짧고 친근하게 말해주세요.
""",
    'gentle': """\
당신은 사용자를 부드럽게 배려하는 AI 동반자입니다.
압박감 없이 조용히 확인해주고, 사용자의 상황을 이해한다는 것을 전달해주세요.
짧고 따뜻하게, 강요 없이 말해주세요.
""",
    'strict': """\
당신은 사용자의 목표 관리를 돕는 직접적인 AI 코치입니다.
간결하고 명확하게, 할 일 완료 여부를 확인해주세요.
불필요한 감정 표현 없이 요점만 전달하세요.
""",
}


def build_opener(check_in) -> str:
    """
    체크인 시작 시 AI가 먼저 보내는 메시지를 생성한다.
    """
    from app.services.ai_service import call_claude, MODEL_HAIKU

    tone = check_in.tone or 'encouraging'
    system = TONE_SYSTEM_PROMPTS.get(tone, TONE_SYSTEM_PROMPTS['encouraging'])

    user_prompt = f"""사용자가 이전에 이런 할 일을 계획했어요: "{check_in.title}"
지금 시각에 자연스럽게 체크인하는 짧은 메시지를 한국어로 작성해주세요.
2~3문장 이내로 간결하게, 할 일을 잘 했는지 혹은 어떻게 되어가는지 물어봐주세요."""

    try:
        content, _ = call_claude(
            messages=[{'role': 'user', 'content': user_prompt}],
            system_prompt=system,
            model=MODEL_HAIKU,
            max_tokens=200,
        )
        return content.strip()
    except Exception as e:
        logger.error(f'체크인 오프너 생성 실패: {e}')
        return f'안녕하세요! "{check_in.title}" 어떻게 되어가고 있나요? 😊'


def build_followup(check_in) -> str:
    """
    15분 무응답 시 보내는 팔로업 메시지를 생성한다.
    """
    from app.services.ai_service import call_claude, MODEL_HAIKU

    tone = check_in.tone or 'encouraging'
    system = TONE_SYSTEM_PROMPTS.get(tone, TONE_SYSTEM_PROMPTS['encouraging'])

    user_prompt = f"""사용자가 이전에 이런 할 일을 계획했어요: "{check_in.title}"
아까 체크인 메시지를 보냈는데 아직 응답이 없어요.
바쁠 수도 있으니 부담 없이 나중에 확인해도 된다는 짧은 팔로업 메시지를 한국어로 작성해주세요.
1~2문장으로 매우 간결하게."""

    try:
        content, _ = call_claude(
            messages=[{'role': 'user', 'content': user_prompt}],
            system_prompt=system,
            model=MODEL_HAIKU,
            max_tokens=100,
        )
        return content.strip()
    except Exception as e:
        logger.error(f'팔로업 메시지 생성 실패: {e}')
        return '바쁘시면 나중에 확인해도 괜찮아요! 😊'


def build_ai_response(check_in, user_message: str, action_type: str | None = None) -> str:
    """
    사용자 메시지에 대한 AI 응답을 생성한다.
    action_type이 있으면 해당 액션에 맞는 응답을 생성한다.
    """
    from app.services.ai_service import call_claude, MODEL_HAIKU

    tone = check_in.tone or 'encouraging'
    system = TONE_SYSTEM_PROMPTS.get(tone, TONE_SYSTEM_PROMPTS['encouraging'])

    if action_type == 'done':
        user_prompt = f'사용자가 "{check_in.title}"을(를) 완료했다고 합니다. 짧고 따뜻하게 축하해주세요. 1~2문장으로.'
    elif action_type in ('snooze_10', 'snooze_60'):
        mins = '10분' if action_type == 'snooze_10' else '1시간'
        user_prompt = f'사용자가 "{check_in.title}"을(를) {mins} 후로 미루겠다고 합니다. 짧게 응원해주세요. 1~2문장으로.'
    elif action_type == 'reschedule':
        user_prompt = f'사용자가 "{check_in.title}"을(를) 나중으로 재예약하겠다고 합니다. 이해하고 응원하는 짧은 응답을 해주세요. 1~2문장으로.'
    else:
        user_prompt = f"""할 일: "{check_in.title}"
사용자 메시지: {user_message}

사용자의 메시지에 자연스럽게 응답해주세요. 2~4문장으로 간결하게."""

    try:
        content, _ = call_claude(
            messages=[{'role': 'user', 'content': user_prompt}],
            system_prompt=system,
            model=MODEL_HAIKU,
            max_tokens=300,
        )
        return content.strip()
    except Exception as e:
        logger.error(f'AI 응답 생성 실패: {e}')
        return '말씀 잘 들었어요! 응원하고 있을게요 😊'
