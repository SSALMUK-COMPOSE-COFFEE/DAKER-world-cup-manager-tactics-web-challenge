// 도달 가능한 composite 분포 스윕 — 유저가 실제로 만들 법한 전술 변주를
// 격자로 생성해 outcome 임계값 튜닝의 근거를 만든다.
// 실행: node scripts/engine-sweep.ts [시나리오id=kor-por-2022]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluate } from '../web/src/engine/engine.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const id = process.argv[2] ?? 'kor-por-2022'
const match = JSON.parse(readFileSync(join(root, `data/matches/${id}/match.json`), 'utf8'))
const players = JSON.parse(readFileSync(join(root, `data/matches/${id}/players.json`), 'utf8'))

const byId = new Map<string, any>(
  [...players.us.players, ...players.them.players].map((p: any) => [p.id, p]),
)

const base = match.us.lineup
const bench: string[] = match.us.bench

const clampX = (x: number) => Math.min(95, Math.max(5, x))
const clampY = (y: number) => Math.min(95, Math.max(5, y))

// 변주 축: 라인 전진량 × 폭 스케일 × 공격수 교체 수 × 미드필더 전진 여부
const shifts = [-15, -8, 0, 8, 15, 22]
const widthScales = [0.8, 1.0, 1.25]
const subCounts = [0, 1, 2]
const mfPushes = [false, true]

// 벤치에서 공격 성향(overall 높은 FW/MF) 순으로 교체 후보
const subCandidates = bench
  .map((pid) => byId.get(pid))
  .filter((p: any) => p.pos === 'FW' || p.pos === 'MF')
  .sort((a: any, b: any) => b.overall - a.overall)
  .map((p: any) => p.id)

// 교체 대상: 필드에서 수비 성향(공격 기여 낮은) 순
function makeLineup(shift: number, widthScale: number, subCount: number, mfPush: boolean) {
  let lineup = base.map((s: any) => ({ ...s }))
  // 교체: DM부터 공격수로
  const outOrder = lineup.filter((s: any) => s.role === 'DM' || s.role === 'CB').map((s: any) => s.playerId)
  for (let i = 0; i < subCount && i < subCandidates.length && i < outOrder.length; i++) {
    lineup = lineup.map((s: any) => (s.playerId === outOrder[i] ? { ...s, playerId: subCandidates[i] } : s))
  }
  return lineup.map((s: any) => {
    if (s.role === 'GK') return s
    let x = s.x + shift
    if (mfPush && (s.role === 'DM' || s.role === 'CM' || s.role === 'AM')) x += 10
    const y = 50 + (s.y - 50) * widthScale
    return { ...s, x: clampX(x), y: clampY(y) }
  })
}

const results: { comp: number; risk: number; bal: number }[] = []
for (const shift of shifts)
  for (const w of widthScales)
    for (const sc of subCounts)
      for (const mp of mfPushes) {
        const lineup = makeLineup(shift, w, sc, mp)
        const eng = evaluate(
          lineup.map((s: any) => ({ ...s, attrs: byId.get(s.playerId).attrs })),
          match.them.tacticProfile,
          match.moment,
          match.difficulty,
        )
        results.push({ comp: eng.compositeFinal, risk: eng.RISK, bal: eng.BALANCE })
      }

results.sort((a, b) => a.comp - b.comp)
const pct = (p: number) => results[Math.floor((results.length - 1) * p)].comp
console.log(`샘플 ${results.length}개`)
console.log(
  `min ${results[0].comp.toFixed(1)}  p10 ${pct(0.1).toFixed(1)}  p25 ${pct(0.25).toFixed(1)}  p50 ${pct(0.5).toFixed(1)}  p75 ${pct(0.75).toFixed(1)}  p90 ${pct(0.9).toFixed(1)}  max ${results[results.length - 1].comp.toFixed(1)}`,
)

// 히스토그램(5점 구간)
const buckets = new Map<number, number>()
for (const r of results) {
  const b = Math.floor(r.comp / 5) * 5
  buckets.set(b, (buckets.get(b) ?? 0) + 1)
}
for (const [b, n] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`${String(b).padStart(3)}~${b + 5}: ${'█'.repeat(n)} ${n}`)
}

// 현재 outcome 임계값 기준 분포
const counts = new Map<string, number>()
for (const r of results) {
  const o = match.outcomes.find((o: any) => r.comp >= o.minScore)
  counts.set(o.label, (counts.get(o.label) ?? 0) + 1)
}
console.log('\noutcome 분포(현 임계값):')
for (const [label, n] of counts) console.log(`  ${label}: ${n} (${((n / results.length) * 100).toFixed(0)}%)`)
