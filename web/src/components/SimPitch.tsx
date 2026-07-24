import { Pitch } from './Pitch'
import { PlayerToken } from './PlayerToken'
import { fnv1a } from '../engine/hash'
import type { SimEvent } from '../engine/simulation'
import type { LineupSlot, Player } from '../engine/types'

const clamp = (v: number) => Math.min(97, Math.max(3, v))

/**
 * 시뮬레이션 리플레이 배치 계산.
 * 킥오프(step 0)에는 감독이 짠 포메이션을 그대로 보여준 뒤,
 * 장면마다 팀별로 볼과 가장 가까운 2명(+장면 주인공)은 볼 곁까지 달려가고,
 * 나머지는 볼 방향으로 은은하게 쏠린다. 전부 결정론적(시드=선수id+step).
 * 실제 이동은 CSS 트랜지션이 보간한다.
 */
function placeTeam(
  slots: LineupSlot[],
  ball: { x: number; y: number },
  step: number,
  actorId: string | undefined,
): LineupSlot[] {
  // 첫 프레임: 드래그한 원본 배치를 그대로 노출 — "내 전술 → 경기 전개" 연결감
  if (step === 0) return slots

  const outfield = slots.filter((s) => s.role !== 'GK')
  const byDist = [...outfield].sort(
    (a, b) => Math.hypot(ball.x - a.x, ball.y - a.y) - Math.hypot(ball.x - b.x, ball.y - b.y),
  )
  const involved = new Set(byDist.slice(0, 2).map((s) => s.playerId))
  if (actorId && outfield.some((s) => s.playerId === actorId)) involved.add(actorId)

  return slots.map((slot) => {
    if (slot.role === 'GK') return slot
    const h = fnv1a(`${slot.playerId}:${step}`)

    if (involved.has(slot.playerId)) {
      // 볼 주변 반경 5~13으로 달려감 — 주인공은 볼에 바짝
      const angle = ((h % 360) * Math.PI) / 180
      const radius = slot.playerId === actorId ? 4 : 5 + (h % 9)
      return {
        ...slot,
        x: clamp(ball.x + Math.cos(angle) * radius),
        y: clamp(ball.y + Math.sin(angle) * radius),
      }
    }

    // 나머지: 볼 방향으로 약하게 쏠림 + 결정론적 흔들림(±3)
    const jx = ((fnv1a(`${slot.playerId}:${step}:x`) % 100) / 100 - 0.5) * 6
    const jy = ((fnv1a(`${slot.playerId}:${step}:y`) % 100) / 100 - 0.5) * 6
    const dx = ball.x - slot.x
    const dy = ball.y - slot.y
    const dist = Math.hypot(dx, dy) || 1
    const pull = Math.max(0, 1 - dist / 70) * 12
    return {
      ...slot,
      x: clamp(slot.x + (dx / dist) * pull + jx),
      y: clamp(slot.y + (dy / dist) * pull + jy),
    }
  })
}

export function SimPitch({
  lineup,
  them,
  playersById,
  event,
  step,
}: {
  lineup: LineupSlot[]
  them: LineupSlot[]
  playersById: Map<string, Player>
  event: SimEvent | undefined
  step: number
}) {
  const ball = event?.ball ?? { x: 50, y: 50 }
  const placedUs = placeTeam(lineup, ball, step, event?.actorId)
  const placedThem = placeTeam(them, ball, step, event?.actorId)

  const renderTokens = (placed: LineupSlot[], side: 'us' | 'them') =>
    placed.map((slot) => {
      const p = playersById.get(slot.playerId)
      return p ? (
        <PlayerToken key={slot.playerId} slot={slot} player={p} side={side} selected={event?.actorId === slot.playerId} />
      ) : null
    })

  return (
    <div className="sim-pitch">
      <Pitch>
        {renderTokens(placedThem, 'them')}
        {renderTokens(placedUs, 'us')}
        <div className="ball" style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />
      </Pitch>
    </div>
  )
}
