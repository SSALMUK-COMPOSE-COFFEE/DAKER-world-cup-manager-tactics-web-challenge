// 스테이지 클리어 기록 — localStorage(로그인 없음). 시나리오별 최고 기록만 유지.
export interface StageRecord {
  bestScore: number
  bestLabel: string
  /** 승리(우리 득점 > 상대 득점) 달성 여부 */
  won: boolean
}

const KEY = 'planb-progress-v1'
const NICK_KEY = 'planb-nickname'

export function loadNickname(): string | null {
  try {
    return localStorage.getItem(NICK_KEY)
  } catch {
    return null
  }
}

export function saveNickname(name: string) {
  try {
    localStorage.setItem(NICK_KEY, name)
  } catch {
    // 저장 불가 환경(시크릿 모드 등)이어도 진행에는 지장 없음
  }
}

export function loadProgress(): Record<string, StageRecord> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function recordResult(
  scenarioId: string,
  score: number,
  label: string,
  won: boolean,
): Record<string, StageRecord> {
  const all = loadProgress()
  const prev = all[scenarioId]
  if (!prev || score > prev.bestScore) {
    all[scenarioId] = { bestScore: score, bestLabel: label, won: won || (prev?.won ?? false) }
  } else if (won && !prev.won) {
    all[scenarioId] = { ...prev, won: true }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 저장 실패(시크릿 모드 등)해도 게임 진행에는 지장 없음
  }
  return all
}
