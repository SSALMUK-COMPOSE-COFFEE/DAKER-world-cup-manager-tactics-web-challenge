import { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { loadProgress } from '../data/progress'
import { OverallBoard } from '../components/OverallBoard'

export function IntroScreen() {
  const scenarios = useGameStore((s) => s.scenarios)
  const selectScenario = useGameStore((s) => s.selectScenario)
  const progress = useMemo(() => loadProgress(), [])
  const [showBoard, setShowBoard] = useState(false)

  const ordered = [...scenarios].sort((a, b) => (a.stage ?? 99) - (b.stage ?? 99))

  return (
    <div className="screen intro">
      <header className="intro-hero">
        <h1 className="logo">PLAN B</h1>
        <p className="tagline">이 순간, 당신의 플랜 B는?</p>
        <p className="sub">월드컵 명경기의 결정적 순간, 당신이 감독이라면.</p>
      </header>
      <div className="scenario-grid">
        {ordered.map((sc) => {
          const rec = progress[sc.id]
          return (
            <button
              key={sc.id}
              className={`scenario-card ${sc.status} ${rec?.won ? 'cleared' : ''}`}
              disabled={sc.status !== 'ready'}
              onClick={() => selectScenario(sc)}
            >
              <div className="stage-row">
                <span className="stage-chip">STAGE {sc.stage}</span>
                <span className="stage-stars">
                  {'★'.repeat(sc.stars ?? 1)}
                  {'☆'.repeat(3 - (sc.stars ?? 1))}
                </span>
              </div>
              <span className="scenario-tag">{sc.tag}</span>
              <span className="scenario-title">{sc.title}</span>
              <span className="scenario-subtitle">{sc.subtitle}</span>
              {rec ? (
                <span className={`stage-record ${rec.won ? 'won' : ''}`}>
                  {rec.won ? '🏆 ' : ''}
                  최고 기록 — {rec.bestLabel} · {Math.round(rec.bestScore)}점
                </span>
              ) : (
                sc.status === 'ready' && <span className="stage-record fresh">미도전</span>
              )}
              {sc.status !== 'ready' && <span className="scenario-badge">준비 중</span>}
            </button>
          )
        })}
      </div>
      <button className="ghost-btn" onClick={() => setShowBoard(true)}>
        🏆 종합 감독 랭킹
      </button>
      {showBoard && <OverallBoard onClose={() => setShowBoard(false)} />}
    </div>
  )
}
