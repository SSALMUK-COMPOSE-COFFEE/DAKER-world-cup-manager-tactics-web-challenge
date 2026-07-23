import type { Player } from '../engine/types'

const ATTR_LABELS: { key: keyof Player['attrs']; label: string }[] = [
  { key: 'pace', label: '속도' },
  { key: 'shooting', label: '슈팅' },
  { key: 'passing', label: '패스' },
  { key: 'dribbling', label: '드리블' },
  { key: 'defending', label: '수비' },
  { key: 'physical', label: '피지컬' },
]

/** 토큰 탭 시 뜨는 선수 상세 카드 */
export function PlayerDetail({
  player,
  role,
  side,
  onClose,
}: {
  player: Player
  role: string
  side: 'us' | 'them'
  onClose: () => void
}) {
  return (
    <div className={`player-detail ${side}`} onClick={onClose}>
      <div className="player-detail-head">
        <span className="player-detail-overall">{player.overall}</span>
        <div className="player-detail-name">
          <b>{player.name}</b>
          <span>
            {role} · {player.pos}
            {side === 'them' ? ' · 상대' : ''}
          </span>
        </div>
        <button className="ghost-btn small" onClick={onClose}>✕</button>
      </div>
      <div className="player-detail-attrs">
        {ATTR_LABELS.map(({ key, label }) => (
          <div className="gauge" key={key}>
            <span className="gauge-label">{label}</span>
            <div className="gauge-track">
              <div
                className="gauge-fill attr"
                style={{ width: `${player.attrs[key]}%` }}
                data-tier={player.attrs[key] >= 80 ? 'high' : player.attrs[key] >= 60 ? 'mid' : 'low'}
              />
            </div>
            <span className="gauge-value">{player.attrs[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
