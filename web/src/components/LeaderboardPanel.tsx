import { useState } from 'react'
import { fetchLeaderboard, submitScore, type BoardEntry, type SubmitResult } from '../data/api'
import { loadNickname, saveNickname } from '../data/progress'
import type { LineupSlot } from '../engine/types'

/** 결과 화면 하단 — 이번 전술을 리더보드에 등록하고 스테이지 랭킹을 보여준다 */
export function LeaderboardPanel({ scenarioId, lineup }: { scenarioId: string; lineup: LineupSlot[] }) {
  const [nickname, setNickname] = useState(() => loadNickname() ?? '')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'offline'>('idle')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [entries, setEntries] = useState<BoardEntry[]>([])

  const submit = async () => {
    setState('busy')
    const name = nickname.trim() || '이름없는 감독'
    saveNickname(name)
    const res = await submitScore(scenarioId, name, lineup)
    if (!res) {
      setState('offline')
      return
    }
    setResult(res)
    const board = await fetchLeaderboard(scenarioId)
    setEntries(board?.entries ?? [])
    setState('done')
  }

  if (state === 'offline') {
    return (
      <div className="board-panel-box offline">
        <span className="history-label">리더보드</span>
        <p>지금은 리더보드 서버에 연결할 수 없습니다. 게임 기록은 이 기기에 저장돼 있어요.</p>
      </div>
    )
  }

  if (state === 'done' && result) {
    return (
      <div className="board-panel-box">
        <span className="history-label">리더보드 — 스테이지 랭킹</span>
        <p className="board-myrank">
          <b>{result.rank}위</b> / {result.total}명 · 내 최고 {result.best}점
        </p>
        <ol className="board-list">
          {entries.map((e) => (
            <li key={e.rank}>
              <span className="board-rank">{e.rank}</span>
              <span className="board-nick">{e.nickname}</span>
              <span className="board-label">{e.outcomeLabel}</span>
              <b className="board-score">{e.score}</b>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="board-panel-box">
      <span className="history-label">리더보드에 이 전술 등록하기</span>
      <div className="board-submit">
        <input
          className="board-input"
          placeholder="감독 이름 (16자)"
          maxLength={16}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && state === 'idle' && submit()}
        />
        <button className="primary-btn small" disabled={state === 'busy'} onClick={submit}>
          {state === 'busy' ? '등록 중…' : '등록'}
        </button>
      </div>
    </div>
  )
}
