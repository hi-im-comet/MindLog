# MINDLOG 개발 환경 설정

## 1. 리포지토리 구조

```
mindlog/
├── backend/                 # Flask API (Python 3.12)
│   ├── app/
│   │   ├── api/             # Blueprint 라우트 (auth, entries, users, categories, conversations, patterns)
│   │   ├── models/          # SQLAlchemy 모델
│   │   ├── services/        # 비즈니스 로직
│   │   ├── tasks/           # Celery 태스크
│   │   ├── __init__.py      # 앱 팩토리, CORS, Blueprint 등록
│   │   ├── config.py        # 설정 (Config, DevelopmentConfig, TestingConfig, ProductionConfig)
│   │   └── extensions.py    # db, migrate, jwt, limiter, cors
│   ├── migrations/          # Alembic DB 마이그레이션
│   ├── Dockerfile           # gunicorn 0.0.0.0:5000
│   ├── requirements.txt
│   ├── wsgi.py              # 앱 진입점 (FLASK_ENV 사용)
│   └── .env / .env.example
├── frontend/                # React + Vite + TypeScript
│   ├── src/
│   │   ├── api/             # apiClient (axios), auth, entries, users, categories, conversations, patterns
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   └── main.tsx, App.tsx
│   ├── vite.config.ts       # dev server 5173, proxy /api -> target
│   ├── package.json
│   └── .env / .env.example
├── docker-compose.yml       # postgres, redis, backend, celery_worker (frontend 없음)
└── docs/
    └── DEV_SETUP.md         # 본 문서
```

---

## 2. Backend 실행 방법

### 요구 사항

- Python 3.12
- PostgreSQL 16 (로컬 또는 Docker)
- Redis (로컬 또는 Docker)

### 로컬에서 Backend만 실행

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # 필요 시 값 수정 (DATABASE_URL, REDIS_URL, SECRET_KEY, JWT 등)
flask db upgrade
flask run --host=0.0.0.0 --port=5000
# 또는: gunicorn --bind 0.0.0.0:5000 --reload --workers 2 wsgi:app
```

- 기본 포트: **5000**
- 환경 변수 `FLASK_ENV=development` 이면 `DevelopmentConfig` 사용 (RATELIMIT_ENABLED=False 등).

### Docker Compose로 Backend + DB + Redis + Celery 실행

```bash
# 프로젝트 루트에서
cp backend/.env.example backend/.env   # 필요 시 수정 (GOOGLE_CLIENT_ID, ANTHROPIC_API_KEY 등은 선택)
docker compose up -d postgres redis    # DB/Redis 먼저
docker compose up --build backend celery_worker
```

- Backend: **http://localhost:5000**
- `backend/.env` 의 `DATABASE_URL` / `REDIS_URL` 은 docker-compose에서 덮어써서 컨테이너 내부는 `postgres:5432`, `redis:6379` 로 연결됨.
- `FRONTEND_URL` 은 docker-compose에서 설정하지 않으므로 `backend/.env` 값 사용 (CORS용). 로컬에서 프론트를 띄우면 `http://localhost:5173` 이어야 함.

---

## 3. Frontend 실행 방법

### 요구 사항

- Node.js (LTS 권장)
- npm 또는 yarn

### 로컬에서 Frontend만 실행

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, VITE_GOOGLE_CLIENT_ID 등 선택 설정
npm run dev
```

- 기본 주소: **http://localhost:5173** (Vite `server.port: 5173`).
- API 호출: `frontend/src/api/client.ts` 에서 `BASE_URL = import.meta.env.VITE_API_URL || ''` 사용.
  - `VITE_API_URL` 비어 있으면 상대 경로 요청 → Vite dev server 가 `/api` 를 proxy 대상으로 전달.
  - `VITE_API_URL` 이 있으면 해당 URL 로 직접 요청 (CORS 필요).

---

## 4. Docker Compose와 Frontend 연동 시 참고

- **docker-compose.yml** 에는 **frontend 서비스가 없음**. 프론트는 호스트에서 `npm run dev` 로 띄우는 구성을 전제로 함.
- Backend는 컨테이너에서 **5000** 포트로 노출되므로, 프론트가 백엔드를 호출하려면:
  - **방식 A**: `VITE_API_URL=` 비우고, Vite proxy 의 target 만 백엔드 주소(예: `http://localhost:5000`)로 맞추기.
  - **방식 B**: `VITE_API_URL=http://localhost:5000` 으로 두고, 백엔드 CORS 에 `http://localhost:5173` 이 허용되도록 `FRONTEND_URL` 설정.

---

## 5. 포트 / baseURL / CORS·프록시 정리

| 구분 | 설정 위치 | 값 | 비고 |
|------|-----------|-----|------|
| **Backend 포트** | `docker-compose.yml` (backend.ports) | `5000:5000` | 컨테이너 내부 gunicorn 5000 |
| | `backend/wsgi.py` (로컬 run 시) | `5000` | `app.run(host='0.0.0.0', port=5000)` |
| | `backend/Dockerfile` | `EXPOSE 5000` | 문서용 |
| **Frontend 포트** | `frontend/vite.config.ts` (server.port) | `5173` | Vite dev server |
| **Frontend → Backend baseURL** | `frontend/src/api/client.ts` | `import.meta.env.VITE_API_URL \|\| ''` | 빈 값이면 같은 origin(프록시 사용) |
| | `frontend/.env.example` | `VITE_API_URL=` | 비어 있음 → 프록시 사용 가정 |
| **Vite proxy** | `frontend/vite.config.ts` (server.proxy) | `/api` → `http://localhost:5000` | PR1에서 5000으로 통일 |
| **Backend CORS** | `backend/app/__init__.py` | `FRONTEND_URL` 기준 `origins` | `/api/*` 에만 적용 |
| | `backend/app/config.py` | `FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')` | 기본값 5173 |
| | `backend/.env.example` | `FRONTEND_URL=http://localhost:5173` | CORS 허용 origin |

- **정리**: Backend **5000**, Frontend **5173**. Vite proxy target **5000** 사용 시 브라우저는 `localhost:5173`으로만 요청하므로 CORS는 백엔드가 localhost/127.0.0.1:5173 허용하면 됨 (PR2에서 dev 시 둘 다 허용).

---

## 6. 회원가입(signup) 성공 확인 방법

PR2 적용 후, 회원가입이 **200/201**으로 성공하는지 아래 순서로 확인한다.

### 사전 조건

- Backend: `docker compose up backend` 또는 로컬 `flask run --host=0.0.0.0 --port=5000`
- Frontend: `cd frontend && npm run dev` (Vite 5173, `VITE_API_URL` 비움 → proxy 사용)

### 방법 A: 브라우저에서 UI로 확인

1. **http://localhost:5173/register** 접속.
2. 닉네임, 이메일, 비밀번호(8자 이상), 비밀번호 확인 입력 후 **시작하기** 클릭.
3. **성공 시**: 201 응답 후 온보딩 페이지(`/onboarding`)로 이동.
4. **실패 시**: 개발자 도구(F12) → Network 탭에서 `register` 요청 선택 후 **Status** 확인.
   - **403**이면 PR2 원인 문서 `docs/PR2_403_ANALYSIS.md` 및 limiter/CORS 수정 적용 여부 확인.
   - **422**는 입력값 검증 실패(이메일 형식, 비밀번호 일치 등).

### 방법 B: curl로 백엔드 직접 호출

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"display_name":"테스트","email":"test@example.com","password":"password123"}'
```

- **201** 출력 시 정상. (같은 이메일로 재요청 시 **409** 예상.)
