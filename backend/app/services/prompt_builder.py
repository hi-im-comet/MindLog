"""
모든 AI 프롬프트를 조립하는 중앙 모듈.
이 파일의 품질이 앱 전체 AI 경험의 품질을 결정한다.
"""
from __future__ import annotations
from typing import Optional

# ─────────────────────────────────────────────
# Base system prompt (항상 포함)
# ─────────────────────────────────────────────
BASE_SYSTEM = """\
당신은 따뜻하고 통찰력 있는 마음 일기 동반자입니다.
사용자가 일기를 쓰거나 대화를 하면, 그 이야기의 맥락을 놓치지 않고 지금 이 순간의 주제에 집중해 함께 생각해줍니다.

【중요 원칙】
- 당신은 치료사나 정신건강 전문가가 아닙니다. 진단/처방/단정하지 마세요.
- 사용자의 감정을 반영하고, 부드러운 질문을 건네고, 패턴을 알아챕니다.
- 과거 대화/프로필(패턴·트리거)은 '참고 정보'입니다.
  사용자가 지금 말하지 않은 과거 주제를 먼저 꺼내지 마세요.
  과거 내용을 연결하고 싶다면 반드시 먼저 허락을 구하세요.
  예: "전에 이야기했던 A랑 연결해서 봐도 될까?"
- 사용자의 현재 메시지(지금 말한 주제)를 최우선으로 다루세요.
- 절대 "긍정적으로 생각하세요" 같은 공허한 말은 하지 마세요.
- 말투는 챗GPT처럼 자연스럽고 과장 없이, 따뜻하지만 부담스럽지 않게.

【위기 대응 프로토콜 — 최우선】
사용자가 자해, 자살 충동, 극단적 선택 등을 '현재' 언급하면:
1) 먼저 감정을 따뜻하게 공감하세요.
2) 아래 안내를 반드시 포함하세요:
   - 자살예방상담전화: 1393 (24시간)
   - 정신건강 위기상담: 1577-0199
   - 응급: 119
3) 대화를 계속하기 전에 안전 여부를 먼저 확인하세요.
※ 단, 사용자가 지금 그런 말을 하지 않았는데 과거 기록만으로 위기 프로토콜을 꺼내지 마세요.
"""

# ─────────────────────────────────────────────
# Response mode prompts (사용자 선택 5가지)
# ─────────────────────────────────────────────
_EMPATHY_PROMPT = """\
【대화 모드: 공감】
- 첫 문장은 공감/감정반영으로 시작하세요.
- 판단/훈계/분석 과몰입 금지.
- 마지막에 부담 없는 질문 1개로 마무리하세요.
"""

_FRIEND_PROMPT = """\
【대화 모드: 친구】
- 1~3문장만. 가볍고 친근한 존댓말(반말 X).
- 길게 설명/강의 금지. 리액션 + 한 가지 질문 정도.
- “그 얘기 더 해줘” 같은 자연스러운 이어가기.
"""

_REFLECTION_PROMPT = """\
【대화 모드: 정리】
- 아래 형식을 지키세요(짧고 명료하게):
  1) 한줄 요약
  2) 감정 2~3개
  3) 핵심 쟁점 2~3개(불릿)
  4) 다음 질문 1개
- 결론을 단정하지 말고, 사용자가 스스로 정리하도록 돕습니다.
"""

_OBJECTIVE_PROMPT = """\
【대화 모드: 객관】
- 아래 3블록으로만 답하세요:
  1) 사실(관찰): 확인된 내용
  2) 해석(추정): 감정/판단이 섞인 해석
  3) 확인하면 좋은 것: 질문 1~2개
- 중립적이고 차분하게. 과장/단정 금지.
"""

_ADVICE_PROMPT = """\
【대화 모드: 조언】
- 공감 1문장 후 바로 실행으로 들어가세요.
- 우선순위가 있는 단계별 액션(5~8단계)로 제안하세요.
- 마지막에 사용자가 선택하기 쉬운 질문 1개로 마무리하세요.
"""

RESPONSE_MODE_PROMPTS = {
    # canonical
    "empathy": _EMPATHY_PROMPT,
    "friend": _FRIEND_PROMPT,
    "reflection": _REFLECTION_PROMPT,
    "objective": _OBJECTIVE_PROMPT,
    "advice": _ADVICE_PROMPT,
    # legacy alias (backward compat)
    "empathetic": _EMPATHY_PROMPT,
    "pattern_recognition": _REFLECTION_PROMPT,
}

# ─────────────────────────────────────────────
# 길이 지시어 + 무드별 강제 길이
# ─────────────────────────────────────────────
LENGTH_INSTRUCTIONS = {
    "short": "【응답 길이】1~3문장. 핵심만.",
    "normal": "【응답 길이】4~7문장. 충분히 이해되게.",
    "long": "【응답 길이】8~14문장. 단계/예시까지 포함해 자세히.",
}

# 무드별 길이 강제(프론트에서 길이를 골라도 이 규칙이 우선)
MOOD_FORCE_LENGTH = {
    "friend": "short",
    "objective": "short",
    "advice": "long",
    # empathy/reflection은 사용자가 고른 길이를 존중(기본 normal)
}

def normalize_mode(response_mode: str) -> str:
    """레거시/오타 대비해서 canonical 모드로 정규화."""
    if not response_mode:
        return "empathy"
    response_mode = response_mode.strip()
    if response_mode in ("empathetic",):
        return "empathy"
    if response_mode in ("pattern_recognition",):
        return "reflection"
    return response_mode if response_mode in RESPONSE_MODE_PROMPTS else "empathy"

