# PLAN B — 리더보드 서버 API

여유 기능. 코어 앱은 서버 없이 완결되며, 서버가 죽어도 `/api/*`만 502가 날 뿐 게임은 동작한다.

**스택**: Node 26 단일 파일(`server/server.ts`), 의존성 0 — `node:http` + `node:sqlite`. FastAPI 대신 Node를 쓰는 이유: **점수를 클라가 보내지 않고 서버가 웹과 동일한 룰 엔진(`web/src/engine`)을 import해 재계산**하기 때문(치팅 방지 + 엔진 이중 구현 제거).

**식별**: 익명 세션 쿠키 `planb_sid`(uuid, HttpOnly, SameSite=Lax, 1년). 로그인 없음.

**실행**: 로컬 `node server/server.ts`(기본 포트 8000, DB는 `server-data/planb.db`). 배포는 `docker compose --profile leaderboard up -d` — Caddy가 `/api/*`를 `server:8000`으로 프록시. dev에선 Vite가 `/api`를 localhost:8000으로 프록시.

## POST /api/scores

전술 제출. 서버가 라인업을 검증(11명·유니크·스쿼드 소속·GK 1명·좌표 0~100·교체 한도)하고 엔진으로 판정한 뒤, **세션×시나리오당 최고 기록만** 유지(upsert).

```jsonc
// 요청
{ "scenarioId": "kor-por-2022", "nickname": "감독A", "lineup": [ { "playerId": "kor-son", "x": 72, "y": 22, "role": "LW" } /* ×11 */ ] }
// 응답
{ "score": 79.1, "outcomeLabel": "기적의 재현", "best": 79.1, "rank": 1, "total": 42 }
```

- `score`는 이번 제출의 판정값, `best`는 저장된 내 최고점, `rank`는 best 기준 시나리오 내 순위.
- 클라가 보낸 score 필드는 무시된다. 검증 실패 시 400 `{ "error": "…" }`.

## GET /api/leaderboard?scenario={id}&limit={1~100, 기본 50}

시나리오(스테이지)별 랭킹. `me`는 쿠키 세션의 기록(없으면 null).

```jsonc
{ "entries": [ { "rank": 1, "nickname": "감독B", "score": 79.1, "outcomeLabel": "기적의 재현", "at": "2026-07-22 06:28:42" } ], "me": { "score": 72.3, "rank": 2 } }
```

## GET /api/leaderboard/overall?limit={1~100, 기본 50}

세션별 **스테이지 최고점 합산** 종합 랭킹(스테이지 형식과 연동). `stages`는 플레이한 스테이지 수, `me`는 내 행 여부.

```jsonc
{ "entries": [ { "rank": 1, "nickname": "감독B", "total": 231.4, "stages": 3, "me": false } ] }
```

## GET /api/health

`{ "ok": true, "scenarios": 3 }` — 심사 기간(8/18까지) 외부 업타임 모니터링용.

## DB 스키마

```sql
CREATE TABLE scores (
  session_id TEXT NOT NULL,      -- 익명 세션 uuid
  scenario_id TEXT NOT NULL,
  nickname TEXT NOT NULL,        -- 최근 제출 닉네임(16자 제한)
  score REAL NOT NULL,           -- 서버 판정 compositeFinal (최고 기록)
  outcome_label TEXT NOT NULL,
  lineup_json TEXT NOT NULL,     -- 최고 기록 당시 라인업(감사용)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, scenario_id)
)
```
