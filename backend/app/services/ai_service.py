"""
Anthropic Claude API 래퍼.
모든 Claude API 호출은 이 모듈을 통해 이루어진다.
"""
from __future__ import annotations

import anthropic
from flask import current_app
from typing import Optional

# 모델 상수
MODEL_HAIKU = "claude-haiku-4-5-20251001"   # 추출/요약: 빠르고 저렴
MODEL_SONNET = "claude-sonnet-4-6"          # 대화/분석: 높은 품질

def _get_client() -> anthropic.Anthropic:
    api_key = current_app.config.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
    return anthropic.Anthropic(api_key=api_key)

def _max_tokens_for(response_length: str = "normal", response_mode: Optional[str] = None) -> int:
    """
    무드/길이에 따라 출력 토큰 상한을 조절해서
    friend/objective는 짧게, advice는 길게 강제한다.
    """
    # 길이 기본
    base = {
        "short": 160,   # 1~3문장 정도
        "normal": 360,  # 4~7문장 정도
        "long": 800,    # 8~14문장 정도
    }.get(response_length or "normal", 360)

    # 무드 보정(조언/친구/객관 강제 느낌)
    if response_mode in ("friend", "objective"):
        return min(base, 200)
    if response_mode == "advice":
        return max(base, 700)
    return base

def call_claude(
    messages: list[dict],
    system_prompt: str,
    model: str = MODEL_HAIKU,
    max_tokens: Optional[int] = None,
    response_length: str = "normal",
    response_mode: Optional[str] = None,
) -> tuple[str, dict]:
    """
    Claude에 메시지를 보내고 (응답 텍스트, 사용 통계) 를 반환한다.
    - max_tokens를 명시하지 않으면 response_length/response_mode로 자동 계산
    """
    client = _get_client()
    if max_tokens is None:
        max_tokens = _max_tokens_for(response_length=response_length, response_mode=response_mode)

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    )

    text = response.content[0].text
    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "model": model,
        "max_tokens": max_tokens,
    }
    return text, usage

def stream_claude(
    messages: list[dict],
    system_prompt: str,
    model: str = MODEL_SONNET,
    max_tokens: Optional[int] = None,
    response_length: str = "normal",
    response_mode: Optional[str] = None,
):
    """
    Claude 응답을 스트리밍 방식으로 반환하는 제너레이터.
    Phase 4 AI 대화에 사용.
    - max_tokens를 명시하지 않으면 response_length/response_mode로 자동 계산
    """
    client = _get_client()
    if max_tokens is None:
        max_tokens = _max_tokens_for(response_length=response_length, response_mode=response_mode)

    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text_chunk in stream.text_stream:
            yield text_chunk