import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { pickComment } from '../engine/comments'
import { lineupSeed } from '../engine/hash'
import { simulateTimeline, displayMinute } from '../engine/simulation'
import { compositeBreakdown, explainResult } from '../engine/report'
import { SimPitch } from '../components/SimPitch'

const KIND_ICON: Record<string, string> = {
  goal: '⚽',
  'goal-against': '🥅',
  chance: '⚡',
  press: '🔥',
  counter: '⚠️',
  block: '🧱',
  info: '•',
  whistle: '📢',
}

export function ResultScreen() {
  const { match, players, playersById, engine, result, lineup, commonComments, scenarioComments, goto, resetBoard } =
    useGameStore()

  const [phase, setPhase] = useState<'sim' | 'reveal'>('sim')
  const [step, setStep] = useState(0)

  const seed = useMemo(() => lineupSeed(lineup), [lineup])

  // outcome의 득점자가 투입되지 않은 벤치 선수면 필드 위 슈팅 최고 선수로 치환
  const adjustedResult = useMemo(() => {
    if (!result) return null
    const onField = new Set(lineup.map((s) => s.playerId))
    const bestShooter = lineup
      .filter((s) => s.role !== 'GK')
      .map((s) => playersById.get(s.playerId))
      .filter((p) => p !== undefined)
      .sort((a, b) => b.attrs.shooting - a.attrs.shooting)[0]
    return {
      ...result,
      goals: result.goals.map((g) =>
        g.against || onField.has(g.scorer) || !bestShooter ? g : { ...g, scorer: bestShooter.id },
      ),
    }
  }, [result, lineup, playersById])

  const events = useMemo(() => {
    if (!match || !adjustedResult || !engine) return []
    return simulateTimeline(match, adjustedResult, engine, seed, (id) => playersById.get(id)?.name ?? id)
  }, [match, adjustedResult, engine, seed, playersById])

  useEffect(() => {
    if (phase !== 'sim' || step >= events.length) return
    // 장면 간격은 토큰 이동 트랜지션(1.7s)이 끝난 뒤 여유를 두고
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 500 : 2000)
    return () => clearTimeout(t)
  }, [phase, step, events.length])

  const verdict = useMemo(() => {
    if (!engine) return null
    return pickComment('result', { ...engine }, commonComments, scenarioComments, seed)
  }, [engine, commonComments, scenarioComments, seed])

  if (!match || !players || !result || !engine) return null

  const retry = () => {
    resetBoard()
    goto('board')
  }

  // ── 1단계: 시뮬레이션 리플레이(좌: 구장, 우: 이벤트 피드) ──
  if (phase === 'sim') {
    const visible = events.slice(0, step)
    const current = visible[visible.length - 1]
    const scoreUs = current?.scoreUs ?? match.moment.scoreUs
    const scoreThem = current?.scoreThem ?? match.moment.scoreThem
    return (
      <div className="screen sim">
        <div className="sim-scoreboard">
          <span>{players.us.teamCode}</span>
          <b>
            {scoreUs} : {scoreThem}
          </b>
          <span>{players.them.teamCode}</span>
          <em>{current ? displayMinute(current.minute, match) : `${match.moment.minute}'`}</em>
        </div>
        <div className="sim-main">
          <SimPitch
            lineup={lineup}
            them={match.them.displayLineup}
            playersById={playersById}
            event={current}
            step={step}
          />
          <div className="sim-feed">
            <AnimatePresence>
              {[...visible].reverse().map((e, i) => (
                <motion.div
                  key={visible.length - 1 - i}
                  className={`sim-event ${e.kind}`}
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: i === 0 ? 1 : 0.55, y: 0 }}
                >
                  <span className="sim-minute">{displayMinute(e.minute, match)}</span>
                  <span className="sim-icon">{KIND_ICON[e.kind]}</span>
                  <p>{e.text}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {step >= events.length ? (
          <button className="whistle-btn sim-skip" onClick={() => setPhase('reveal')}>
            결과 확인
          </button>
        ) : (
          <button className="ghost-btn small sim-skip" onClick={() => setStep(events.length)}>
            끝까지 돌리기 →
          </button>
        )}
      </div>
    )
  }

  // ── 2단계: 결과 공개 + 감독 리포트 ──
  const breakdown = compositeBreakdown(engine, match.difficulty)
  const reasons = explainResult(engine)

  return (
    <div className="screen result">
      <motion.p className="result-label" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {result.label}
      </motion.p>
      <motion.div
        className="result-score"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        <span>{players.us.teamName}</span>
        <b>
          {result.resultScoreUs} : {result.resultScoreThem}
        </b>
        <span>{players.them.teamName}</span>
      </motion.div>

      <motion.p className="result-narrative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        {result.narrative}
      </motion.p>

      <motion.div className="report-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <span className="history-label">감독 리포트 — 왜 이 결과인가</span>
        <ul className="reason-list">
          {reasons.map((r, i) => (
            <li key={i} className={r.positive ? 'good' : 'bad'}>
              {r.positive ? '▲' : '▼'} {r.text}
            </li>
          ))}
        </ul>
        <div className="breakdown">
          {breakdown.map((row, i) => (
            <div className="breakdown-row" key={i}>
              <span>{row.label}</span>
              <b className={row.delta >= 0 ? 'good' : 'bad'}>
                {row.delta >= 0 ? '+' : ''}
                {row.delta.toFixed(1)}
              </b>
            </div>
          ))}
          <div className="breakdown-row total">
            <span>전술 점수</span>
            <b>{Math.round(engine.compositeFinal)}점</b>
          </div>
        </div>
      </motion.div>

      <motion.div className="history-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <span className="history-label">실제 역사에서는</span>
        <p>
          {players.us.teamName} {match.actualHistory.finalScoreUs} : {match.actualHistory.finalScoreThem}{' '}
          {players.them.teamName} — {match.actualHistory.summary}
        </p>
      </motion.div>

      {verdict && (
        <motion.div className="coach-comment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <span className="coach-label">AI 수석코치 총평</span>
          <p>{verdict}</p>
        </motion.div>
      )}

      <div className="result-actions">
        <button className="primary-btn" onClick={retry}>다시 지휘하기</button>
        <button className="ghost-btn" onClick={() => goto('intro')}>다른 경기</button>
      </div>
    </div>
  )
}
