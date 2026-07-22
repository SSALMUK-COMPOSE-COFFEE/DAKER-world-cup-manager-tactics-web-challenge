// PLAN B 리더보드 서버 — 의존성 0 (node:http + node:sqlite, Node 26+).
// 클라이언트는 라인업을 보내고, 점수는 서버가 웹과 동일한 엔진으로 재계산한다(치팅 방지).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluate, pickOutcome } from '../web/src/engine/engine.ts'
import type { LineupSlot, MatchData, Player, PlayersData, ScenarioMeta } from '../web/src/engine/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 8000)
const DB_PATH = process.env.SQLITE_PATH ?? join(ROOT, 'server-data', 'planb.db')
const COOKIE = 'planb_sid'
// hajin.xyz에 다른 서비스들이 함께 살므로 쿠키를 /planb 하위로 격리
const COOKIE_PATH = process.env.COOKIE_PATH ?? '/'

// ── 시나리오 로드(기동 시 1회) ─────────────────────────────
interface Scenario {
  match: MatchData
  playersById: Map<string, Player>
  starterIds: Set<string>
  benchIds: Set<string>
}

const scenarios = new Map<string, Scenario>()
{
  const index = JSON.parse(readFileSync(join(ROOT, 'data/matches/index.json'), 'utf8')) as {
    scenarios: ScenarioMeta[]
  }
  for (const meta of index.scenarios) {
    if (meta.status !== 'ready') continue
    const dir = join(ROOT, 'data/matches', meta.dir)
    const match = JSON.parse(readFileSync(join(dir, 'match.json'), 'utf8')) as MatchData
    const players = JSON.parse(readFileSync(join(dir, 'players.json'), 'utf8')) as PlayersData
    scenarios.set(meta.id, {
      match,
      playersById: new Map(players.us.players.map((p) => [p.id, p])),
      starterIds: new Set(match.us.lineup.map((s) => s.playerId)),
      benchIds: new Set(match.us.bench),
    })
  }
  console.log(`시나리오 ${scenarios.size}개 로드: ${[...scenarios.keys()].join(', ')}`)
}

// ── DB ─────────────────────────────────────────────────────
mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    session_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    score REAL NOT NULL,
    outcome_label TEXT NOT NULL,
    lineup_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (session_id, scenario_id)
  )
`)

// ── 헬퍼 ───────────────────────────────────────────────────
function json(res: ServerResponse, status: number, body: unknown, setCookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  if (setCookie) headers['Set-Cookie'] = setCookie
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

function getSession(req: IncomingMessage): { sid: string; setCookie?: string } {
  const m = (req.headers.cookie ?? '').match(new RegExp(`${COOKIE}=([\\w-]+)`))
  if (m) return { sid: m[1] }
  const sid = randomUUID()
  return {
    sid,
    setCookie: `${COOKIE}=${sid}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  }
}

