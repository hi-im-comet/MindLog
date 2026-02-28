# MINDLOG 연동 분석 및 수정 계획

## 현재 연동이 안 되는 원인 후보 (5개)

아래는 docker-compose 기반으로 frontend(로컬) + backend(컨테이너) 연동이 안 될 때 점검할 수 있는 후보와 근거입니다.

---

### 1. Vite proxy target 포트 불일치 (5001 vs 5000)

| 항목 | 내용 |
|------|------|
| **파일/라인** | `frontend/vite.config.ts` 14–18행 |
| **내용** | `server.proxy['/api'].target` 이 `http://localhost:5001` 로 되어 있음. |
| **근거** | docker-compose 와 backend Dockerfile/wsgi 는 모두 **5000** 포트 사용. 프론트만 5001 로 프록시하면 백엔드에 연결되지 않음. |
| **증상** | `VITE_API_URL` 비운 상태에서 브라우저가 `/api/*` 요청 시 Vite 가 5001 로 전달 → 5001 에 서버가 없으면 connection refused 등. |

```ts
// frontend/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:5001',  // ← backend는 5000
    changeOrigin: true,
  },
},
```

---

### 2. Docker Compose에 frontend 서비스 없음 + FRONTEND_URL 미오버라이드

| 항목 | 내용 |
|------|------|
| **파일/라인** | `docker-compose.yml` 전체, `backend/app/config.py` 36행 |
| **내용** | compose 에는 postgres, redis, backend, celery_worker 만 있고 frontend 는 없음. Backend 의 `FRONTEND_URL` 은 compose 에서 설정하지 않아 `backend/.env` 값에 의존. |
| **근거** | 개발자가 `backend/.env` 를 만들지 않거나 `FRONTEND_URL` 을 빼두면 `config.py` 기본값 `http://localhost:5173` 이 사용됨. 반대로 배포/다른 origin 을 쓰는 경우 CORS 가 막힐 수 있음. 로컬 5173 기준으로는 기본값이 맞지만, 문서화 부재 시 팀원이 잘못 설정하기 쉬움. |
| **증상** | CORS preflight 실패, 브라우저 콘솔 CORS 에러. |

---

### 3. Frontend API baseURL 과 fetch 경로 불일치 가능성

| 항목 | 내용 |
|------|------|
| **파일/라인** | `frontend/src/api/client.ts` 4행, `frontend/src/api/conversations.ts` 64행 |
| **내용** | `apiClient` 는 `BASE_URL`(=`VITE_API_URL` or '') 을 쓰지만, SSE용 `fetch()` 는 상대 경로 `/api/conversations/${convId}/messages` 만 사용. |
| **근거** | `VITE_API_URL=http://localhost:5000` 으로 두면 apiClient 요청은 5000 으로 가고, 같은 페이지의 fetch 는 현재 origin(5173)으로 감. Vite proxy 가 `/api` 만 5000 으로 돌려주면 둘 다 5000 에 도달하지만, 나중에 proxy 를 제거하거나 빌드 환경에서 base URL 을 쓰면 fetch 만 5173 으로 가서 실패할 수 있음. |
| **증상** | 로그인/일반 API 는 되는데, 대화 메시지 전송(SSE) 만 실패하거나 잘못된 origin 으로 요청. |

```ts
// frontend/src/api/conversations.ts:64
const response = await fetch(`/api/conversations/${convId}/messages`, {
```

---

### 4. Backend .env 파일 없이 compose up 시 CORS/기타 기본값 의존

| 항목 | 내용 |
|------|------|
| **파일/라인** | `docker-compose.yml` 36–38행 (`env_file: ./backend/.env`), `backend/app/config.py` 36행 |
| **내용** | `env_file: ./backend/.env` 로 지정되어 있어, `.env` 가 없으면 해당 파일이 없다는 에러로 compose 가 실패할 수 있음. (버전에 따라 무시될 수도 있음.) |
| **근거** | `.env` 가 없으면 `FRONTEND_URL` 은 config 기본값으로만 동작. 반대로 `.env` 에 잘못된 `FRONTEND_URL`(예: 트레일링 슬래시, 다른 포트)이 있으면 CORS 가 거절됨. |
| **증상** | compose up 실패 또는 CORS 에러. |

---

### 5. Backend CORS가 /api/* 에만 적용됨

| 항목 | 내용 |
|------|------|
| **파일/라인** | `backend/app/__init__.py` 14–21행 |
| **내용** | `cors.init_app(app, resources={ r"/api/*": { ... } })` 로 `/api/*` 경로에만 CORS 적용. `/health` 등은 CORS 헤더가 없을 수 있음. |
| **근거** | 프론트가 실제로 호출하는 건 모두 `/api/...` 이므로 연동 실패의 직접 원인은 아닐 수 있음. 다만 브라우저에서 직접 `/health` 를 찍거나, 프록시 없이 다른 경로를 호출할 때 CORS 이슈가 보일 수 있음. |
| **증상** | `/api` 가 아닌 엔드포인트를 브라우저에서 호출 시 CORS 에러. |

