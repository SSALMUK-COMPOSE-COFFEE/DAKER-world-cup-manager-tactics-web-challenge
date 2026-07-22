# PLAN B — 데이터 스키마

명경기 시나리오는 **데이터로만 추가**된다(엔진은 하나). **한 폴더 = 한 경기**로 자기완결되며, 새 경기를 넣으려면 폴더 하나를 복사해 두 파일을 채우면 된다.

```
data/matches/
  index.json                  # 시나리오 목록(카드용 메타)
  kor-por-2022/               # 시나리오 폴더 = 경기 id
    match.json                # 경기 설정·라인업 좌표·outcomes
    players.json              # 이 경기의 양 팀 선수 (us + them)
```

- `data/matches/{id}/players.json` — 이 경기 양 팀 선수풀(능력치 포함).
- `data/matches/{id}/match.json` — 명경기 시나리오. 선수는 `playerId`로 참조.

> 폴더가 자기완결이라 스쿼드가 경기마다 일부 중복될 수 있지만(같은 해 같은 팀), 시나리오 추가·수정·삭제가 폴더 단위로 끝나는 편의가 더 크다. `playerId`는 팀 프리픽스(`kor-`, `por-`)로 전역 유니크하게 둔다.

> **주의**: 모든 데이터는 대회 규정에 따라 **직접 구성한 더미 데이터**다. 실제 선수 이름·포지션·국가를 *참고*하되 능력치·전술 수치는 자체 설정값이다.

---

## index.json

시나리오 카드 목록(인트로 화면용 메타). 각 항목: `{ id, dir, title, subtitle, tag, status }`.

- `status`: `ready`(플레이 가능) | `planned`(카드만 표시, "준비 중" 배지)
- `tag`: 카드 훅 문구. 두 갈래 — **"기적을 재현하라"**(실제가 극적 승리인 경기), **"역사를 바꿔라"**(실제로 졌거나 비긴 경기)

---

## 좌표계 (pitch coordinate)

- 필드는 **0~100 정규화 좌표**. 화면 크기와 무관하게 렌더러가 스케일링한다.
- **x축**: 0 = 우리 골문, 100 = 상대 골문. 즉 **우리 팀 공격 방향 = x 증가**.
- **y축**: 0 = 왼쪽 터치라인, 100 = 오른쪽 터치라인.
- 예) `{"x":78,"y":30}` = 상대 진영 깊숙한 왼쪽(왼쪽 윙 위치).

---

## players.json

`us`(내가 감독하는 팀)와 `them`(상대) 두 스쿼드를 담는다.

```jsonc
{
  "us": {                        // 내가 감독하는 팀
    "teamCode": "KOR",
    "teamName": "대한민국",
    "year": 2022,
    "players": [
      {
        "id": "kor-son",         // 전역 유니크. match.json의 playerId가 이걸 참조
        "name": "손흥민",
        "pos": "FW",             // GK | DF | MF | FW (대분류)
        "overall": 89,           // 종합(표시용). 엔진은 attrs를 씀
        "attrs": {               // 0~99. 룰 엔진 계산의 원천
          "pace": 88,            // 속도 (역습/전진압박 기여)
          "shooting": 87,        // 슈팅 (xG 기여)
          "passing": 82,         // 패스 (빌드업/찬스메이킹)
          "dribbling": 86,       // 드리블 (돌파/침투)
          "defending": 43,       // 수비 (실점 억제)
          "physical": 69         // 피지컬 (경합/압박 지속력)
        }
      }
    ]
  },
  "them": {                      // 상대 팀 (구조 동일)
    "teamCode": "POR",
    "teamName": "포르투갈",
    "year": 2022,
    "players": [ /* ... */ ]
  }
}
```

### attrs → 엔진 매핑 요약
| 스탯 | 팀 지표 기여 |
|---|---|
| shooting, dribbling | 공격력 ↑, xG ↑ |
| passing | 빌드업/찬스 질 ↑ |
| pace | 역습·전진압박 효율 ↑ |
| defending | 실점확률 ↓ |
| physical | 압박 지속·경합 ↑ |

---

## match.json

선수는 같은 폴더 `players.json`의 `playerId`를 참조한다(별도 teamRef 불필요).

