import { useGameStore } from '../store/gameStore'

export function IntroScreen() {
  const scenarios = useGameStore((s) => s.scenarios)
  const selectScenario = useGameStore((s) => s.selectScenario)

  return (
    <div className="screen intro">
      <header className="intro-hero">
        <h1 className="logo">PLAN B</h1>
        <p className="tagline">이 순간, 당신의 플랜 B는?</p>
        <p className="sub">월드컵 명경기의 결정적 순간, 당신이 감독이라면.</p>
      </header>
      <div className="scenario-grid">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            className={`scenario-card ${sc.status}`}
            disabled={sc.status !== 'ready'}
            onClick={() => selectScenario(sc)}
          >
            <span className="scenario-tag">{sc.tag}</span>
            <span className="scenario-title">{sc.title}</span>
            <span className="scenario-subtitle">{sc.subtitle}</span>
            {sc.status !== 'ready' && <span className="scenario-badge">준비 중</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
