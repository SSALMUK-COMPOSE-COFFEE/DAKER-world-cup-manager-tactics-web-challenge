// PLAN B 룰 엔진 v1.1 — docs/rule-engine.md 스펙 구현.
// 순수 함수: 동일 입력 = 동일 출력. 난수 없음.
import type {
  Difficulty,
  EngineOutput,
  EnginePlayer,
  Moment,
  Outcome,
  TacticProfile,
} from './types'

// §8 튜닝 노브 — 밸런싱 대상 계수는 전부 여기 모은다.
export const COEFFS = {
  attNorm: { lo: 20, hi: 70 },
  defNorm: { lo: 50, hi: 85 },
  xgBase: 2.2,
  xgaBase: 2.6,
  /** RISK→xGA 비선형 지수 — 1보다 크면 고위험 배치가 가속 페널티를 받는다 */
  riskExp: 1.4,
  pressToChanceQ: 0.25,
  defMitigation: 0.35,
  goalDeltaWeight: 32,
  balanceWeight: 0.25,
  diffOffset: { easy: 6, normal: 0, hard: -6 } as Record<Difficulty, number>,
  timeBaseMin: 15,
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const norm = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1) * 100
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)

// §2 선수 기여 점수
export const atkScore = (p: EnginePlayer) =>
  0.35 * p.attrs.shooting + 0.25 * p.attrs.dribbling + 0.25 * p.attrs.passing + 0.15 * p.attrs.pace
export const defScore = (p: EnginePlayer) =>
  0.55 * p.attrs.defending + 0.3 * p.attrs.physical + 0.15 * p.attrs.pace
export const prsScore = (p: EnginePlayer) =>
  0.5 * p.attrs.physical + 0.35 * p.attrs.pace + 0.15 * p.attrs.defending

export function evaluate(
  lineup: EnginePlayer[],
  them: TacticProfile,
  moment: Moment,
  difficulty: Difficulty,
): EngineOutput {
  const gk = lineup.find((p) => p.role === 'GK')
  const outfield = lineup.filter((p) => p.role !== 'GK')

  // §4 팀 기하 파생값
  const lineHeight = mean(outfield.map((p) => p.x))
  const backCount = outfield.filter((p) => p.x < 40).length
  const fwdCount = outfield.filter((p) => p.x >= 66).length
  const ys = outfield.map((p) => p.y)
  const widthUse = Math.max(...ys) - Math.min(...ys)
  const frontPrs = outfield.filter((p) => p.x >= 50).map(prsScore)
  const prsAdv = frontPrs.length > 0 ? mean(frontPrs) : 0

  // §3 위치 가중 + §5 팀 지표
  const ATT = norm(
    mean(outfield.map((p) => atkScore(p) * (0.2 + 0.8 * (p.x / 100)))),
    COEFFS.attNorm.lo,
    COEFFS.attNorm.hi,
  )

  const wDefs = outfield.map((p) => 0.2 + 0.8 * (1 - p.x / 100))
  const defWeightedSum = outfield.reduce((acc, p, i) => acc + defScore(p) * wDefs[i], 0)
  const gkDef = gk ? defScore(gk) : 0
  const DEF = norm(
    (defWeightedSum + gkDef) / (wDefs.reduce((a, b) => a + b, 0) + 1),
    COEFFS.defNorm.lo,
    COEFFS.defNorm.hi,
  )

  const PRESS = 100 * (0.6 * (lineHeight / 100) + 0.4 * (prsAdv / 99))

  const BALANCE = clamp(100 - 12 * Math.max(0, 3 - backCount) - 8 * Math.max(0, fwdCount - 4), 0, 100)

  const RISK =
    100 *
    clamp(
      0.5 * (lineHeight / 100) + 0.3 * (Math.max(0, 3 - backCount) / 3) + 0.2 * (them.directness / 100),
      0,
      1,
    )

  // §6 상대 상성 → xG / xGA
  const timeFactor = moment.timeLeftMin / COEFFS.timeBaseMin

  const blockPenalty = clamp((50 - them.defLine) / 100, 0, 0.5)
  const widthBreak = clamp((widthUse - 40) / 60, 0, 1)
  const chanceQ = clamp(
    0.6 + 0.4 * widthBreak + COEFFS.pressToChanceQ * (PRESS / 100) - 0.6 * blockPenalty,
    0.2,
    1.25,
  )
  const xG = COEFFS.xgBase * (ATT / 100) * chanceQ * timeFactor

  const oppThreat = clamp(0.4 + 0.5 * (them.directness / 100) + 0.2 * (them.tempo / 100), 0.4, 1.2)
  const defMitigate = 1 - COEFFS.defMitigation * (DEF / 100)
  const xGA = COEFFS.xgaBase * Math.pow(RISK / 100, COEFFS.riskExp) * defMitigate * oppThreat * timeFactor

  // §7 종합점수
  const goalDelta = xG - xGA
  const composite = clamp(
    50 + COEFFS.goalDeltaWeight * goalDelta + COEFFS.balanceWeight * (BALANCE - 60),
    0,
    100,
  )
  const compositeFinal = clamp(composite + COEFFS.diffOffset[difficulty], 0, 100)

  // §8 압박 라인: 가장 깊은(x가 작은) 4명의 평균 x
  const deepest = [...outfield].sort((a, b) => a.x - b.x).slice(0, 4)
  const pressLineX = mean(deepest.map((p) => p.x))

  return { ATT, DEF, PRESS, BALANCE, RISK, xG, xGA, composite, compositeFinal, pressLineX, lineHeight, backCount, fwdCount, widthUse }
}

/** §7 매핑: minScore 내림차순 outcomes에서 첫 매칭 항목 */
export function pickOutcome(outcomes: Outcome[], compositeFinal: number): Outcome {
  return outcomes.find((o) => compositeFinal >= o.minScore) ?? outcomes[outcomes.length - 1]
}
