"""
일일 홈 메시지 생성 서비스.
전날 일기/대화 내용을 바탕으로 AI가 짧은 응원/조언/격언 메시지를 생성한다.
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# 자해/자살 관련 키워드 — 감지 시 safety 전용 프롬프트 사용
SELF_HARM_KEYWORDS = ['자살', '자해', '죽고 싶', '죽을 것 같', '삶을 끝', '극단적 선택']

MOOD_SYSTEM_PROMPTS = {
    'empathy': '당신은 따뜻하고 공감적인 AI 동반자입니다. 사용자에게 다정한 응원 메시지를 건네주세요. 마크다운 없이 일반 텍스트로만 작성하세요.',
    'advice': '당신은 실용적인 조언을 전하는 AI 코치입니다. 오늘 하루를 위한 간결하고 유용한 한마디를 전해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.',
    'friend': '당신은 친한 친구처럼 편안하게 말을 건네는 AI입니다. 가볍고 따뜻한 아침 인사를 해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.',
    'reflection': '당신은 사용자가 자신을 돌아보도록 돕는 AI입니다. 잔잔한 통찰을 담은 메시지를 전해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.',
    'objective': '당신은 차분하고 명료한 AI 코치입니다. 오늘 하루를 위한 명확한 한마디를 전해주세요. 마크다운 없이 일반 텍스트로만 작성하세요.',
}

FALLBACK_MESSAGES = {
    'empathy': '오늘도 당신의 하루를 응원합니다. 작은 것에도 귀 기울여보세요.',
    'advice': '오늘 하루, 가장 중요한 일 하나에 집중해보세요.',
    'friend': '오늘도 파이팅! 잘 해낼 수 있을 거예요 😊',
    'reflection': '잠깐 멈추어 오늘 내가 어떤 상태인지 살펴보세요.',
    'objective': '오늘 해야 할 일과 할 수 있는 일을 구분해보세요.',
}


def generate_daily_message(user) -> str:
    """
    전날 일기를 바탕으로 AI 메시지를 생성하고 내용 문자열을 반환한다.
    실패 시 mood별 기본 메시지를 반환한다.
    """
    from app.services.ai_service import call_claude, MODEL_HAIKU

    mood = (user.profile.ai_mood_default if user.profile else None) or 'empathy'

    try:
        context_text, is_sensitive = _get_yesterday_context(user)
        system, user_prompt = _build_prompt(context_text, mood, is_sensitive)

        content, _ = call_claude(
            messages=[{'role': 'user', 'content': user_prompt}],
            system_prompt=system,
            model=MODEL_HAIKU,
            max_tokens=200,
        )
        return content.strip()[:300]

    except Exception as e:
        logger.error(f'일일 메시지 생성 실패 user={user.id}: {e}')
        return FALLBACK_MESSAGES.get(mood, FALLBACK_MESSAGES['empathy'])


def _get_yesterday_context(user) -> tuple[str, bool]:
    """
    전날 일기 대화에서 사용자 발화를 수집한다.
    (context_text, is_sensitive) 반환.
    """
    from zoneinfo import ZoneInfo
    from app.models.journal_entry import JournalEntry
    from app.models.conversation import Conversation
    from app.models.conversation_message import ConversationMessage

    tz = ZoneInfo(user.timezone or 'Asia/Seoul')
    today_local = datetime.now(tz).date()
    yesterday = today_local - timedelta(days=1)

    entry = JournalEntry.query.filter_by(
        user_id=user.id,
        entry_date=yesterday,
        deleted_at=None,
    ).first()

    if not entry:
        return '', False

    # 해당 일기의 대화에서 사용자 발화만 수집
    conv = Conversation.query.filter_by(
        user_id=user.id,
        entry_id=entry.id,
    ).first()

    if not conv:
        # raw_content로 대체
        context_text = (entry.raw_content or '')[:1500]
    else:
        msgs = ConversationMessage.query.filter_by(
            conversation_id=conv.id,
            role='user',
        ).order_by(ConversationMessage.created_at).all()
        context_text = ' '.join(m.content for m in msgs)[:1500]

    is_sensitive = any(kw in context_text for kw in SELF_HARM_KEYWORDS)
    return context_text, is_sensitive


def _build_prompt(context: str, mood: str, is_sensitive: bool) -> tuple[str, str]:
    """system prompt와 user prompt를 반환한다."""
    if is_sensitive:
        system = (
            '당신은 따뜻하고 안전을 최우선으로 하는 AI 동반자입니다. '
            '오늘의 메시지는 사용자의 안전과 연결감에 집중해야 합니다. '
            '절대 자해나 자살에 관한 표현을 직접 사용하지 마세요.'
        )
        user_prompt = (
            '사용자에게 오늘 아침 건네는 짧고 따뜻한 안심 메시지를 한국어로 작성해주세요. '
            '곁에 있다는 것을 전달하고, 필요하면 도움을 받을 수 있다고 부드럽게 언급하세요. '
            '(자살예방상담전화 1393, 24시간 운영) '
            '1~2문장, 140자 이내.'
        )
        return system, user_prompt

    system = MOOD_SYSTEM_PROMPTS.get(mood, MOOD_SYSTEM_PROMPTS['empathy'])

    if context:
        user_prompt = (
            f'어제 사용자가 나눈 이야기의 흐름: "{context[:500]}"\n\n'
            '이 내용을 직접 언급하거나 인용하지 말고, 분위기와 감정의 흐름만 부드럽게 반영하여 '
            '오늘 아침 건네는 응원/조언/격언 느낌의 짧은 메시지를 한국어로 작성해주세요. '
            '1~2문장, 140자 이내.'
        )
    else:
        user_prompt = (
            '오늘 아침 일기를 쓰는 사용자에게 건네는 따뜻한 응원/조언/격언 느낌의 짧은 메시지를 '
            '한국어로 작성해주세요. 1~2문장, 140자 이내.'
        )

    return system, user_prompt
