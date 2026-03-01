"""
Web Push (VAPID) 알림 서비스.
pywebpush를 사용해 브라우저 푸시 구독에 알림을 발송한다.
"""
from __future__ import annotations
import json
import os
import logging
from datetime import datetime, timezone

from flask import current_app

logger = logging.getLogger(__name__)


def send_push_to_user(user_id: str, payload: dict) -> int:
    """
    사용자의 모든 활성 구독에 푸시 알림을 발송한다.
    발송에 성공한 구독 수를 반환한다.
    """
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning('pywebpush가 설치되지 않아 푸시 알림을 발송할 수 없습니다.')
        return 0

    from app.extensions import db
    from app.models.push_subscription import PushSubscription

    vapid_private_key = current_app.config.get('VAPID_PRIVATE_KEY', '')
    vapid_claims = {
        'sub': current_app.config.get('VAPID_CLAIMS_SUB', 'mailto:admin@mindlog.app')
    }

    if not vapid_private_key:
        logger.warning('VAPID_PRIVATE_KEY가 설정되지 않아 푸시 알림을 발송할 수 없습니다.')
        return 0

    subs = PushSubscription.query.filter_by(user_id=user_id, is_active=True).all()
    sent = 0

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
            )
            sub.last_used_at = datetime.now(timezone.utc)
            sent += 1
        except Exception as e:
            # 404/410: 구독이 만료됨 → 비활성화
            status_code = getattr(getattr(e, 'response', None), 'status_code', None)
            if status_code in (404, 410):
                sub.is_active = False
                logger.info(f'푸시 구독 만료 비활성화: {sub.id}')
            else:
                logger.error(f'푸시 발송 실패 sub={sub.id}: {e}')

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return sent
