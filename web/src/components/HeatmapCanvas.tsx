import { useEffect, useRef } from 'react'
import { GRID_H, GRID_W, type HeatmapResult } from '../engine/heatmap'

/** 격자 해상도로 그린 뒤 CSS로 늘려 블러된 열지도 느낌을 낸다(저비용). */
export function HeatmapCanvas({ heatmap }: { heatmap: HeatmapResult }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(GRID_W, GRID_H)
    for (let i = 0; i < heatmap.dominance.length; i++) {
      const v = heatmap.dominance[i]
      const o = i * 4
      if (v >= 0) {
        // 우리 지배: 시안-그린
        const a = Math.min(1, v / 2.2)
        img.data[o] = 20
        img.data[o + 1] = 210
        img.data[o + 2] = 160
        img.data[o + 3] = Math.round(150 * a)
      } else {
        // 상대 지배(우리 빈 공간): 레드
        const a = Math.min(1, -v / 2.2)
        img.data[o] = 235
        img.data[o + 1] = 60
        img.data[o + 2] = 60
        img.data[o + 3] = Math.round(150 * a)
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [heatmap])

  return <canvas ref={ref} width={GRID_W} height={GRID_H} className="heatmap-canvas" />
}
