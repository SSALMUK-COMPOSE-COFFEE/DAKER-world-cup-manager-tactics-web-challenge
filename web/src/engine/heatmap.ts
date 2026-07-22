// §8 커버리지 히트맵 — 32×20 격자에 가우시안 영향권을 누적한다.
import type { EnginePlayer } from './types'

export const GRID_W = 32
export const GRID_H = 20

export interface HeatmapResult {
  /** 우리팀 영향값 격자 (row-major, [gy * GRID_W + gx]) */
  us: Float32Array
  /** 상대 포함 지배력 대비 (us − them) */
  dominance: Float32Array
  /** 좌/중/우 밴드별 커버리지 갭 비율(0~1) — 코멘트 뱅크 조건용 */
  gapLeft: number
  gapCenter: number
  gapRight: number
}

const GAP_THRESHOLD = 0.35

function accumulate(grid: Float32Array, players: EnginePlayer[], sign: number) {
  for (const p of players) {
    const sigma = 0.1 * (0.8 + (0.4 * p.attrs.pace) / 99)
    const twoSigmaSq = 2 * sigma * sigma
    const px = p.x / 100
    const py = p.y / 100
    for (let gy = 0; gy < GRID_H; gy++) {
      const cy = (gy + 0.5) / GRID_H
      for (let gx = 0; gx < GRID_W; gx++) {
        const cx = (gx + 0.5) / GRID_W
        const dSq = (cx - px) * (cx - px) + (cy - py) * (cy - py)
        grid[gy * GRID_W + gx] += sign * Math.exp(-dSq / twoSigmaSq)
      }
    }
  }
}

export function computeHeatmap(us: EnginePlayer[], them: EnginePlayer[]): HeatmapResult {
  const usGrid = new Float32Array(GRID_W * GRID_H)
  accumulate(usGrid, us, 1)

  const dominance = Float32Array.from(usGrid)
  accumulate(dominance, them, -1)

  // y 밴드(왼/중/오른쪽 터치라인 기준)별로 임계 이하 셀 비율 = 갭
  const bandGap = [0, 0, 0]
  const bandTotal = [0, 0, 0]
  for (let gy = 0; gy < GRID_H; gy++) {
    const band = Math.min(2, Math.floor((gy / GRID_H) * 3))
    for (let gx = 0; gx < GRID_W; gx++) {
      bandTotal[band]++
      if (usGrid[gy * GRID_W + gx] < GAP_THRESHOLD) bandGap[band]++
    }
  }

  return {
    us: usGrid,
    dominance,
    gapLeft: bandGap[0] / bandTotal[0],
    gapCenter: bandGap[1] / bandTotal[1],
    gapRight: bandGap[2] / bandTotal[2],
  }
}
