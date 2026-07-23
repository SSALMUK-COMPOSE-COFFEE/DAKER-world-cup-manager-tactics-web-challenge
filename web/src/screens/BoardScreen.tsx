import { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Pitch } from '../components/Pitch'
import { PlayerToken } from '../components/PlayerToken'
import { Gauges } from '../components/Gauges'
import { HeatmapCanvas } from '../components/HeatmapCanvas'
import { computeHeatmap } from '../engine/heatmap'
import { pickComment } from '../engine/comments'
import { lineupSeed } from '../engine/hash'
import { FORMATIONS } from '../engine/formations'
import { ShareButton } from '../components/ShareButton'
import { PlayerDetail } from '../components/PlayerDetail'
import type { EnginePlayer } from '../engine/types'

export function BoardScreen() {
  const {
    match, players, playersById, lineup, bench, subsLeft, formation, engine, challenge,
    commonComments, scenarioComments,
    movePlayer, substitute, setFormation, resetBoard, whistle, goto,
  } = useGameStore()
  const [pendingSub, setPendingSub] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)

  const heatmap = useMemo(() => {
    if (!match) return null
    const toEngine = (slots: typeof lineup): EnginePlayer[] =>
      slots.flatMap((s) => {
        const p = playersById.get(s.playerId)
        return p ? [{ ...s, attrs: p.attrs }] : []
      })
    return computeHeatmap(toEngine(lineup), toEngine(match.them.displayLineup))
  }, [match, lineup, playersById])

  const comment = useMemo(() => {
    if (!engine || !heatmap) return null
    const metrics: Record<string, number> = {
      ...engine,
      coverageGapLeft: heatmap.gapLeft,
      coverageGapCenter: heatmap.gapCenter,
      coverageGapRight: heatmap.gapRight,
    }
    return pickComment('tactic', metrics, commonComments, scenarioComments, lineupSeed(lineup))
  }, [engine, heatmap, commonComments, scenarioComments, lineup])

  if (!match || !players || !engine) return null

  const handleTokenClick = (playerId: string) => {
    if (pendingSub) {
      substitute(pendingSub, playerId)
      setPendingSub(null)
      return
    }
    setDetailId((cur) => (cur === playerId ? null : playerId))
  }

  const detailSlot = detailId
    ? lineup.find((s) => s.playerId === detailId) ??
      match.them.displayLineup.find((s) => s.playerId === detailId)
    : undefined
  const detailPlayer = detailId ? playersById.get(detailId) : undefined
  const detailSide = detailSlot && lineup.some((s) => s.playerId === detailId) ? 'us' : 'them'

  return (
    <div className="screen board">
      <header className="board-header">
        <button className="ghost-btn small" onClick={() => goto('briefing')}>←</button>
        <div className="board-score">
          <span>{players.us.teamCode}</span>
          <b>{match.moment.scoreUs} : {match.moment.scoreThem}</b>
          <span>{players.them.teamCode}</span>
          <em>{match.moment.period === 'ET' ? '연장' : match.moment.period === '1H' ? '전반' : '후반'} {match.moment.minute}'</em>
        </div>
        <div className="board-header-actions">
          <ShareButton scenarioId={match.id} lineup={lineup} squad={players.us.players} />
          <button className="ghost-btn small" onClick={() => setShowHeatmap((v) => !v)}>
            {showHeatmap ? '히트맵 끄기' : '히트맵 켜기'}
          </button>
        </div>
      </header>

      {challenge && (
        <div className="challenge-banner">
          <span>
            🎯 <b>{challenge.nickname}</b>의 도전장 — <b>{challenge.score.toFixed(1)}점</b> ·{' '}
            “{challenge.label}” 을 넘어보세요
          </span>
          {challenge.lineup.every((s, i) => {
            const c = lineup[i]
            return c && c.playerId === s.playerId && c.x === s.x && c.y === s.y && c.role === s.role
          }) && (
            <small>지금 보드가 상대의 전술입니다. 그대로 다듬거나, ‘초기화’로 나만의 전술을 시작하세요.</small>
          )}
        </div>
      )}

      <div className="board-main">
        <Pitch
          onDragTo={movePlayer}
          overlay={
            <>
              {showHeatmap && heatmap && <HeatmapCanvas heatmap={heatmap} />}
              <div className="press-line" style={{ left: `${engine.pressLineX}%` }} />
            </>
          }
        >
          {match.them.displayLineup.map((slot) => {
            const p = playersById.get(slot.playerId)
            return p ? (
              <PlayerToken
                key={slot.playerId}
                slot={slot}
                player={p}
                side="them"
                onClick={() => handleTokenClick(slot.playerId)}
              />
            ) : null
          })}
          {lineup.map((slot) => {
            const p = playersById.get(slot.playerId)
            return p ? (
              <PlayerToken
                key={slot.playerId}
                slot={slot}
                player={p}
                side="us"
                selected={pendingSub !== null && slot.role !== 'GK'}
                onClick={() => handleTokenClick(slot.playerId)}
              />
            ) : null
          })}
          {detailPlayer && detailSlot && (
            <PlayerDetail
              player={detailPlayer}
              role={detailSlot.role}
              side={detailSide}
              onClose={() => setDetailId(null)}
            />
          )}
        </Pitch>

        <aside className="board-panel">
          <Gauges engine={engine} />
          <div className="coach-comment">
            <span className="coach-label">AI 수석코치</span>
            <p>{comment ?? '지시를 기다리고 있습니다, 감독님.'}</p>
          </div>
          <div className="formation-row">
            {Object.keys(FORMATIONS).map((name) => (
              <button
                key={name}
                className={`chip ${formation === name ? 'active' : ''}`}
                onClick={() => setFormation(name)}
              >
                {name}
              </button>
            ))}
            <button className="chip" onClick={resetBoard}>초기화</button>
          </div>
        </aside>
      </div>

      <footer className="board-footer">
        <div className="bench">
          <span className="bench-label">벤치 · 교체 {subsLeft}장</span>
          <div className="bench-list">
            {bench.map((id) => {
              const p = playersById.get(id)
              if (!p) return null
              return (
                <button
                  key={id}
                  className={`bench-card ${pendingSub === id ? 'active' : ''}`}
                  disabled={subsLeft <= 0}
                  onClick={() => setPendingSub(pendingSub === id ? null : id)}
                >
                  <b>{p.overall}</b>
                  <span>{p.name}</span>
                  <em>{p.pos}</em>
                </button>
              )
            })}
          </div>
          {pendingSub && <p className="bench-hint">교체할 필드 선수를 선택하세요 (GK 제외)</p>}
        </div>
        <button className="whistle-btn" onClick={whistle}>
          휘슬
        </button>
      </footer>
    </div>
  )
}
