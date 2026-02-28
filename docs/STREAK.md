# Streak(연속 기록일) 계산

## 기준 (코드/주석과 동일)

- **타임존**: Asia/Seoul (KST) 통일.
- **"오늘"**: KST 기준 오늘 날짜 (`today_kst()`).
- **표시 의도**: "오늘 기록했으면 오늘 포함". 오늘부터 과거로 연속된 기록일 수를 카운트한다.
- **기록 1건**: 해당 날짜에 비초안·미삭제 일기가 1건 이상 있는 것. 하루에 여러 건이어도 1일로 센다.

## 수정 요약 (원인 3줄)

1. **기존**: `consecutive_days`를 증분으로만 갱신하고, `entry_date` 기본값에 서버 `date.today()`(UTC 등)를 사용해 날짜가 어긋날 수 있었음.
2. **원인**: 서버 타임존과 KST 불일치·증분 로직만으로는 “오늘 포함 연속일”이 정확히 나오지 않음.
3. **조치**: KST 오늘 기준으로, 실제 기록(일기) 날짜만 모아서 **매번 재계산**하도록 통일하고, 일기 저장 시와 GET /api/users/me 호출 시 모두 이 값으로 갱신해 표시.

## 수정 파일

- `backend/app/utils/timezone_utils.py` — KST 오늘, streak 재계산, `compute_streak_count` (테스트용)
- `backend/app/api/entries/routes.py` — 일기 저장 시 `today_kst()`로 기본 `entry_date`, streak는 재계산으로 갱신
- `backend/app/api/users/routes.py` — GET /me 시 streak 재계산 후 반환
- `backend/tests/test_streak.py` — streak 단위 테스트
- `docs/STREAK.md` — 본 문서

## 테스트 방법

### 1) 단위 테스트 (복붙)

```bash
cd backend
pip install -r requirements.txt   # pytest 포함
python3 -m pytest tests/test_streak.py -v
```

기대: 케이스1~4 및 기타 테스트 전부 통과.

### 2) 케이스별 기대값

| 케이스 | 조건 | 기대 streak |
|--------|------|-------------|
| 1 | 오늘만 기록 | 1 |
| 2 | 어제+오늘 기록 | 2 |
| 3 | 이틀 전 기록, 어제 없음, 오늘 기록 | 1 |
| 4 | 21일 23:50 + 22일 00:10 (KST) → 21일·22일 모두 기록 있음, today=22일 | 2 |

### 3) 수동 확인 (앱 + API)

1. 백엔드 실행 후 로그인, GET `/api/users/me`에서 `profile.consecutive_days` 확인.
2. 오늘 일기 1건 저장(비초안) 후 다시 GET /me → streak 1.
3. (테스트용) 어제 날짜 일기 추가 저장 후 GET /me → streak 2 (오늘+어제 연속).
