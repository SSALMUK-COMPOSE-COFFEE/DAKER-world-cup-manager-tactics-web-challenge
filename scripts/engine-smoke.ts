// 엔진 밸런싱 스모크 — 대표 전술 5종의 지표·outcome 분포를 찍는다.
// 실행: node scripts/engine-smoke.ts [시나리오id=kor-por-2022]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluate, pickOutcome } from '../web/src/engine/engine.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const id = process.argv[2] ?? 'kor-por-2022'
const match = JSON.parse(readFileSync(join(root, `data/matches/${id}/match.json`), 'utf8'))
const players = JSON.parse(readFileSync(join(root, `data/matches/${id}/players.json`), 'utf8'))

const byId = new Map<string, any>(
  [...players.us.players, ...players.them.players].map((p: any) => [p.id, p]),
)

function run(label: string, lineup: any[]) {
  const eng = evaluate(
    lineup.map((s) => ({ ...s, attrs: byId.get(s.playerId).attrs })),
    match.them.tacticProfile,
    match.moment,
    match.difficulty,
  )
  const outcome = pickOutcome(match.outcomes, eng.compositeFinal)
  console.log(
    `${label.padEnd(22)} ATT ${eng.ATT.toFixed(0).padStart(3)}  DEF ${eng.DEF.toFixed(0).padStart(3)}  PRESS ${eng.PRESS.toFixed(0).padStart(3)}  BAL ${eng.BALANCE.toFixed(0).padStart(3)}  RISK ${eng.RISK.toFixed(0).padStart(3)}  xG ${eng.xG.toFixed(2)}  xGA ${eng.xGA.toFixed(2)}  comp ${eng.compositeFinal.toFixed(1).padStart(5)} → ${outcome.label}`,
  )
}

const base = match.us.lineup

run('기본 배치', base)

run('라인 전진 +12', base.map((s: any) => (s.role === 'GK' ? s : { ...s, x: Math.min(95, s.x + 12) })))

run(
  '공격 올인(무모)',
  base.map((s: any) => {
    if (s.role === 'GK') return s
    if (s.role === 'DM' || s.role === 'CM') return { ...s, x: 80 }
    return { ...s, x: Math.min(95, s.x + 18) }
  }),
)

run(
  '승부수(전진+폭+균형)',
  base.map((s: any) => {
    if (s.role === 'GK') return s
    if (s.role === 'LW') return { ...s, x: 82, y: 12 }
    if (s.role === 'RW') return { ...s, x: 82, y: 88 }
    if (s.role === 'CB' || s.role === 'LB' || s.role === 'RB') return { ...s, x: s.x + 8 }
    return { ...s, x: Math.min(92, s.x + 12) }
  }),
)

run('수비 웅크리기', base.map((s: any) => (s.role === 'GK' ? s : { ...s, x: Math.max(8, s.x - 15) })))
