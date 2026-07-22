// AI 수석코치 코멘트 뱅크 — 엔진 지표 조건 매칭 + priority + 시드 기반 문장 변주.
// data-schema.md "코멘트 뱅크" 스펙 구현. LLM 미사용.

export type CommentSlot = 'tactic' | 'result'

export interface CommentCondition {
  metric: string
  op: '>=' | '<=' | '>' | '<' | '=='
  value: number
}

export interface CommentEntry {
  id: string
  slot: CommentSlot
  when: CommentCondition[]
  priority: number
  lines: string[]
}

const OPS: Record<CommentCondition['op'], (a: number, b: number) => boolean> = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
}

function matches(entry: CommentEntry, metrics: Record<string, number>): boolean {
  return entry.when.every((c) => {
    const v = metrics[c.metric]
    return v !== undefined && OPS[c.op](v, c.value)
  })
}

/**
 * slot별 코멘트 선택. 공통 뱅크 + 시나리오 전용 뱅크를 합쳐 평가하며,
 * priority 동점이면 전용(scenario)이 우선. 변주는 시드로 결정론 선택.
 */
export function pickComment(
  slot: CommentSlot,
  metrics: Record<string, number>,
  common: CommentEntry[],
  scenario: CommentEntry[],
  seed: number,
): string | null {
  const candidates = [
    ...scenario.map((e) => ({ e, own: 1 })),
    ...common.map((e) => ({ e, own: 0 })),
  ].filter(({ e }) => e.slot === slot && matches(e, metrics))

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.e.priority - a.e.priority || b.own - a.own)
  const top = candidates[0].e
  return top.lines[seed % top.lines.length] ?? null
}
