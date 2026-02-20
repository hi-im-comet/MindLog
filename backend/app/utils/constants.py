RESPONSE_MODES = ('empathetic', 'advice', 'pattern_recognition')

DEFAULT_CATEGORIES = [
    {'name': '업무', 'icon': '💼', 'color': '#4A90E2', 'display_order': 0},
    {'name': '기분', 'icon': '😊', 'color': '#F5A623', 'display_order': 1},
    {'name': '수면', 'icon': '🌙', 'color': '#7B68EE', 'display_order': 2},
    {'name': '식사', 'icon': '🍽️', 'color': '#50C878', 'display_order': 3},
    {'name': '운동', 'icon': '🏃', 'color': '#FF6B6B', 'display_order': 4},
    {'name': '관계', 'icon': '👥', 'color': '#FFB347', 'display_order': 5},
]

# Crisis-related keywords for detection (Korean + English)
CRISIS_KEYWORDS = [
    '죽고 싶', '자살', '자해', '살기 싫', '없어지고 싶', '사라지고 싶',
    '더 이상 살', '끝내고 싶', '끝내버리고', '목숨', '극단적',
    'suicidal', 'kill myself', 'end my life', 'self harm', 'want to die',
    'not worth living', 'hurt myself',
]

CRISIS_RESOURCES = {
    'ko': {
        'hotline': '자살예방상담전화 1393 (24시간)',
        'text': '정신건강 위기상담전화 1577-0199',
        'emergency': '응급: 119',
    },
    'en': {
        'hotline': 'National Suicide Prevention Lifeline: 988',
        'text': 'Crisis Text Line: Text HOME to 741741',
        'emergency': 'Emergency: 911',
    },
}
