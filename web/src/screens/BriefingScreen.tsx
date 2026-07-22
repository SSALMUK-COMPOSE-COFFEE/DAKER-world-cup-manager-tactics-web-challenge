import { useGameStore } from '../store/gameStore'

export function BriefingScreen() {
  const match = useGameStore((s) => s.match)
  const players = useGameStore((s) => s.players)
  const goto = useGameStore((s) => s.goto)
  if (!match || !players) return null

  const m = match.moment
  const periodLabel = { '1H': '전반', '2H': '후반', ET: '연장' }[m.period]

  return (
    <div className="screen briefing">
      <p className="briefing-tournament">{match.tournament}</p>
      <div className="briefing-score">
        <span className="team">{players.us.teamName}</span>
        <span className="score">
          {m.scoreUs} : {m.scoreThem}
        </span>
        <span className="team">{players.them.teamName}</span>
      </div>
      <p className="briefing-minute">
        {periodLabel} {m.minute}분 — 남은 시간 약 {m.timeLeftMin}분
      </p>
      <div className="briefing-box">
        <p className="briefing-text">{match.briefing}</p>
        <p className="briefing-opp">
          상대 포메이션 <b>{match.them.formation}</b> · 우리 포메이션 <b>{match.us.formation}</b> · 교체 카드{' '}
          <b>{match.us.subsLeft}</b>장
        </p>
      </div>
      <button className="primary-btn" onClick={() => goto('board')}>
        감독 부임
      </button>
      <button className="ghost-btn" onClick={() => goto('intro')}>
        다른 경기 선택
      </button>
    </div>
  )
}
