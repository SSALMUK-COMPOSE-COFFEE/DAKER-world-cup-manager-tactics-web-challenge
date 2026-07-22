export interface PlayerAttrs {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

export interface Player {
  id: string
  name: string
  pos: 'GK' | 'DF' | 'MF' | 'FW'
  overall: number
  attrs: PlayerAttrs
}

export interface Squad {
  teamCode: string
  teamName: string
  year: number
  players: Player[]
}

export interface PlayersData {
  us: Squad
  them: Squad
}

export interface LineupSlot {
  playerId: string
  x: number
  y: number
  role: string
}

export interface TacticProfile {
  defLine: number
  press: number
  width: number
  tempo: number
  directness: number
}

export interface Moment {
  period: '1H' | '2H' | 'ET'
  minute: number
  scoreUs: number
  scoreThem: number
  timeLeftMin: number
}

export interface OutcomeGoal {
  minute: number
  scorer: string
  type: string
  against?: boolean
}

export interface Outcome {
  minScore: number
  resultScoreUs: number
  resultScoreThem: number
  label: string
  narrative: string
  goals: OutcomeGoal[]
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface MatchData {
  id: string
  title: string
  tournament: string
  difficulty: Difficulty
  themeColor: string
  moment: Moment
  us: {
    formation: string
    subsLeft: number
    lineup: LineupSlot[]
    bench: string[]
  }
  them: {
    formation: string
    displayLineup: LineupSlot[]
    tacticProfile: TacticProfile
  }
  briefing: string
  actualHistory: {
    finalScoreUs: number
    finalScoreThem: number
    summary: string
  }
  outcomes: Outcome[]
}

export interface ScenarioMeta {
  id: string
  dir: string
  title: string
  subtitle: string
  tag: string
  status: 'ready' | 'planned'
}

/** 엔진 입력용: 배치 슬롯 + 해당 선수 능력치 */
export interface EnginePlayer extends LineupSlot {
  attrs: PlayerAttrs
}

export type SimEventKind =
  | 'goal'
  | 'goal-against'
  | 'chance'
  | 'press'
  | 'counter'
  | 'block'
  | 'info'
  | 'whistle'

export interface EngineOutput {
  ATT: number
  DEF: number
  PRESS: number
  BALANCE: number
  RISK: number
  xG: number
  xGA: number
  composite: number
  compositeFinal: number
  /** 압박 라인 x 위치(0~100) — 가장 깊은 4명 평균 */
  pressLineX: number
  lineHeight: number
  backCount: number
  fwdCount: number
  widthUse: number
}
