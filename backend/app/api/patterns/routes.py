"""
패턴 분석 API 엔드포인트 고도화.

GET    /api/patterns           — 패턴 로그 목록 (최신순)
POST   /api/patterns/generate  — 수동 분석 트리거
GET    /api/patterns/insights  — 통합 인사이트
PATCH  /api/patterns/:id       — 개별 패턴 로그 수정 (사용자 수동 수정)
DELETE /api/patterns/:id       — 개별 패턴 로그 삭제
"""
from __future__ import annotations
import logging
from collections import Counter, defaultdict
from datetime import date, timedelta

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.pattern_log import PatternLog
from app.models.journal_entry import JournalEntry
from app.models.user_profile import UserProfile
from app.utils.helpers import api_response, api_error

patterns_bp = Blueprint('patterns', __name__, url_prefix='/api/patterns')
logger = logging.getLogger(__name__)

DAY_KO = ['월', '화', '수', '목', '금', '토', '일']


@patterns_bp.route('', methods=['GET'])
@jwt_required()
def list_patterns():
    """패턴 로그 목록 반환 (최신순, 최대 50개)."""
    user_id = get_jwt_identity()
    limit = min(request.args.get('limit', 10, type=int), 50)
    log_type = request.args.get('type')

    query = (
        PatternLog.query
        .filter_by(user_id=user_id)
        .order_by(PatternLog.generated_at.desc())
    )
    if log_type:
        query = query.filter_by(log_type=log_type)

    logs = query.limit(limit).all()
    return api_response({'patterns': [l.to_dict() for l in logs]})


@patterns_bp.route('/<uuid:log_id>', methods=['PATCH'])
@jwt_required()
def update_pattern_log(log_id):
    """사용자가 AI의 분석 내용(변화 로그)을 직접 수정."""
    user_id = get_jwt_identity()
    log = PatternLog.query.filter_by(id=str(log_id), user_id=user_id).first_or_404()

    data = request.get_json(silent=True) or {}
    if 'body' in data:
        log.body = data['body']
        log.is_edited = True
        db.session.commit()
        return api_response({
            'message': '로그가 수정되었습니다.',
            'pattern': log.to_dict()
        })

    return api_error('수정할 내용이 없습니다.', 400)


@patterns_bp.route('/<uuid:log_id>', methods=['DELETE'])
@jwt_required()
def delete_pattern_log(log_id):
    """특정 패턴 로그 삭제."""
    user_id = get_jwt_identity()
    log = PatternLog.query.filter_by(id=str(log_id), user_id=user_id).first_or_404()
    
    db.session.delete(log)
    db.session.commit()
    return api_response({'message': '해당 변화 로그가 삭제되었습니다.'})


@patterns_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_pattern():
    """수동 패턴 분석 트리거. period_type: 'weekly' | 'monthly' | 'semiannual'"""
    user_id = get_jwt_identity()
    body = request.get_json(silent=True, force=True) or {}
    period_type = body.get('period_type', 'weekly')
    if period_type not in ('weekly', 'monthly', 'semiannual'):
        period_type = 'weekly'

    try:
        from app.services.pattern_analyzer import analyze_patterns
        log = analyze_patterns(user_id, period_type=period_type)
        if log:
            return api_response({'pattern': log.to_dict()}, status=201)
        return api_error('이 기간에 마무리한 일기가 없어요. 일기를 작성한 뒤 다시 시도해보세요.', 400)
    except Exception as e:
        logger.error(f'패턴 분석 실패: {e}')
        return api_error('분석 중 오류가 발생했습니다.', 500)


