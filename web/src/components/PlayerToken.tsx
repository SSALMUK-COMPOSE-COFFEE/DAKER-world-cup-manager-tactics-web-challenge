import type { LineupSlot, Player } from '../engine/types'

export function PlayerToken({
  slot,
  player,
  side,
  selected,
  onClick,
}: {
  slot: LineupSlot
  player: Player
  side: 'us' | 'them'
  selected?: boolean
  onClick?: () => void
}) {
  const locked = slot.role === 'GK'
  const draggable = side === 'us' && !locked
  const lastName = player.name.length > 3 ? player.name.slice(-3) : player.name
  return (
    <div
      className={[
        'token',
        side,
        draggable ? 'draggable' : '',
        locked ? 'locked' : '',
        selected ? 'selected' : '',
      ].join(' ')}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      data-draggable-id={draggable ? slot.playerId : undefined}
      onClick={onClick}
    >
      <div className="token-card">
        <span className="token-overall">{player.overall}</span>
        <span className="token-role">{slot.role}</span>
      </div>
      <span className="token-name">{lastName}</span>
    </div>
  )
}
