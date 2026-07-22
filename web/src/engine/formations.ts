// 포메이션 프리셋 — 선수→슬롯 매핑은 "동일 role → 같은 대분류(pos) → 남은 선수" 순의
// 결정론적 규칙(proposal §3.1). GK는 항상 제자리.
import type { LineupSlot, Player } from './types'

export interface FormationSlot {
  role: string
  x: number
  y: number
}

export const FORMATIONS: Record<string, FormationSlot[]> = {
  '4-2-3-1': [
    { role: 'GK', x: 6, y: 50 },
    { role: 'LB', x: 30, y: 16 },
    { role: 'CB', x: 22, y: 38 },
    { role: 'CB', x: 22, y: 62 },
    { role: 'RB', x: 30, y: 84 },
    { role: 'DM', x: 42, y: 38 },
    { role: 'DM', x: 42, y: 62 },
    { role: 'LW', x: 68, y: 20 },
    { role: 'AM', x: 60, y: 50 },
    { role: 'RW', x: 68, y: 80 },
    { role: 'ST', x: 82, y: 50 },
  ],
  '4-3-3': [
    { role: 'GK', x: 6, y: 50 },
    { role: 'LB', x: 32, y: 16 },
    { role: 'CB', x: 24, y: 38 },
    { role: 'CB', x: 24, y: 62 },
    { role: 'RB', x: 32, y: 84 },
    { role: 'CM', x: 48, y: 30 },
    { role: 'DM', x: 42, y: 50 },
    { role: 'CM', x: 48, y: 70 },
    { role: 'LW', x: 74, y: 20 },
    { role: 'ST', x: 82, y: 50 },
    { role: 'RW', x: 74, y: 80 },
  ],
  '3-4-3': [
    { role: 'GK', x: 6, y: 50 },
    { role: 'CB', x: 24, y: 28 },
    { role: 'CB', x: 20, y: 50 },
    { role: 'CB', x: 24, y: 72 },
    { role: 'LM', x: 50, y: 14 },
    { role: 'CM', x: 44, y: 40 },
    { role: 'CM', x: 44, y: 60 },
    { role: 'RM', x: 50, y: 86 },
    { role: 'LW', x: 76, y: 26 },
    { role: 'ST', x: 84, y: 50 },
    { role: 'RW', x: 76, y: 74 },
  ],
}

const ROLE_TO_POS: Record<string, Player['pos']> = {
  GK: 'GK',
  LB: 'DF', CB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF',
  DM: 'MF', CM: 'MF', AM: 'MF', LM: 'MF', RM: 'MF',
  LW: 'FW', RW: 'FW', ST: 'FW', CF: 'FW', FW: 'FW',
}

export function roleToPos(role: string): Player['pos'] {
  return ROLE_TO_POS[role] ?? 'MF'
}

/**
 * 현재 라인업의 선수들을 프리셋 슬롯에 결정론적으로 배정한다.
 * 슬롯 순서대로: ① 동일 role 미배정 선수 → ② 같은 pos 대분류 → ③ 남은 선수.
 * 각 단계에서 현재 라인업 배열 순서(안정적)로 첫 후보를 뽑는다.
 */
export function applyFormation(
  lineup: LineupSlot[],
  playersById: Map<string, Player>,
  formation: string,
): LineupSlot[] {
  const slots = FORMATIONS[formation]
  if (!slots) return lineup

  const remaining = [...lineup]
  const take = (pred: (s: LineupSlot) => boolean): LineupSlot | undefined => {
    const idx = remaining.findIndex(pred)
    return idx >= 0 ? remaining.splice(idx, 1)[0] : undefined
  }

  const next: LineupSlot[] = []
  for (const slot of slots) {
    const slotPos = roleToPos(slot.role)
    const picked =
      take((s) => s.role === slot.role) ??
      take((s) => (playersById.get(s.playerId)?.pos ?? roleToPos(s.role)) === slotPos) ??
      take(() => true)
    if (!picked) break
    next.push({ playerId: picked.playerId, x: slot.x, y: slot.y, role: slot.role })
  }
  return next
}
