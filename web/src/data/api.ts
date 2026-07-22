// 리더보드 API 클라이언트 — 서버는 여유 기능이므로 모든 실패는 조용히 null로.
// 코어 게임은 서버 없이 완결된다는 원칙 유지.
import type { LineupSlot } from '../engine/types'

const BASE = import.meta.env.BASE_URL

export interface SubmitResult {
  score: number
  outcomeLabel: string
  best: number
  rank: number
  total: number
}

export interface BoardEntry {
  rank: number
  nickname: string
  score: number
  outcomeLabel: string
  at: string
}

export interface OverallEntry {
  rank: number
  nickname: string
  total: number
  stages: number
  me: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}api/${path}`, init)
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function submitScore(scenarioId: string, nickname: string, lineup: LineupSlot[]) {
  return request<SubmitResult>('scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId, nickname, lineup }),
  })
}

export function fetchLeaderboard(scenarioId: string) {
  return request<{ entries: BoardEntry[]; me: { score: number; rank: number } | null }>(
    `leaderboard?scenario=${encodeURIComponent(scenarioId)}&limit=10`,
  )
}

export function fetchOverall() {
  return request<{ entries: OverallEntry[] }>('leaderboard/overall?limit=20')
}