```py
# backend/app/__init__.py:14-21
cors.init_app(app, resources={
    r"/api/*": {
        "origins": [app.config['FRONTEND_URL']],
        ...
    }
})
```

---

## 최소 수정으로 연동되게 하는 변경 계획 (PR 단위)

코드는 아직 수정하지 않고, 계획만 제안합니다.

---

### PR1: 연동/환경 (Docker + 프록시 + 문서)

- **목표**: docker-compose backend + 로컬 frontend 가 같은 머신에서 바로 연동되게 함.
- **내용**  
  - **frontend/vite.config.ts**: proxy `/api` target 을 `http://localhost:5001` → `http://localhost:5000` 으로 변경.  
  - **backend/.env.example**: `FRONTEND_URL=http://localhost:5173` 유지하고, 주석으로 “로컬 프론트 dev 서버 주소, CORS용” 설명 추가.  
  - **frontend/.env.example**: `VITE_API_URL=` 비움 유지하고, 주석으로 “비워두면 Vite가 /api 를 backend(5000)로 프록시” 설명 추가.  
  - **docs/DEV_SETUP.md**: 이미 작성된 포트/프록시/CORS 표와 “Docker Backend + 로컬 Frontend” 절차 한 번 더 명시 (위 변경 반영).
- **검증**: `docker compose up backend` 후 `cd frontend && npm run dev` → 로그인/API 호출 성공.

---

### PR2: 인증/토큰 (선택)

- **목표**: JWT 만료/리프레시, 쿠키/스토리지 정책을 정리해 인증 끊김 최소화.
- **내용** (필요 시만):  
  - refresh 토큰 재사용/만료 정책 점검,  
  - `client.ts` 리프레시 실패 시 로그아웃 처리 유지 여부 확인,  
  - CORS `supports_credentials: True` 와 쿠키 사용 시 SameSite/Secure 등 정리.  
- **검증**: 로그인 → 토큰 만료 후 자동 갱신 또는 로그아웃 처리 확인.

---

### PR3: SSE/API 경로 일관성 (선택)

- **목표**: `VITE_API_URL` 이 설정된 환경에서도 대화 메시지(SSE) 요청이 백엔드를 바라보도록 통일.
- **내용**:  
  - `frontend/src/api/conversations.ts` 의 `fetch('/api/conversations/...')` 를 `apiClient` 의 baseURL 을 쓰는 형태로 변경하거나, 공통 base URL 유틸을 두고 `fetch(baseUrl + '/api/conversations/...')` 로 통일.  
- **검증**: `VITE_API_URL=http://localhost:5000` 으로 두고 대화 메시지 전송/SSE 수신 정상 동작 확인.

---

### PR4: Docker Compose에 frontend 서비스 추가 (선택)

- **목표**: “한 번에 `docker compose up` 으로 프론트까지 띄우기” 가 필요할 때 대비.
- **내용**:  
  - frontend용 Dockerfile(또는 multi-stage build) 및 docker-compose 에 `frontend` 서비스 추가.  
  - frontend 컨테이너는 빌드된 정적 파일을 서빙하거나, dev 시에는 volume 으로 소스 마운트 + `npm run dev` 로 5173 노출.  
  - backend 의 `FRONTEND_URL` 을 `http://frontend:5173` 또는 노출 포트에 맞게 설정.  
- **검증**: `docker compose up` 만으로 브라우저에서 프론트 접속 후 API 연동 확인.

---

### PR5: 날짜/통계 등 기타 버그 (이슈 확인 후)

- **목표**: 연동과 별개로 알려진 날짜/통계 버그를 수정.
- **내용**:  
  - 팀/이슈 트래커에 정리된 “날짜/통계” 관련 버그를 PR 단위로 수정.  
  - 가능하면 백엔드 응답 스키마(날짜 포맷, 타임존)와 프론트 기대값을 docs/DEV_SETUP.md 또는 API 문서에 명시.  
- **검증**: 해당 기능의 단위/통합 테스트 및 수동 확인.

---

## 우선순위 요약

| 순서 | PR | 목적 |
|------|-----|------|
| 1 | PR1 | 즉시 연동 가능하게 (proxy 5000, 문서화) |
| 2 | PR3 | SSE/API base URL 일관성 (환경 유연성) |
| 3 | PR2 | 인증 안정성 (필요 시) |
| 4 | PR4 | “전부 Docker로” 실행 옵션 (필요 시) |
| 5 | PR5 | 날짜/통계 등 기능 버그 (별도 이슈 기준) |
