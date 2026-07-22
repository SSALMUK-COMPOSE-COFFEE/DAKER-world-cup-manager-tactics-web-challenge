// 시나리오 데이터 기계 검증 — 대량 생성/수정 후 커밋 전에 돌린다.
// 실행: node scripts/validate-data.ts  (오류 있으면 exit 1)
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors: string[] = []
const warns: string[] = []
const err = (msg: string) => errors.push(msg)
const warn = (msg: string) => warns.push(msg)

const ATTR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']
const COMMENT_METRICS = new Set([
  'ATT', 'DEF', 'PRESS', 'BALANCE', 'RISK', 'xG', 'xGA', 'composite', 'compositeFinal',
  'pressLineX', 'lineHeight', 'backCount', 'fwdCount', 'widthUse',
  'coverageGapLeft', 'coverageGapCenter', 'coverageGapRight',
])
const COMMENT_OPS = new Set(['>=', '<=', '>', '<', '=='])

function loadJson(path: string, label: string): any | null {
  if (!existsSync(path)) {
    err(`${label}: 파일 없음 (${path})`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    err(`${label}: JSON 파싱 실패 — ${(e as Error).message}`)
    return null
  }
}

function checkPlayers(id: string, squad: any, side: string): Map<string, any> {
  const byId = new Map<string, any>()
  if (!squad?.players?.length) {
    err(`${id}/${side}: players 비어 있음`)
    return byId
  }
  for (const p of squad.players) {
    if (!p.id || byId.has(p.id)) err(`${id}/${side}: 선수 id 누락/중복 (${p.id ?? p.name})`)
    byId.set(p.id, p)
    if (!p.name) err(`${id}/${side}/${p.id}: name 누락`)
    if (!['GK', 'DF', 'MF', 'FW'].includes(p.pos)) err(`${id}/${side}/${p.id}: pos 값 이상 (${p.pos})`)
    if (typeof p.overall !== 'number' || p.overall < 1 || p.overall > 99)
      err(`${id}/${side}/${p.id}: overall 범위 이상 (${p.overall})`)
    for (const k of ATTR_KEYS) {
      const v = p.attrs?.[k]
      if (typeof v !== 'number' || v < 0 || v > 99) err(`${id}/${side}/${p.id}: attrs.${k} 이상 (${v})`)
    }
  }
  return byId
}

function checkLineup(id: string, label: string, lineup: any[], byId: Map<string, any>) {
  if (!Array.isArray(lineup) || lineup.length !== 11) {
    err(`${id}/${label}: 11명이 아님 (${lineup?.length})`)
    return
  }
  const seen = new Set<string>()
  let gk = 0
  for (const s of lineup) {
    if (seen.has(s.playerId)) err(`${id}/${label}: 중복 배치 (${s.playerId})`)
    seen.add(s.playerId)
    if (!byId.has(s.playerId)) err(`${id}/${label}: players.json에 없는 참조 (${s.playerId})`)
    if (typeof s.x !== 'number' || s.x < 0 || s.x > 100 || typeof s.y !== 'number' || s.y < 0 || s.y > 100)
      err(`${id}/${label}/${s.playerId}: 좌표 범위 이탈 (${s.x}, ${s.y})`)
    if (s.role === 'GK') gk++
  }
  if (gk !== 1) err(`${id}/${label}: GK가 ${gk}명 (정확히 1명이어야 함)`)
}

function checkComments(label: string, comments: any) {
  if (!Array.isArray(comments)) {
    err(`${label}: 배열이 아님`)
    return
  }
  const slots = { tactic: 0, result: 0 }
  for (const c of comments) {
    if (!c.id) err(`${label}: id 없는 코멘트`)
    if (c.slot !== 'tactic' && c.slot !== 'result') err(`${label}/${c.id}: slot 이상 (${c.slot})`)
    else slots[c.slot as 'tactic' | 'result']++
    if (typeof c.priority !== 'number') err(`${label}/${c.id}: priority 없음`)
    if (!Array.isArray(c.lines) || c.lines.length === 0 || c.lines.some((l: any) => typeof l !== 'string' || !l.trim()))
      err(`${label}/${c.id}: lines 비어 있거나 형식 이상`)
    if (!Array.isArray(c.when)) err(`${label}/${c.id}: when이 배열 아님`)
    else
      for (const w of c.when) {
        if (!COMMENT_METRICS.has(w.metric)) err(`${label}/${c.id}: 알 수 없는 metric "${w.metric}"`)
        if (!COMMENT_OPS.has(w.op)) err(`${label}/${c.id}: 알 수 없는 op "${w.op}"`)
        if (typeof w.value !== 'number') err(`${label}/${c.id}: value가 숫자 아님`)
      }
  }
  return slots
}

// ── 공통 코멘트 뱅크 ──
const common = loadJson(join(ROOT, 'data/comments/common.json'), 'comments/common')
if (common) {
  const slots = checkComments('comments/common', common)
  // 무코멘트 방지: slot별 무조건 매칭(when=[]) 기본 코멘트 필요
  for (const slot of ['tactic', 'result'] as const) {
    if (!common.some((c: any) => c.slot === slot && Array.isArray(c.when) && c.when.length === 0))
      warn(`comments/common: ${slot} slot에 기본(when=[]) 코멘트가 없음 — 무코멘트 상태 가능`)
    if (slots && slots[slot] === 0) err(`comments/common: ${slot} 코멘트가 하나도 없음`)
  }
}

// ── 시나리오 ──
const index = loadJson(join(ROOT, 'data/matches/index.json'), 'index')
if (index?.scenarios) {
  const ids = new Set<string>()
  for (const meta of index.scenarios) {
    if (ids.has(meta.id)) err(`index: 중복 id (${meta.id})`)
    ids.add(meta.id)
    for (const k of ['id', 'dir', 'title', 'subtitle', 'tag', 'status']) if (!meta[k]) err(`index/${meta.id}: ${k} 누락`)
    if (typeof meta.stage !== 'number') warn(`index/${meta.id}: stage 없음 (정렬 맨 뒤로 감)`)
    if (![1, 2, 3].includes(meta.stars)) warn(`index/${meta.id}: stars 이상 (${meta.stars})`)
    if (meta.status !== 'ready') continue

    const dir = join(ROOT, 'data/matches', meta.dir)
    const match = loadJson(join(dir, 'match.json'), `${meta.id}/match`)
    const players = loadJson(join(dir, 'players.json'), `${meta.id}/players`)
    if (!match || !players) continue

    if (match.id !== meta.id) err(`${meta.id}: match.json id 불일치 (${match.id})`)
    if (!['easy', 'normal', 'hard'].includes(match.difficulty)) err(`${meta.id}: difficulty 이상 (${match.difficulty})`)

    const usById = checkPlayers(meta.id, players.us, 'us')
    const themById = checkPlayers(meta.id, players.them, 'them')
    const allById = new Map([...usById, ...themById])

    // moment
    const m = match.moment
    if (!['1H', '2H', 'ET'].includes(m?.period)) err(`${meta.id}: moment.period 이상`)
    if (typeof m?.timeLeftMin !== 'number' || m.timeLeftMin <= 0) err(`${meta.id}: timeLeftMin 이상 (${m?.timeLeftMin})`)

    // 라인업/벤치
    checkLineup(meta.id, 'us.lineup', match.us?.lineup, usById)
    checkLineup(meta.id, 'them.displayLineup', match.them?.displayLineup, themById)
    const starterIds = new Set((match.us?.lineup ?? []).map((s: any) => s.playerId))
    for (const b of match.us?.bench ?? []) {
      if (!usById.has(b)) err(`${meta.id}/bench: players.json에 없는 참조 (${b})`)
      if (starterIds.has(b)) err(`${meta.id}/bench: 선발과 중복 (${b})`)
    }
    if (typeof match.us?.subsLeft !== 'number' || match.us.subsLeft < 0) err(`${meta.id}: subsLeft 이상`)

    // tacticProfile
    for (const k of ['defLine', 'press', 'width', 'tempo', 'directness']) {
      const v = match.them?.tacticProfile?.[k]
      if (typeof v !== 'number' || v < 0 || v > 100) err(`${meta.id}: tacticProfile.${k} 이상 (${v})`)
    }

    // outcomes: 내림차순 + 마지막 0 + 득점자 참조
    const outs = match.outcomes ?? []
    if (outs.length < 3) err(`${meta.id}: outcomes ${outs.length}개 (최소 3개)`)
    for (let i = 0; i < outs.length; i++) {
      const o = outs[i]
      if (i > 0 && o.minScore >= outs[i - 1].minScore)
        err(`${meta.id}/outcomes[${i}]: minScore 내림차순 위반 (${outs[i - 1].minScore} → ${o.minScore})`)
      for (const g of o.goals ?? []) {
        if (!allById.has(g.scorer)) err(`${meta.id}/outcomes[${i}]: 없는 득점자 (${g.scorer})`)
        const isThem = themById.has(g.scorer)
        if (g.against && !isThem) err(`${meta.id}/outcomes[${i}]: against 골인데 득점자가 우리 팀 (${g.scorer})`)
        if (!g.against && isThem) err(`${meta.id}/outcomes[${i}]: 우리 골인데 득점자가 상대 팀 (${g.scorer})`)
      }
      const usGoals = (o.goals ?? []).filter((g: any) => !g.against).length
      const themGoals = (o.goals ?? []).filter((g: any) => g.against).length
      if (m && o.resultScoreUs !== m.scoreUs + usGoals)
        warn(`${meta.id}/outcomes[${i}] "${o.label}": 우리 스코어(${o.resultScoreUs}) ≠ 시작(${m.scoreUs})+골(${usGoals}) — 연출 불일치`)
      if (m && o.resultScoreThem !== m.scoreThem + themGoals)
        warn(`${meta.id}/outcomes[${i}] "${o.label}": 상대 스코어(${o.resultScoreThem}) ≠ 시작(${m.scoreThem})+실점(${themGoals}) — 연출 불일치`)
    }
    if (outs.length > 0 && outs[outs.length - 1].minScore !== 0)
      err(`${meta.id}: 마지막 outcome의 minScore가 0이 아님 — 저점 미커버`)

    // actualHistory
    if (typeof match.actualHistory?.finalScoreUs !== 'number' || !match.actualHistory?.summary)
      err(`${meta.id}: actualHistory 불완전`)

    // 시나리오 전용 코멘트(선택)
    const cPath = join(dir, 'comments.json')
    if (existsSync(cPath)) {
      const c = loadJson(cPath, `${meta.id}/comments`)
      if (c) checkComments(`${meta.id}/comments`, c)
    }
  }
}

// ── 리포트 ──
for (const w of warns) console.log(`⚠️  ${w}`)
for (const e of errors) console.log(`❌ ${e}`)
console.log(`\n검증 완료 — 오류 ${errors.length}건, 경고 ${warns.length}건`)
process.exit(errors.length > 0 ? 1 : 0)