function readBody(req: IncomingMessage, limit = 32 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 라인업 검증: 11명·유니크·스쿼드 소속·GK 1명·좌표 범위·교체 규정 준수 */
function validateLineup(sc: Scenario, lineup: unknown): { ok: true; slots: LineupSlot[] } | { ok: false; error: string } {
  if (!Array.isArray(lineup) || lineup.length !== 11) return { ok: false, error: '라인업은 11명이어야 합니다' }
  const slots: LineupSlot[] = []
  const seen = new Set<string>()
  let gkCount = 0
  let subsUsed = 0
  for (const raw of lineup) {
    const s = raw as Partial<LineupSlot>
    if (
      typeof s.playerId !== 'string' ||
      typeof s.role !== 'string' ||
      typeof s.x !== 'number' ||
      typeof s.y !== 'number' ||
      s.x < 0 || s.x > 100 || s.y < 0 || s.y > 100
    )
      return { ok: false, error: '잘못된 슬롯 형식' }
    if (seen.has(s.playerId)) return { ok: false, error: '중복 선수' }
    seen.add(s.playerId)
    if (!sc.playersById.has(s.playerId)) return { ok: false, error: `스쿼드에 없는 선수: ${s.playerId}` }
    if (s.role === 'GK') gkCount++
    if (!sc.starterIds.has(s.playerId)) {
      if (!sc.benchIds.has(s.playerId)) return { ok: false, error: `벤치에 없는 선수: ${s.playerId}` }
      subsUsed++
    }
    slots.push({ playerId: s.playerId, x: s.x, y: s.y, role: s.role })
  }
  if (gkCount !== 1) return { ok: false, error: 'GK는 정확히 1명이어야 합니다' }
  if (subsUsed > sc.match.us.subsLeft) return { ok: false, error: `교체 한도 초과 (${subsUsed}/${sc.match.us.subsLeft})` }
  return { ok: true, slots }
}

const stmtUpsert = db.prepare(`
  INSERT INTO scores (session_id, scenario_id, nickname, score, outcome_label, lineup_json, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(session_id, scenario_id) DO UPDATE SET
    nickname = excluded.nickname,
    score = CASE WHEN excluded.score > scores.score THEN excluded.score ELSE scores.score END,
    outcome_label = CASE WHEN excluded.score > scores.score THEN excluded.outcome_label ELSE scores.outcome_label END,
    lineup_json = CASE WHEN excluded.score > scores.score THEN excluded.lineup_json ELSE scores.lineup_json END,
    updated_at = datetime('now')
`)
const stmtBest = db.prepare('SELECT score FROM scores WHERE session_id = ? AND scenario_id = ?')
const stmtRank = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE scenario_id = ? AND score > ?')
const stmtTotal = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE scenario_id = ?')
const stmtBoard = db.prepare(
  'SELECT nickname, score, outcome_label, updated_at FROM scores WHERE scenario_id = ? ORDER BY score DESC, updated_at ASC LIMIT ?',
)
const stmtOverall = db.prepare(`
  SELECT s1.session_id,
         (SELECT nickname FROM scores s2 WHERE s2.session_id = s1.session_id ORDER BY updated_at DESC LIMIT 1) AS nickname,
         SUM(score) AS total, COUNT(*) AS stages
  FROM scores s1 GROUP BY s1.session_id ORDER BY total DESC LIMIT ?
`)

// ── 라우팅 ─────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { sid, setCookie } = getSession(req)

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, scenarios: scenarios.size })
    }

    if (req.method === 'POST' && url.pathname === '/api/scores') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const sc = scenarios.get(body.scenarioId)
      if (!sc) return json(res, 404, { error: '없는 시나리오' }, setCookie)

      const nickname = String(body.nickname ?? '').trim().slice(0, 16) || '이름없는 감독'
      const v = validateLineup(sc, body.lineup)
      if (!v.ok) return json(res, 400, { error: v.error }, setCookie)

      // 서버 판정 — 웹과 동일한 엔진
      const engine = evaluate(
        v.slots.map((s) => ({ ...s, attrs: sc.playersById.get(s.playerId)!.attrs })),
        sc.match.them.tacticProfile,
        sc.match.moment,
        sc.match.difficulty,
      )
      const outcome = pickOutcome(sc.match.outcomes, engine.compositeFinal)

      stmtUpsert.run(sid, sc.match.id, nickname, engine.compositeFinal, outcome.label, JSON.stringify(v.slots))
      const best = (stmtBest.get(sid, sc.match.id) as { score: number }).score
      const rank = (stmtRank.get(sc.match.id, best) as { n: number }).n + 1
      const total = (stmtTotal.get(sc.match.id) as { n: number }).n

      return json(res, 200, {
        score: Math.round(engine.compositeFinal * 10) / 10,
        outcomeLabel: outcome.label,
        best: Math.round(best * 10) / 10,
        rank,
        total,
      }, setCookie)
    }

    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const scenarioId = url.searchParams.get('scenario') ?? ''
      if (!scenarios.has(scenarioId)) return json(res, 404, { error: '없는 시나리오' }, setCookie)
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))
      const rows = stmtBoard.all(scenarioId, limit) as {
        nickname: string; score: number; outcome_label: string; updated_at: string
      }[]
      const entries = rows.map((r, i) => ({
        rank: i + 1,
        nickname: r.nickname,
        score: Math.round(r.score * 10) / 10,
        outcomeLabel: r.outcome_label,
        at: r.updated_at,
      }))
      const mine = stmtBest.get(sid, scenarioId) as { score: number } | undefined
      const me = mine
        ? { score: Math.round(mine.score * 10) / 10, rank: (stmtRank.get(scenarioId, mine.score) as { n: number }).n + 1 }
        : null
      return json(res, 200, { entries, me }, setCookie)
    }

    if (req.method === 'GET' && url.pathname === '/api/leaderboard/overall') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))
      const rows = stmtOverall.all(limit) as {
        session_id: string; nickname: string; total: number; stages: number
      }[]
      const entries = rows.map((r, i) => ({
        rank: i + 1,
        nickname: r.nickname,
        total: Math.round(r.total * 10) / 10,
        stages: r.stages,
        me: r.session_id === sid,
      }))
      return json(res, 200, { entries }, setCookie)
    }

    return json(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(err)
    return json(res, err instanceof SyntaxError ? 400 : 500, { error: '요청 처리 실패' })
  }
})

server.listen(PORT, () => console.log(`리더보드 서버: http://localhost:${PORT} (db: ${DB_PATH})`))
