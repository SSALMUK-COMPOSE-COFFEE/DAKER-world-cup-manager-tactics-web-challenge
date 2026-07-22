// 라인업 해시 시드 — 코멘트 문장 변주·연출 선택에 쓰는 결정론적 시드(난수 금지).
import type { LineupSlot } from './types'

export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 좌표는 반올림해 해시 — 픽셀 서브단위 미세 이동으로 코멘트가 바뀌지 않게 */
export function lineupSeed(lineup: LineupSlot[]): number {
  const key = [...lineup]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map((s) => `${s.playerId}:${Math.round(s.x)},${Math.round(s.y)}`)
    .join('|')
  return fnv1a(key)
}
