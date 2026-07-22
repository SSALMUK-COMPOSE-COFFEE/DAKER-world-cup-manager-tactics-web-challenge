# PLAN B — 룰 엔진 v1 스펙

전술 배치를 **결정론적 함수**로 평가해 종합점수(0~100)와 실시간 지표를 산출한다. LLM 없이 항상 동작하며, 같은 배치 = 같은 결과다.

## 0. 원칙

- **순수 함수**: 입력(내 라인업 + 상대 tacticProfile + moment)만으로 출력이 결정된다. 난수 없음.
- **저비용**: 선수 수(11) 선형 연산. 선수 이동/교체 시마다 재계산(디바운스).
- **튜닝 가능**: 모든 계수는 §8에 모아 두고, 시나리오별 `difficulty`로 보정한다.
- **정직한 게이지**: UI에 보이는 다섯 지표(ATT/DEF/PRESS/BALANCE/RISK)는 **모두 composite 경로에 기여**한다(ATT→xG, DEF·RISK→xGA, PRESS→chanceQ, BALANCE→composite 직접). 전시용 지표는 두지 않는다.

---

## 1. 입력 / 출력

**입력**
- `us.lineup[11]`: `{ x, y, attrs{pace,shooting,passing,dribbling,defending,physical} }`
- `them.tacticProfile`: `{ defLine, press, width, tempo, directness }` (0~100)
- `moment`: `{ scoreUs, scoreThem, timeLeftMin }`
- `difficulty`: `easy | normal | hard`

**출력**
- 팀 지표: `ATT, DEF, PRESS, BALANCE, RISK` (0~100) — UI 게이지
- `xG`, `xGA` — 예상 득점/실점
- `composite` (0~100) — 종합점수, outcome 매핑에 사용
- 히트맵/압박라인 등 실시간 시각화 데이터(§7)

**표기**: GK 판별은 lineup의 `role === "GK"`(UI에서 드래그 잠금으로 보장). 필드 외 선수(outfield) = GK 제외 10명. `xn = x/100`, `yn = y/100`.

---

## 2. 선수 기여 점수 (attrs → 0~99)

각 선수 `p`에 대해 역할 무관 기여 점수 3종:

```
atk(p) = 0.35·shooting + 0.25·dribbling + 0.25·passing + 0.15·pace
def(p) = 0.55·defending + 0.30·physical  + 0.15·pace
prs(p) = 0.50·physical  + 0.35·pace      + 0.15·defending
```

## 3. 위치 가중치

전진 배치일수록 공격 기여, 후퇴 배치일수록 수비 기여가 커진다.

```
wAtk(p) = 0.2 + 0.8·xn          // x가 클수록(전진) ↑
wDef(p) = 0.2 + 0.8·(1 − xn)    // x가 작을수록(후퇴) ↑
```

## 4. 팀 기하 파생값

```
lineHeight = mean(x_i)                     over outfield        // 라인 높이(0~100)
backCount  = count( x_i < 40 )             over outfield        // 뒤에 남은 인원
fwdCount   = count( x_i ≥ 66 )             over outfield        // 전진 인원
widthUse   = max(y_i) − min(y_i)           over outfield        // 폭 활용(0~100)
prsAdv     = mean( prs_i )  where x_i ≥ 50 (없으면 0)            // 전방 압박 자원
```

---

## 5. 팀 지표 (0~100)

정규화 헬퍼: `norm(v, lo, hi) = clamp((v − lo)/(hi − lo), 0, 1) · 100`

```
ATT_raw = mean_i( atk_i · wAtk_i )                 over outfield
ATT     = norm(ATT_raw, 20, 70)

DEF_raw = ( Σ_i(def_i · wDef_i) + def_GK ) / ( Σ_i wDef_i + 1 )   // GK 포함 가중평균
DEF     = norm(DEF_raw, 50, 85)

PRESS   = 100 · ( 0.6·(lineHeight/100) + 0.4·(prsAdv/99) )

BALANCE = clamp( 100 − 12·max(0, 3 − backCount) − 8·max(0, fwdCount − 4), 0, 100 )
          // 최소 3명 뒤 + 최대 4명 전진 = 100. 수비 빼내거나 공격 과밀이면 감점

RISK    = 100 · clamp( 0.5·(lineHeight/100)
                     + 0.3·(max(0, 3 − backCount)/3)
                     + 0.2·(them.directness/100), 0, 1 )
```

---

## 6. 상대 상성 → xG / xGA

```
timeFactor   = timeLeftMin / 15                                  // 기준 15분

// 우리 득점 기대 (xG)
blockPenalty = clamp( (50 − them.defLine)/100, 0, 0.5 )          // 상대가 내려앉을수록 찬스 어려움
widthBreak   = clamp( (widthUse − 40)/60, 0, 1 )                 // 넓게 벌리면 밀집수비 공략
chanceQ      = clamp( 0.6 + 0.4·widthBreak + 0.25·(PRESS/100)    // 압박이 높으면 찬스 창출 ↑
                     − 0.6·blockPenalty, 0.2, 1.25 )
xG           = 2.2 · (ATT/100) · chanceQ · timeFactor

// 우리 실점 기대 (xGA) — 상대 역습 위협을 수비 자원이 상쇄
oppThreat    = clamp( 0.4 + 0.5·(them.directness/100) + 0.2·(them.tempo/100), 0.4, 1.2 )
defMitigate  = 1 − 0.35·(DEF/100)                                // 수비 능력치가 실점 기대를 감쇄
xGA          = 2.6 · (RISK/100)^1.4 · defMitigate · oppThreat · timeFactor
               // RISK 지수 1.4: 고위험 배치일수록 실점 기대가 가속 — "무모함"이 실제로 벌 받게
```

