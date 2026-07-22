// 감독 리포트 — "왜 이 결과인가"를 엔진 지표로 정직하게 설명한다.
import { COEFFS } from './engine'
import type { Difficulty, EngineOutput } from './types'

export interface BreakdownRow {
  label: string
  delta: number
}

/** composite 산식을 사람이 읽을 수 있는 기여도 행으로 분해 */
export function compositeBreakdown(engine: EngineOutput, difficulty: Difficulty): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    { label: '기본', delta: 50 },
    { label: `득실 마진 (xG ${engine.xG.toFixed(2)} − xGA ${engine.xGA.toFixed(2)})`, delta: COEFFS.goalDeltaWeight * (engine.xG - engine.xGA) },
    { label: `진형 균형 (${Math.round(engine.BALANCE)})`, delta: COEFFS.balanceWeight * (engine.BALANCE - 60) },
  ]
  const diff = COEFFS.diffOffset[difficulty]
  if (diff !== 0) rows.push({ label: `난이도 보정`, delta: diff })
  return rows
}

export interface Reason {
  positive: boolean
  text: string
}

/** 지표 기반 원인 설명 — 관련도 높은 순으로 최대 4개 */
export function explainResult(engine: EngineOutput): Reason[] {
  const reasons: { weight: number; r: Reason }[] = []

  if (engine.xG >= 1.1)
    reasons.push({ weight: engine.xG, r: { positive: true, text: `공격 전환이 유효했습니다 — 기대득점 ${engine.xG.toFixed(2)}` } })
  else if (engine.xG < 0.8)
    reasons.push({ weight: 1.5 - engine.xG, r: { positive: false, text: `슈팅 기회 창출이 부족했습니다 — 기대득점 ${engine.xG.toFixed(2)}` } })

  if (engine.xGA >= 0.7)
    reasons.push({ weight: engine.xGA + 0.3, r: { positive: false, text: `뒷공간이 역습에 노출됐습니다 — 실점 위험 ${engine.xGA.toFixed(2)}` } })
  else if (engine.xGA < 0.45 && engine.xG >= 0.9)
    reasons.push({ weight: 0.8, r: { positive: true, text: '공격을 올리면서도 역습 위험을 통제했습니다' } })

  if (engine.BALANCE < 70)
    reasons.push({ weight: 1.2, r: { positive: false, text: `진형 균형이 무너졌습니다 — 밸런스 ${Math.round(engine.BALANCE)} (뒷선 최소 3명, 최전방 4명 이하가 이상적)` } })

  if (engine.widthUse < 45)
    reasons.push({ weight: 0.9, r: { positive: false, text: `폭이 좁아 밀집수비 공략에 실패했습니다 — 폭 활용 ${Math.round(engine.widthUse)}` } })
  else if (engine.widthUse >= 65)
    reasons.push({ weight: 0.6, r: { positive: true, text: '넓은 폭으로 밀집수비를 흔들었습니다' } })

  if (engine.PRESS >= 62 && engine.xG >= 0.9)
    reasons.push({ weight: 0.7, r: { positive: true, text: '전방 압박이 찬스 창출로 연결됐습니다' } })

  if (engine.RISK >= 70)
    reasons.push({ weight: 1.0, r: { positive: false, text: `지나치게 공격적인 배치가 역습을 허용했습니다 — 리스크 ${Math.round(engine.RISK)}` } })
  else if (engine.RISK < 40 && engine.xG < 0.8)
    reasons.push({ weight: 0.8, r: { positive: false, text: '너무 소극적인 운영이었습니다 — 골이 필요한 순간엔 리스크도 전술입니다' } })

  return reasons.sort((a, b) => b.weight - a.weight).slice(0, 4).map((x) => x.r)
}
