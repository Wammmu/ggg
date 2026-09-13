# Wammmu/ggg GitHub-only 자동 상태창

## 추가할 파일
저장소 루트:
- `update-state.js`

워크플로:
- `.github/workflows/update-status.yml`

기존 파일:
- `state.json`
- `generate.js`
- `status.svg`
- `assets/sd/*`

## 1. GitHub 설정
Settings → Actions → General → Workflow permissions에서
**Read and write permissions**를 허용하세요.

## 2. 외부 호출용 Fine-grained PAT
캐릭터 채팅 서비스가 HTTP 요청/Action/Webhook을 지원해야 합니다.

토큰은 공개 프롬프트나 저장소에 절대 넣지 마세요.
캐릭터 채팅 플랫폼의 Secret/Authorization Header 기능에 저장하세요.

`repository_dispatch` 호출에는 해당 `ggg` 저장소에 대한
**Contents: Read and write** 권한이 있는 fine-grained token을 사용합니다.

## 3. 호출 주소

POST
`https://api.github.com/repos/Wammmu/ggg/dispatches`

Headers:
- `Accept: application/vnd.github+json`
- `Authorization: Bearer YOUR_SECRET_TOKEN`
- `X-GitHub-Api-Version: 2026-03-10`
- `Content-Type: application/json`

Body 예시는 `api-request-example.json` 참고.

## 4. payload 규칙

### 신체/피로/반동 변화
```json
{
  "userStatusDelta": {
    "body": -4,
    "fatigue": 8,
    "recoil": 5
  }
}
```

### 동료 상태 변경
```json
{
  "companionUpdates": [
    {
      "name": "라마니",
      "status": "경상 · 전의 유지"
    }
  ]
}
```

### 동료 합류
```json
{
  "companionsAdd": [
    {
      "name": "새 동료",
      "realm": "중급",
      "status": "정상",
      "image": "assets/sd/new.webp"
    }
  ]
}
```

### 동료 이탈
```json
{
  "companionsRemove": ["현리"]
}
```

### 경지 변경
```json
{
  "protagonist": {
    "realm": "특급"
  }
}
```

허용 경지:
`초월 > 신위 > 극위 > 특급 > 상급 > 중급 > 하급`

### 평판
```json
{
  "reputationAdd": ["사무드리아: 신뢰받는 협력자"],
  "reputationRemove": ["사무드리아: 낯선 여행자"]
}
```

### 수행
```json
{
  "cultivation": {
    "task": "특급 승급 검증",
    "progressDelta": 5
  }
}
```

### 돈/아이템
```json
{
  "inventory": {
    "moneyDelta": -12,
    "addItems": [
      { "name": "약초", "qty": 1 }
    ],
    "removeItems": [
      { "name": "부적", "qty": 2 }
    ]
  }
}
```

## 5. 실제 API 요청 예시

```bash
curl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/Wammmu/ggg/dispatches \
  -d @api-request-example.json
```

성공 시 HTTP `204 No Content`.

## 6. 작동 순서

캐릭터 채팅
→ GitHub REST API `repository_dispatch`
→ `.github/workflows/update-status.yml`
→ `update-state.js`
→ `state.json`
→ 기존 `generate.js`
→ `status.svg`
→ GitHub Pages

최종 이미지:
`https://wammmu.github.io/ggg/status.svg`

## 주의
GitHub Actions + Pages 방식은 즉시 렌더링이 아닙니다.
대화 직후 수 초~수십 초 동안 직전 상태창이 보일 수 있습니다.
`?v=턴번호`는 캐시 회피에는 도움이 되지만 GitHub Actions 실행을 기다려주지는 않습니다.