> **v1.3 변경(7/22 분기 확장)**: 유저 플레이 범위 스윕(108개 전술 변주, scripts/engine-sweep.ts) 결과 composite가 59~82에 압축돼 실플레이에서 동점·패배만 나오는 문제 확인. xGA를 `2.6·(RISK/100)^1.4`로(무모한 전진 가속 페널티), BALANCE 가중 0.25로 조정 → 도달 범위 48~83. 포르투갈전 outcome을 5분기로 확장(82+ 완벽한 플랜 B 3-1 / 75+ 기적의 재현 2-1 / 66+ 동점 / 50+ 패배 / <50 역습 붕괴 0-2), 스윕 분포 기준 약 6% / 14% / 60% / 17% / 3%. 코멘트 뱅크 임계값 78→75 동기화.
>
> **v1.2 변경(7/22 구현 후 1차 밸런싱)**: 실데이터(kor-por-2022) 스모크 결과 DEF가 밴드(30,75)에서 상시 포화(93~95)라 `DEF(50,85)`로 상향, outcome 스프레드가 좁아(전 전술 62~76 동점) `goalDelta` 계수 26→32. 포르투갈전 동점 임계값 58→66(수비 웅크리기가 0-1 열세에서 동점이 되는 모순 제거). 결과: 기본=동점 70, 균형 승부수=역전 78, 무모 올인/웅크리기=패배 62~63.
>
> **v1.1 변경**: PRESS와 DEF를 결과 경로에 연결했다(§0 "정직한 게이지" 원칙 — 김민재를 빼면 xGA가 실제로 오르고, 압박 라인을 올리면 찬스가 실제로 는다). 베이스 보정(chanceQ 0.7→0.6, xGA 1.4→1.7)은 평균적 배치(PRESS≈50, DEF≈55)에서 v1과 동일한 값이 나오도록 맞춘 것으로, 기존 outcome 임계값을 그대로 쓸 수 있다.

---

## 7. 종합점수 → outcome 매핑

```
goalDelta       = xG − xGA
composite       = clamp( 50 + 32·goalDelta + 0.25·(BALANCE − 60), 0, 100 )

diffOffset      = { easy: +6, normal: 0, hard: −6 }[difficulty]
composite_final = clamp( composite + diffOffset, 0, 100 )
```

**매핑**: `match.json`의 `outcomes`(minScore 내림차순)에서 `composite_final ≥ minScore`인 **첫 항목**을 선택한다.

```
outcome = outcomes.find( o => composite_final ≥ o.minScore )
```

---

## 8. 실시간 UI 지표 계산 (§5~6 부산물)

- **게이지**: `ATT / DEF / PRESS / BALANCE / RISK` 막대 + `xG / xGA` 수치. 선수 이동 시 부드럽게 보간.
- **커버리지 히트맵**: 격자(예 32×20)에서 각 셀 값
  ```
  cell = Σ_i A_i · exp( −d_i² / (2·σ_i²) )        // d_i = 셀-선수 거리(정규화)
  σ_i  = 0.10 · (0.8 + 0.4·pace_i/99)             // 빠른 선수일수록 영향권 ↑
  A_i  = 우리팀 +1 / 상대팀 −1 (지배력 대비 표시 시)
  ```
  canvas로 렌더, `O(격자·선수)`.
- **압박 라인**: `x = mean(가장 깊은 4명의 x)` 위치에 수평선. 라인을 끌어올리면 `lineHeight↑ → PRESS↑, RISK↑`가 즉시 반영.
- **커버리지 갭**: 우리팀 영향값이 임계 이하인 셀을 빈 공간으로 강조.

---

## 9. 결정론 & 계수 튜닝

- 엔진은 순수 함수 → 동일 배치 = 동일 `composite` = 동일 outcome.
- 결과 연출의 골 타이밍, **코멘트 뱅크의 문장 변주 선택**(data-schema.md 참조) 등 변주가 필요하면, 라인업을 해시한 **시드**로 결정론적으로 뽑는다(난수 금지).
- **튜닝 노브**(구현 후 밸런싱 대상):
  - 정규화 밴드: `ATT(20,70)`, `DEF(50,85)`
  - 기대값 베이스: `xG 2.2`, `xGA 2.6·RISK^1.4`
  - 게이지→결과 연결 계수: chanceQ의 `0.25·PRESS`, xGA의 `0.35·DEF` 감쇄
  - 종합점수 계수: `32·goalDelta`, `0.25·(BALANCE−60)`
  - 난이도 오프셋: `easy +6 / hard −6`
  - 시나리오별로 위 값을 `match.json`에서 오버라이드할 수 있게 열어둘지는 v2에서 결정.
- **밸런싱 목표**: 각 시나리오의 기본 라인업이 중간 outcome(예: 동점) 근처에 오도록 밴드를 맞추고, "수비 빼서 전진 → xG↑지만 RISK↑" 트레이드오프가 체감되게 조정한다.
