import { create } from 'zustand'
import { evaluate, pickOutcome } from '../engine/engine'
import type { CommentEntry } from '../engine/comments'
import type {
  EngineOutput,
  EnginePlayer,
  LineupSlot,
  MatchData,
  Outcome,
  Player,
  PlayersData,
  ScenarioMeta,
} from '../engine/types'
import { applyFormation } from '../engine/formations'
import { loadCommonComments, loadScenario, loadScenarioIndex } from '../data/loader'
import { decodeTactic } from '../data/share'

export type Screen = 'intro' | 'briefing' | 'board' | 'result'

/** 도전장 — 공유 링크로 받은 상대 전술의 재계산 점수. 같은 시나리오 안에서 유지된다 */
export interface Challenge {
  nickname: string
  score: number
  label: string
  /** 도전자의 원본 라인업 — 보드가 아직 이 상태 그대로인지 판별용 */
  lineup: LineupSlot[]
}

interface GameState {
  screen: Screen
  scenarios: ScenarioMeta[]
  commonComments: CommentEntry[]

  match: MatchData | null
  players: PlayersData | null
  scenarioComments: CommentEntry[]
  playersById: Map<string, Player>

  lineup: LineupSlot[]
  bench: string[]
  subsLeft: number
  formation: string
  engine: EngineOutput | null
  result: Outcome | null
  challenge: Challenge | null

  init: () => Promise<void>
  selectScenario: (meta: ScenarioMeta) => Promise<void>
  /** 공유 링크(#t=...)의 전술을 로드. 검증 실패 시 조용히 무시(인트로 유지) */
  loadSharedTactic: (encoded: string, nickname?: string) => Promise<void>
  goto: (screen: Screen) => void
  movePlayer: (playerId: string, x: number, y: number) => void
  substitute: (benchId: string, outId: string) => void
  setFormation: (name: string) => void
  resetBoard: () => void
  whistle: () => void
}

const clampPitch = (v: number) => Math.min(98, Math.max(2, v))

function toEnginePlayers(lineup: LineupSlot[], byId: Map<string, Player>): EnginePlayer[] {
  return lineup.map((s) => {
    const p = byId.get(s.playerId)
    if (!p) throw new Error(`players.json에 없는 playerId: ${s.playerId}`)
    return { ...s, attrs: p.attrs }
  })
}

