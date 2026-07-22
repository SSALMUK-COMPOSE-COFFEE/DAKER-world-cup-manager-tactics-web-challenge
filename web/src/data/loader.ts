import type { CommentEntry } from '../engine/comments'
import type { MatchData, PlayersData, ScenarioMeta } from '../engine/types'

// 배포 프리픽스(/planb/) 대응 — vite base 설정을 따라간다
const BASE = import.meta.env.BASE_URL

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} 로드 실패 (${res.status})`)
  return res.json() as Promise<T>
}

async function fetchJsonOptional<T>(path: string): Promise<T | null> {
  const res = await fetch(path)
  // 정적 서버의 SPA 폴백(없는 경로 → index.html 200)을 JSON으로 오인하지 않게 가드
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
  return res.json() as Promise<T>
}

export function loadScenarioIndex(): Promise<{ scenarios: ScenarioMeta[] }> {
  return fetchJson(`${BASE}data/matches/index.json`)
}

export function loadCommonComments(): Promise<CommentEntry[] | null> {
  return fetchJsonOptional(`${BASE}data/comments/common.json`)
}

export async function loadScenario(dir: string): Promise<{
  match: MatchData
  players: PlayersData
  comments: CommentEntry[]
}> {
  const [match, players, comments] = await Promise.all([
    fetchJson<MatchData>(`${BASE}data/matches/${dir}/match.json`),
    fetchJson<PlayersData>(`${BASE}data/matches/${dir}/players.json`),
    fetchJsonOptional<CommentEntry[]>(`${BASE}data/matches/${dir}/comments.json`),
  ])
  return { match, players, comments: comments ?? [] }
}
