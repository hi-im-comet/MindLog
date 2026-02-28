# MINDLOG API

## 인증

### 회원가입 (Signup)

**POST** `/api/auth/register`

#### 요청 (Request)

- **Content-Type**: `application/json`
- **Body**:
  - `userNickname` (string, 필수): 사용자 닉네임. 1~100자.
  - `aiNickname` (string, 필수): AI 닉네임(사용자가 지정). 1~50자.
  - `email` (string, 필수): 이메일 주소.
  - `password` (string, 필수): 비밀번호. 8자 이상 128자 이하, 영문·숫자·특수문자 각 1개 이상 포함.

**예시**

```json
{
  "userNickname": "지수",
  "aiNickname": "마음친구",
  "email": "user@example.com",
  "password": "MyPass123!"
}
```

#### 응답 (Response)

**성공 (201 Created)**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "지수",
      "avatar_url": null,
      "timezone": "UTC",
      "onboarding_completed": false,
      "created_at": "2026-02-21T12:00:00.000Z",
      "profile": {
        "ai_name": "마음친구",
        "summary": null,
        "known_patterns": [],
        "known_triggers": [],
        "communication_style": null,
        "preferred_response_mode": "empathetic",
        "total_entries": 0,
        "consecutive_days": 0,
        "entry_lock_enabled": false,
        "last_analysis_at": null
      }
    },
    "access_token": "eyJ...",
    "refresh_token": "eyJ..."
  }
}
```

**실패**

- **400 Bad Request** — 본문 누락 또는 검증 실패(형식 오류, 비밀번호 정책 위반 등)

```json
{
  "success": false,
  "error": "비밀번호는 8자 이상이며, 영문·숫자·특수문자를 각각 1개 이상 포함해야 합니다.",
  "errors": {
    "password": ["비밀번호는 8자 이상이며, 영문·숫자·특수문자를 각각 1개 이상 포함해야 합니다."]
  }
}
```

- **409 Conflict** — 이메일 중복

```json
{
  "success": false,
  "error": "이미 사용 중인 이메일입니다."
}
```

- **500 Internal Server Error** — 서버 오류

```json
{
  "success": false,
  "error": "서버 오류가 발생했습니다."
}
```

프론트에서는 `response.data.error`를 그대로 사용자에게 노출하면 된다.