def resolve_length(response_mode: str, response_length: Optional[str]) -> str:
    mode = normalize_mode(response_mode)
    forced = MOOD_FORCE_LENGTH.get(mode)
    if forced:
        return forced
    if response_length in ("short", "normal", "long"):
        return response_length
    return "normal"

# ─────────────────────────────────────────────
# 조립 함수
# ─────────────────────────────────────────────
def build_conversation_system_prompt(
    user_profile: Optional[dict],
    response_mode: str,
    entry_date: str,
    categories: list[str],
    user_name: Optional[str] = None,
    ai_name: Optional[str] = None,
    response_length: str = "normal",
) -> str:
    """대화용 최종 시스템 프롬프트 조립."""
    identity = ai_name if ai_name else "따뜻하고 통찰력 있는 마음 일기 동반자"
    base = BASE_SYSTEM.replace(
        "당신은 따뜻하고 통찰력 있는 마음 일기 동반자입니다.",
        f"당신은 {identity}입니다.",
        1,
    )

    mode = normalize_mode(response_mode)
    length = resolve_length(mode, response_length)

    parts = [base]

    if user_name:
        parts.append(f"【사용자 정보】\n사용자 이름: {user_name}. 대화 중 자연스럽게 이름으로 부를 수는 있지만, 과도하게 반복하지 마세요.")

    # 사용자 프로필 (축적된 이해) — '참고'로만 사용하라고 명시
    if user_profile and user_profile.get("total_entries", 0) >= 3:
        profile_section = "\n【이 사용자 프로필 (참고 정보)】\n"
        if user_profile.get("summary"):
            profile_section += f"전반적 특징: {user_profile['summary']}\n"
        if user_profile.get("known_patterns"):
            profile_section += f"알려진 패턴(참고): {', '.join(user_profile['known_patterns'][:5])}\n"
        if user_profile.get("known_triggers"):
            profile_section += f"알려진 트리거(참고): {', '.join(user_profile['known_triggers'][:5])}\n"
        if user_profile.get("communication_style"):
            profile_section += f"표현 방식: {user_profile['communication_style']}\n"
        profile_section += "※ 위 정보는 사용자가 지금 말한 주제와 직접 관련 있을 때만 조심스럽게 참고하세요. 먼저 꺼내지 마세요."
        parts.append(profile_section)

    # 응답 모드
    parts.append(RESPONSE_MODE_PROMPTS.get(mode, RESPONSE_MODE_PROMPTS["empathy"]))

    # 응답 길이 지시어
    parts.append(LENGTH_INSTRUCTIONS.get(length, LENGTH_INSTRUCTIONS["normal"]))

    # 오늘 컨텍스트
    context = f"\n【오늘 정보】\n날짜: {entry_date}\n"
    if categories:
        context += f"카테고리: {', '.join(categories)}\n"
    parts.append(context)

    return "\n".join(parts)

def build_conversation_messages(
    journal_content: str,
    recent_summaries: list[str],
    extraction: Optional[dict],
    history: list[dict],
) -> list[dict]:
    """
    Claude에 보낼 messages 배열 조립.
    - 첫 user 메시지에 [오늘 일기] 컨텍스트를 넣는다.
    - 이어지는 대화에서도 history에 컨텍스트가 없으면 앞에 prepend 해서 주제 드리프트를 줄인다.
    """
    context_parts = [f"[오늘 일기]\n{journal_content}"]

    if recent_summaries:
        context_parts.append(
            f"\n[최근 {len(recent_summaries)}일 요약]\n" + "\n".join(f"- {s}" for s in recent_summaries)
        )

    if extraction:
        mood_kws = extraction.get("mood_keywords", [])
        stress = extraction.get("stress_indicators", [])
        if mood_kws:
            context_parts.append(f"\n[감정 키워드] {', '.join(mood_kws)}")
        if stress:
            context_parts.append(f"[스트레스 징후] {', '.join(stress)}")

    entry_message = "\n".join(context_parts)

    # history가 없으면 첫 메시지로 컨텍스트를 보냄
    if not history:
        return [{"role": "user", "content": entry_message}]

    # history가 있는데 컨텍스트가 포함되어 있지 않으면 prepend
    first = history[0].get("content", "") if isinstance(history[0], dict) else ""
    if "[오늘 일기]" not in str(first):
        return [{"role": "user", "content": entry_message}] + history

    return history


def build_chat_opener_system(
    user_name: Optional[str] = None,
    ai_name: Optional[str] = None,
    entry_date: Optional[str] = None,
) -> str:
    """대화 시작 시 AI가 먼저 건네는 opener 메시지용 system prompt."""
    from datetime import date as _date
    identity = ai_name if ai_name else "따뜻하고 공감적인 마음 일기 동반자"
    name_part = f" {user_name}님께" if user_name else ""

    today = str(_date.today())
    is_past = entry_date and entry_date < today

    if is_past:
        # 과거 날짜: 그 날에 대한 이야기를 회고하러 온 맥락
        try:
            from datetime import datetime
            d = datetime.strptime(entry_date, '%Y-%m-%d')
            date_label = f"{d.month}월 {d.day}일"
        except Exception:
            date_label = entry_date
        context = f"{date_label}의 이야기를 돌아보러 온{name_part} 사용자에게"
    else:
        context = f"오늘 일기를 쓰러 온{name_part} 사용자에게"

    return (
        f"당신은 {identity}입니다. "
        f"{context} 자연스럽고 따뜻하게 첫 인사를 건네세요. "
        "1~2문장으로 짧게, 마크다운 없이 일반 텍스트로만 작성하세요. "
        "질문을 하나 곁들여도 좋지만 강요하지 마세요."
    )