function runEngine(state: Pick<GameState, 'match' | 'lineup' | 'playersById'>): EngineOutput | null {
  if (!state.match) return null
  return evaluate(
    toEnginePlayers(state.lineup, state.playersById),
    state.match.them.tacticProfile,
    state.match.moment,
    state.match.difficulty,
  )
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'intro',
  scenarios: [],
  commonComments: [],
  match: null,
  players: null,
  scenarioComments: [],
  playersById: new Map(),
  lineup: [],
  bench: [],
  subsLeft: 0,
  formation: '',
  engine: null,
  result: null,
  challenge: null,

  init: async () => {
    const [{ scenarios }, common] = await Promise.all([loadScenarioIndex(), loadCommonComments()])
    set({ scenarios, commonComments: common ?? [] })
  },

  selectScenario: async (meta) => {
    let loaded
    try {
      loaded = await loadScenario(meta.dir)
    } catch (err) {
      console.error(`시나리오 로드 실패: ${meta.id}`, err)
      alert('시나리오를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')
      return
    }
    const { match, players, comments } = loaded
    const playersById = new Map([...players.us.players, ...players.them.players].map((p) => [p.id, p]))
    const base = {
      match,
      players,
      scenarioComments: comments,
      playersById,
      lineup: match.us.lineup.map((s) => ({ ...s })),
      bench: [...match.us.bench],
      subsLeft: match.us.subsLeft,
      formation: match.us.formation,
      result: null,
      challenge: null,
    }
    set({ ...base, engine: runEngine(base), screen: 'briefing' })
  },

  loadSharedTactic: async (encoded, nickname) => {
    const decoded = decodeTactic(encoded)
    if (!decoded) return
    const meta = get().scenarios.find((s) => s.id === decoded.scenarioId && s.status === 'ready')
    if (!meta) return
    await get().selectScenario(meta)
    const { match, players, playersById } = get()
    if (!match || !players) return

    const squad = players.us.players
    const slots: LineupSlot[] = []
    const seen = new Set<string>()
    let gk = 0
    for (const d of decoded.slots) {
      const p = squad[d.idx]
      if (!p || seen.has(p.id)) return
      seen.add(p.id)
      if (d.role === 'GK') gk++
      slots.push({ playerId: p.id, x: d.x, y: d.y, role: d.role })
    }
    if (gk !== 1) return

    // 교체 규정 검증: 선발 외 인원은 벤치 출신 + 교체 한도 이내
    const starters = new Set(match.us.lineup.map((s) => s.playerId))
    const benchSet = new Set(match.us.bench)
    const subbedIn = slots.filter((s) => !starters.has(s.playerId))
    if (subbedIn.some((s) => !benchSet.has(s.playerId)) || subbedIn.length > match.us.subsLeft) return
    const usedIds = new Set(subbedIn.map((s) => s.playerId))

    // 도전장: 상대 전술의 점수를 동일 엔진으로 재계산(링크에 점수를 싣지 않아 위조 불가)
    const challengerEngine = runEngine({ match, lineup: slots, playersById })
    const challenge: Challenge | null = challengerEngine
      ? {
          nickname: nickname?.trim().slice(0, 16) || '이름없는 감독',
          score: challengerEngine.compositeFinal,
          label: pickOutcome(match.outcomes, challengerEngine.compositeFinal).label,
          lineup: slots.map((s) => ({ ...s })),
        }
      : null

    set({
      lineup: slots,
      bench: match.us.bench.filter((id) => !usedIds.has(id)),
      subsLeft: match.us.subsLeft - subbedIn.length,
      engine: challengerEngine,
      challenge,
      screen: 'board',
    })
  },

  goto: (screen) => set({ screen }),

  movePlayer: (playerId, x, y) => {
    const { lineup, match, playersById } = get()
    const slot = lineup.find((s) => s.playerId === playerId)
    if (!slot || slot.role === 'GK') return // GK 드래그 잠금
    const next = lineup.map((s) =>
      s.playerId === playerId ? { ...s, x: clampPitch(x), y: clampPitch(y) } : s,
    )
    set({ lineup: next, engine: runEngine({ match, lineup: next, playersById }) })
  },

  substitute: (benchId, outId) => {
    const { lineup, bench, subsLeft, match, playersById } = get()
    const out = lineup.find((s) => s.playerId === outId)
    if (!out || out.role === 'GK' || subsLeft <= 0 || !bench.includes(benchId)) return
    // 투입 선수는 빠진 선수의 좌표·role 승계
    const next = lineup.map((s) => (s.playerId === outId ? { ...s, playerId: benchId } : s))
    set({
      lineup: next,
      bench: bench.filter((id) => id !== benchId),
      subsLeft: subsLeft - 1,
      engine: runEngine({ match, lineup: next, playersById }),
    })
  },

  setFormation: (name) => {
    const { lineup, playersById, match } = get()
    const next = applyFormation(lineup, playersById, name)
    set({ formation: name, lineup: next, engine: runEngine({ match, lineup: next, playersById }) })
  },

  resetBoard: () => {
    const { match, playersById } = get()
    if (!match) return
    const lineup = match.us.lineup.map((s) => ({ ...s }))
    set({
      lineup,
      bench: [...match.us.bench],
      subsLeft: match.us.subsLeft,
      formation: match.us.formation,
      result: null,
      engine: runEngine({ match, lineup, playersById }),
    })
  },

  whistle: () => {
    const { match, engine } = get()
    if (!match || !engine) return
    set({ result: pickOutcome(match.outcomes, engine.compositeFinal), screen: 'result' })
  },
}))