@patterns_bp.route('/insights', methods=['GET'])
@jwt_required()
def get_insights():
    """통합 인사이트 응답 (기존 로직 유지)"""
    user_id = get_jwt_identity()
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    today = date.today()
    cutoff_30 = today - timedelta(days=30)
    cutoff_60 = today - timedelta(days=60)
    cutoff_90 = today - timedelta(days=90)

    entries_30 = (
        JournalEntry.query
        .filter_by(user_id=user_id, is_draft=False)
        .filter(JournalEntry.deleted_at.is_(None))
        .filter(JournalEntry.entry_date >= cutoff_30)
        .order_by(JournalEntry.entry_date)
        .all()
    )

    mood_data = [
        {
            'date': str(e.entry_date),
            'mood': e.mood_score,
            'energy': e.energy_score,
            'summary': e.daily_summary,
        }
        for e in entries_30
    ]

    mood_scores_30 = [e.mood_score for e in entries_30 if e.mood_score]
    avg_mood_30 = round(sum(mood_scores_30) / len(mood_scores_30), 1) if mood_scores_30 else None

    distortion_counter: Counter = Counter()
    for entry in entries_30:
        if entry.ai_extraction and entry.ai_extraction.cognitive_distortions:
            for d in entry.ai_extraction.cognitive_distortions:
                dtype = d.get('type', '').strip()
                if dtype:
                    distortion_counter[dtype] += 1

    total_d = sum(distortion_counter.values())
    distortion_stats = [
        {
            'type': dtype,
            'count': count,
            'percentage': round(count / total_d * 100) if total_d > 0 else 0,
        }
        for dtype, count in distortion_counter.most_common(10)
    ]

    day_mood_map: dict = defaultdict(list)
    for entry in entries_30:
        dow = entry.entry_date.weekday()
        if entry.mood_score:
            day_mood_map[dow].append(entry.mood_score)

    day_risk = [
        {
            'day': DAY_KO[i],
            'avg_mood': round(sum(day_mood_map[i]) / len(day_mood_map[i]), 1) if day_mood_map[i] else None,
            'entry_count': len(day_mood_map[i]),
        }
        for i in range(7)
    ]

    entries_old = (
        JournalEntry.query
        .filter_by(user_id=user_id, is_draft=False)
        .filter(JournalEntry.deleted_at.is_(None))
        .filter(JournalEntry.entry_date >= cutoff_90)
        .filter(JournalEntry.entry_date < cutoff_60)
        .all()
    )

    def _avg(lst):
        vals = [v for v in lst if v is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    def _mood_ratio(entries):
        scores = [e.mood_score for e in entries if e.mood_score]
        if not scores:
            return {'positive': 0, 'neutral': 0, 'negative': 0}
        total = len(scores)
        return {
            'positive': round(sum(1 for s in scores if s >= 7) / total * 100),
            'neutral': round(sum(1 for s in scores if 4 <= s <= 6) / total * 100),
            'negative': round(sum(1 for s in scores if s <= 3) / total * 100),
        }

    def _avg_sentiment(entries):
        scores = [
            e.ai_extraction.sentiment_score
            for e in entries
            if e.ai_extraction and e.ai_extraction.sentiment_score is not None
        ]
        return round(sum(scores) / len(scores), 2) if scores else None

    change_evidence = {
        'recent': {
            'label': '최근 30일',
            'avg_mood': _avg([e.mood_score for e in entries_30]),
            'avg_sentiment': _avg_sentiment(entries_30),
            'entry_count': len(entries_30),
            'mood_ratio': _mood_ratio(entries_30),
        },
        'old': {
            'label': '60-90일 전',
            'avg_mood': _avg([e.mood_score for e in entries_old]),
            'avg_sentiment': _avg_sentiment(entries_old),
            'entry_count': len(entries_old),
            'mood_ratio': _mood_ratio(entries_old),
        },
    }

    entries_90 = (
        JournalEntry.query
        .filter_by(user_id=user_id, is_draft=False)
        .filter(JournalEntry.deleted_at.is_(None))
        .filter(JournalEntry.entry_date >= cutoff_90)
        .all()
    )

    hour_mood: dict = defaultdict(list)
    for entry in entries_90:
        if entry.created_at:
            h = entry.created_at.hour
            hour_mood[h].append(entry.mood_score)

    time_patterns = [
        {
            'hour': h,
            'entry_count': len(hour_mood[h]),
            'avg_mood': _avg([v for v in hour_mood[h] if v is not None]),
        }
        for h in sorted(hour_mood.keys())
    ]

    latest_pattern = (
        PatternLog.query
        .filter_by(user_id=user_id)
        .order_by(PatternLog.generated_at.desc())
        .first()
    )

    return api_response({
        'profile': profile.to_dict() if profile else None,
        'mood_data': mood_data,
        'stats': {
            'total_entries_30d': len(entries_30),
            'avg_mood_30d': avg_mood_30,
        },
        'latest_pattern': latest_pattern.to_dict() if latest_pattern else None,
        'distortion_stats': distortion_stats,
        'day_risk': day_risk,
        'change_evidence': change_evidence,
        'time_patterns': time_patterns,
    })