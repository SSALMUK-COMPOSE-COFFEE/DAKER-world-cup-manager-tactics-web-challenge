import { useEffect, useState } from 'react'
import { fetchOverall, type OverallEntry } from '../data/api'

/** 인트로 화면 — 3개 스테이지 최고점 합산 종합 감독 랭킹 */
export function OverallBoard({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<OverallEntry[] | null | 'offline'>(null)

  useEffect(() => {
    fetchOverall().then((res) => setEntries(res ? res.entries : 'offline'))
  }, [])

  return (
    <div className="overall-overlay" onClick={onClose}>
      <div className="overall-box" onClick={(e) => e.stopPropagation()}>
        <div className="overall-head">
          <span className="history-label">종합 감독 랭킹 — 스테이지 최고점 합산</span>
          <button className="ghost-btn small" onClick={onClose}>닫기</button>
        </div>
        {entries === null && <p className="overall-note">불러오는 중…</p>}
        {entries === 'offline' && <p className="overall-note">지금은 리더보드 서버에 연결할 수 없습니다.</p>}
        {Array.isArray(entries) && entries.length === 0 && (
          <p className="overall-note">아직 등록된 감독이 없습니다. 첫 번째 감독이 되어보세요.</p>
        )}
        {Array.isArray(entries) && entries.length > 0 && (
          <ol className="board-list">
            {entries.map((e) => (
              <li key={e.rank} className={e.me ? 'me' : ''}>
                <span className="board-rank">{e.rank}</span>
                <span className="board-nick">{e.nickname}{e.me ? ' (나)' : ''}</span>
                <span className="board-label">{e.stages}/3 스테이지</span>
                <b className="board-score">{e.total}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
