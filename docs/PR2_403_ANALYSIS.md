# 회원가입 403 원인 확정 (PR2)

## 1) 프론트 요청 점검

- **URL**: `apiClient.post('/api/auth/register', data)` → `baseURL`이 비어 있으면 **같은 origin** 요청.
  - `frontend/src/api/client.ts` 4행: `const BASE_URL = import.meta.env.VITE_API_URL || ''`
  - `frontend/src/api/auth.ts` 11행: `apiClient.post<...>('/api/auth/register', data)`
- **실제 Request URL**: Vite proxy 사용 시 브라우저 기준 **`http://localhost:5173/api/auth/register`** (상대 경로 `/api/...`가 5173으로 나감).
- **헤더**: `Content-Type: application/json`, (로그인 전이므로) `Authorization` 없음.
- **credentials**: axios 기본값 `withCredentials: false` → 별도 설정 없음. CORS `supports_credentials: True`와 무관하게 쿠키 미전송.

**결론**: 프론트는 `localhost:5173/api/...` 형태로 요청하며, Vite가 이를 `localhost:5000`으로 프록시함.

---

## 2) 백엔드에서 403을 발생시키는 코드 경로

- **CORS**: `backend/app/__init__.py` 14–22행. `origins: [FRONTEND_URL]`만 허용. Origin 불일치 시 Flask-CORS는 403을 반환하지 않고 **헤더만 생략**하며, 브라우저가 차단. 다만 프록시 사용 시 동일 origin이라 CORS 자체는 의심 낮음.
- **CSRF/Flask-WTF**: `requirements.txt` 및 전역 검색 결과 **미사용**. 403 원인 아님.
- **인증 데코레이터**: `backend/app/api/auth/routes.py` 22–24행. `/register`에는 `@limiter.limit('10 per hour')`만 있고 **`@jwt_required()` 없음**. 403 원인 아님.
- **origin/FRONTEND_URL 검사**: 별도 커스텀 검사 없음.

**실제 403 원인 (근거)**:

- **Flask-Limiter `key_func`이 None을 반환하는 경우 403 발생** (공식 이슈/문서: [alisaifee/flask-limiter#186](https://github.com/alisaifee/flask-limiter/issues/186), "may result in a 403 Forbidden response").
- `backend/app/extensions.py` 11행: `limiter = Limiter(key_func=get_remote_address)`.
- `get_remote_address`는 Flask의 `request.remote_addr` 사용. **프록시/도커 환경**에서는 `request.remote_addr`가 비어 있거나 None이 될 수 있음.
- `RATELIMIT_ENABLED = False`(`config.py` 47행)여도, 일부 버전/상황에서 limiter 데코레이터가 실행되며 `key_func()`를 호출하고, 이때 **None이 반환되면 403**이 난다.

**정리**: 403의 확정 원인은 **Flask-Limiter의 `key_func`(get_remote_address)이 프록시/도커 환경에서 None을 반환할 수 있어, limiter가 403을 반환하는 것**이다. (동시에 dev에서 CORS 허용을 localhost/127.0.0.1 둘 다 허용하도록 보완하면, 직접 5000 호출 시에도 403 가능성을 줄일 수 있음.)

---

## 3) 수정 사항 (PR2)

- **key_func이 절대 None을 반환하지 않도록** `extensions.py`에서 래퍼 사용: `(get_remote_address() or "proxy")`.
- **개발 환경 CORS**: `FRONTEND_URL` 외에 `http://127.0.0.1:5173`도 허용 (브라우저가 127.0.0.1로 보낼 때 대비).
- 기능 로직(날짜, streak, 비밀번호)은 변경하지 않음.

---

## 4) 수정 후 회원가입(signup) 200/201 확인 방법

아래 문서 참고: **`docs/DEV_SETUP.md`** 섹션 "회원가입(signup) 성공 확인".

---

## 5) 403 지속 시 추가 수정 (signup/login limiter 제거)

- **원인 확정**: 앱 코드에서 403을 반환하는 곳은 `backend/app/api/conversations/routes.py` 223행(삭제 권한)뿐이며, signup과 무관. 따라서 signup 403은 **Flask-Limiter**가 `@limiter.limit` 적용 시 Redis/스토리지 또는 key 처리 과정에서 403을 반환하는 경우로 추정.
- **처방**: signup/login(및 Google 로그인)은 인증 예외로 두고, **rate limit 데코레이터를 제거**하여 limiter가 해당 라우트를 처리하지 않도록 함.
- **수정**: `backend/app/api/auth/routes.py`에서 `/register`, `/login`, `/google` 라우트의 `@limiter.limit(...)` 제거 및 `limiter` import 제거.

### curl 재현 테스트

**성공 (201)**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"userNickname":"테스트","aiNickname":"마음친구","email":"test@example.com","password":"MyPass123!"}'
```

- 기대: 본문에 `"success": true`, `"data"` 내 `user`, `access_token`, `refresh_token` 포함, 마지막 줄 `HTTP_CODE:201`.

**실패 – 검증 (400)**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"userNickname":"테스트","aiNickname":"마음친구","email":"invalid","password":"short"}'
```

- 기대: `"success": false`, `"error"`에 검증 메시지, `HTTP_CODE:400`.

**실패 – 이메일 중복 (409)**

```bash
# 위 성공 케이스를 한 번 실행한 뒤, 같은 이메일로 재요청
curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"userNickname":"다른닉","aiNickname":"친구","email":"test@example.com","password":"MyPass123!"}'
```

- 기대: `"success": false`, `"error": "이미 사용 중인 이메일입니다."`, `HTTP_CODE:409`.
