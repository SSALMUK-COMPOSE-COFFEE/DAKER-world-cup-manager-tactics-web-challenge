// 휘슬 후 "경기가 흘러가는" 타임라인 연출 — 결과(outcome)와 엔진 지표에서
// 결정론적으로 이벤트를 생성한다(시드 기반, 난수 금지).
import type { EngineOutput, MatchData, Outcome, SimEventKind } from './types'

export interface SimEvent {
  minute: number
  kind: SimEventKind
  text: string
  scoreUs: number
  scoreThem: number
  /** 이 장면의 볼 위치(0~100 피치 좌표) — 리플레이 애니메이션용 */
  ball: { x: number; y: number }
  /** 장면의 주인공(득점자 등). 필드에 있으면 토큰 하이라이트 */
  actorId?: string
}

const GOAL_TEXT: Record<string, string> = {
  counter: '역습 상황에서 침착한 마무리!',
  cross: '측면 크로스를 밀어 넣습니다!',
  fk: '프리킥이 그대로 골문 구석에 꽂힙니다!',
  set: '세트피스 혼전 속에서 밀어 넣습니다!',
}

/** LCG — 시드에서 결정론적 의사난수 시퀀스 */
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function simulateTimeline(
  match: MatchData,
  outcome: Outcome,
  engine: EngineOutput,
  seed: number,
  nameOf: (id: string) => string,
): SimEvent[] {
  const rand = lcg(seed)
  const start = match.moment.minute
  const end = match.moment.period === 'ET' ? 120 : 90

  // 장면 종류별 볼 위치(0~100) — 시드로 변주
  const ballFor = (kind: SimEventKind): { x: number; y: number } => {
    switch (kind) {
      case 'press': return { x: 56 + rand() * 14, y: 20 + rand() * 60 }
      case 'chance': return { x: 80 + rand() * 10, y: 28 + rand() * 44 }
      case 'block': return { x: 70 + rand() * 10, y: 30 + rand() * 40 }
      case 'counter': return { x: 14 + rand() * 14, y: 25 + rand() * 50 }
      case 'goal': return { x: 96, y: 44 + rand() * 12 }
      case 'goal-against': return { x: 4, y: 44 + rand() * 12 }
      default: return { x: 42 + rand() * 16, y: 35 + rand() * 30 }
    }
  }

  // 지표 조건에 맞는 필러 이벤트 풀(우선순위 순)
  const fillers: { kind: SimEventKind; text: string }[] = []
  if (engine.PRESS >= 60)
    fillers.push({ kind: 'press', text: '전방 압박이 상대 빌드업을 끊었습니다. 높은 위치에서 볼 탈취!' })
  if (engine.xG >= 1.0)
    fillers.push({ kind: 'chance', text: '날카로운 침투! 슈팅이 골키퍼 정면으로 향합니다.' })
  if (engine.widthUse >= 60)
    fillers.push({ kind: 'chance', text: '넓게 벌린 측면에서 크로스가 위험지역으로 올라갑니다.' })
  if (engine.RISK >= 60)
    fillers.push({ kind: 'counter', text: '상대의 역습! 뒷공간이 순간 열렸지만 가까스로 차단합니다.' })
  if (engine.xG < 0.7)
    fillers.push({ kind: 'block', text: '내려앉은 수비벽에 공격이 번번이 막힙니다.' })
  if (engine.PRESS < 50)
    fillers.push({ kind: 'info', text: '상대가 여유 있게 시간을 흘려보내고 있습니다.' })
  fillers.push({ kind: 'info', text: '볼 점유가 이어집니다. 벤치의 지시가 그라운드에 전달됩니다.' })

  // 골 이벤트(스코어 누적)
  let scoreUs = match.moment.scoreUs
  let scoreThem = match.moment.scoreThem
  const goalEvents: SimEvent[] = outcome.goals.map((g) => {
    if (g.against) scoreThem += 1
    else scoreUs += 1
    const text = g.against
      ? `실점… ${nameOf(g.scorer)}에게 뒷공간을 내줬습니다.`
      : `${nameOf(g.scorer)}의 골! ${GOAL_TEXT[g.type] ?? '그물이 흔들립니다!'}`
    const kind: SimEventKind = g.against ? 'goal-against' : 'goal'
    return { minute: g.minute, kind, text, scoreUs, scoreThem, ball: ballFor(kind), actorId: g.scorer }
  })

  // 필러 배치: 골 분과 겹치지 않는 분을 시드로 선택
  const goalMinutes = new Set(outcome.goals.map((g) => g.minute))
  const fillerCount = Math.min(fillers.length, 4)
  const fillerEvents: SimEvent[] = []
  const span = end - start - 1
  for (let i = 0; i < fillerCount; i++) {
    let minute = start + 1 + Math.floor(((i + rand()) / fillerCount) * span)
    while (goalMinutes.has(minute)) minute += 1
    fillerEvents.push({
      minute,
      kind: fillers[i].kind,
      text: fillers[i].text,
      scoreUs: 0,
      scoreThem: 0,
      ball: ballFor(fillers[i].kind),
    })
  }

  const merged = [...goalEvents, ...fillerEvents].sort((a, b) => a.minute - b.minute)

  // 필러의 스코어를 직전 골 기준으로 채움
  let su = match.moment.scoreUs
  let st = match.moment.scoreThem
  for (const e of merged) {
    if (e.kind === 'goal' || e.kind === 'goal-against') {
      su = e.scoreUs
      st = e.scoreThem
    } else {
      e.scoreUs = su
      e.scoreThem = st
    }
  }

  merged.push({
    minute: end,
    kind: 'whistle',
    text: '경기 종료 휘슬이 울립니다.',
    scoreUs: su,
    scoreThem: st,
    ball: { x: 50, y: 50 },
  })
  return merged
}

export function displayMinute(minute: number, match: MatchData): string {
  if (match.moment.period !== 'ET' && minute >= 90) return minute === 90 ? "90+'" : `${minute}'`
  return `${minute}'`
}