```jsonc
{
  "id": "kor-por-2022",
  "title": "대한민국 vs 포르투갈",
  "tournament": "2022 FIFA 월드컵 카타르 · 조별리그 H조 3차전",
  "difficulty": "normal",        // easy | normal | hard (분기 임계값 보정)
  "themeColor": "#c60c30",       // 시나리오 카드 강조색

  "moment": {                    // 개입하는 "그 순간"
    "period": "2H",              // 1H | 2H | ET(연장)
    "minute": 78,
    "scoreUs": 0,
    "scoreThem": 1,
    "timeLeftMin": 15            // 남은 시간(분). 리스크/보상 계산에 사용
  },

  "us": {                        // 내가 감독하는 팀 (players.json의 us 참조)
    "formation": "4-2-3-1",      // 초기 프리셋(변경 가능)
    "subsLeft": 3,               // 남은 교체 카드
    "lineup": [                  // 초기 선발 배치 (11명)
      { "playerId": "kor-son", "x": 72, "y": 22, "role": "LW" }
    ],
    "bench": [ "kor-hwang-hc", "kor-hwang-ib" ]   // 교체 투입 가능(playerId)
  },

  "them": {                      // 상대(감독 조작 불가). 전술 프로필로 표현
    "formation": "4-4-2",
    "displayLineup": [           // 화면 표시용(간단). 엔진은 tacticProfile을 씀
      { "playerId": "por-costa", "x": 94, "y": 50, "role": "GK" }   // 좌표계는 우리 기준 하나 — 상대 GK는 상대 골문 앞(x≈100)
    ],
    "tacticProfile": {           // 0~100. 우리 전술과 상성 계산
      "defLine": 32,             // 수비 라인 높이(낮을수록 내려앉음)
      "press": 38,               // 압박 강도
      "width": 48,               // 폭 활용
      "tempo": 44,               // 템포
      "directness": 58           // 직선성(역습 위협)
    }
  },

  "briefing": "리드를 지키려 상대가 내려앉았습니다. 15분 안에 한 골이 필요합니다.",

  "actualHistory": {             // "실제 역사" 비교 오버레이
    "finalScoreUs": 2,
    "finalScoreThem": 1,
    "summary": "후반 추가시간 손흥민의 폭발적 질주에 이은 황희찬의 결승골로 2-1 극장 역전승."
  },

  "outcomes": [                  // 엔진 종합점수(0~100)를 결과로 매핑. 내림차순
    {
      "minScore": 78,
      "resultScoreUs": 2, "resultScoreThem": 1,
      "label": "극장 역전승",
      "narrative": "추가시간, 당신의 승부수가 그물을 흔들었다. 2-1.",
      "goals": [ { "minute": 90, "scorer": "kor-hwang-hc", "type": "counter" } ]
    },
    {
      "minScore": 55,
      "resultScoreUs": 1, "resultScoreThem": 1,
      "label": "극적인 동점",
      "narrative": "끈질긴 압박이 만든 동점골. 1-1.",
      "goals": [ { "minute": 88, "scorer": "kor-cho-gs", "type": "set" } ]
    },
    {
      "minScore": 0,
      "resultScoreUs": 0, "resultScoreThem": 1,
      "label": "그대로 패배",
      "narrative": "문은 끝내 열리지 않았다. 0-1.",
      "goals": []                // 실점 연출은 { "minute", "scorer": "por-...", "type", "against": true }로 표기
    }
  ]
}
```

### 엔진 흐름
1. 유저가 선수 좌표/교체를 바꾼다.
2. 엔진이 `us` 배치 + `attrs`로 팀 지표(공격/수비/압박/밸런스/리스크)를 계산.
3. `them.tacticProfile`과 상성 가중 → **종합점수(0~100)** + xG/실점확률.
4. 휘슬 시 종합점수를 `outcomes`(내림차순)에서 매칭 → 결과 연출.
5. 같은 배치 = 같은 점수 = 같은 결과(결정론적, 시드 고정).

## 코멘트 뱅크 (comments)

미연시식 사전 작성 코멘트. `data/comments/common.json`(공통) + `data/matches/{id}/comments.json`(시나리오 전용, 선택). 엔진 지표 조건으로 선택하며 LLM은 쓰지 않는다.

```jsonc
[
  {
    "id": "gap-left",
    "slot": "tactic",              // tactic(배치 중 브리핑) | result(휘슬 후 총평)
    "when": [                      // AND 조건 배열. metric은 엔진 출력 키
      { "metric": "PRESS", "op": ">=", "value": 65 },
      { "metric": "coverageGapLeft", "op": ">=", "value": 0.5 }
    ],
    "priority": 80,                // 매칭된 것 중 최상위 하나 선택
    "lines": [                     // 문장 변주. 라인업 해시 시드로 결정론 선택
      "왼쪽 측면이 비었습니다. 상대 윙어가 그 공간을 노릴 겁니다.",
      "왼쪽이 허전합니다. 풀백의 커버 범위를 확인하세요."
    ]
  }
]
```

- `when`이 빈 배열이면 항상 매칭(기본 코멘트) — 각 slot에 priority 최하위 기본 코멘트를 하나씩 둬서 무코멘트 상태를 방지한다.
- 시나리오 전용 뱅크는 공통 뱅크와 합쳐서 평가하되, 동점이면 전용이 우선.

---

### 새 시나리오 추가 체크리스트
- [ ] `data/matches/{id}/` 폴더 생성 (기존 폴더 복사가 편함)
- [ ] `players.json` 작성 — `us`/`them` 두 스쿼드, `id`는 팀 프리픽스로 유니크
- [ ] `match.json` 작성 — `lineup` 11명 좌표 지정, `bench`는 `players.json`의 `id` 참조
- [ ] `outcomes` 최소 3구간(승/무/패) 임계값 튜닝
- [ ] `actualHistory` 실제 결과 채우기
- [ ] `data/matches/index.json`에 `{id, dir, ...}` 등록
